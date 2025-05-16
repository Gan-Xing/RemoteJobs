import playwright from 'playwright-core';
import { chromium } from 'playwright';
import path from 'path';

// 设置临时文件存储位置
const TEMP_DATA_PATH = path.join(process.cwd(), 'temp');

export const config = {
  api: {
    bodyParser: true,
    responseLimit: false,
    externalResolver: true,
  },
};

// 添加一个Map来存储搜索状态
const searchStates = new Map();

// 简化版的日志记录器
const logger = {
  info: (message) => console.log(`${new Date().toISOString()} - INFO - ${message}`),
  warning: (message) => console.warn(`${new Date().toISOString()} - WARN - ${message}`),
  error: (message) => console.error(`${new Date().toISOString()} - ERROR - ${message}`),
};

async function scrapeJobDetail(page, jobUrl) {
  logger.info(`访问职位详情页面: ${jobUrl}`);
  const details = {
    job_description: "未找到",
    applicants_count: "未找到",
    salary_range: "未找到",
    job_criteria: {}
  };

  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(Math.random() * (4000 - 2000) + 2000);

    try {
      await page.evaluate(() => {
        const topModal = document.querySelector('.top-level-modal-container');
        if (topModal) topModal.remove();
        document.querySelectorAll('.modal, .modal__overlay, .modal__wrapper').forEach(el => el.remove());
        document.body.style.overflow = 'auto';
        document.body.classList.remove('overflow-hidden');
        document.documentElement.style.overflow = 'auto';
        window.open = () => null;
        document.querySelectorAll('iframe').forEach(iframe => {
          iframe.style.pointerEvents = 'none';
        });
      });
      logger.info("✅ 已尝试关闭详情页弹窗");
    } catch (e) {
      logger.warning(`⚠️ 关闭详情页弹窗时出错: ${e.message}`);
    }

    const applicantsEl = await page.$("span.num-applicants__caption");
    if (applicantsEl) {
      details.applicants_count = (await applicantsEl.innerText()).trim();
    }

    const salaryEl = await page.$(".compensation__salary");
    if (salaryEl) {
      details.salary_range = (await salaryEl.innerText()).trim();
      logger.info(`提取薪酬范围: ${details.salary_range}`);
    }

    const criteriaItems = await page.$$(".description__job-criteria-item");
    for (const item of criteriaItems) {
      try {
        const headerEl = await item.$(".description__job-criteria-subheader");
        const valueEl = await item.$(".description__job-criteria-text");

        if (headerEl && valueEl) {
          const headerText = (await headerEl.innerText()).trim();
          const valueText = (await valueEl.innerText()).trim();
          details.job_criteria[headerText] = valueText;
          logger.info(`提取职位标准信息: ${headerText} = ${valueText}`);
        }
      } catch (e) {
        logger.warning(`提取职位标准信息时出错: ${e.message}`);
      }
    }

    await page.waitForTimeout(Math.random() * (2000 - 1000) + 1000);

    const showMoreSelectors = [
      'button[aria-label="Show more text for job description"]',
      'button.show-more-less-html__button--more',
      'button[aria-label="Show more"]',
      'button[data-control-name="show_more"]'
    ];

    for (const selector of showMoreSelectors) {
      try {
        const showMoreButton = await page.$(selector);
        if (showMoreButton) {
          logger.info(`找到 'Show more' 按钮，使用选择器: ${selector}`);
          await showMoreButton.click({ timeout: 2000 });
          await page.waitForTimeout(Math.random() * (2000 - 1000) + 1000);
          break;
        }
      } catch (e) {
        logger.warning(`使用选择器 ${selector} 点击 'Show more' 按钮失败: ${e.message}`);
      }
    }

    const descriptionSelectors = [
      ".jobs-description__content .jobs-box__html-content div:first-child",
      ".show-more-less-html__markup",
      ".description__text",
      ".jobs-description-content__text",
      ".jobs-description__content"
    ];

    for (const selector of descriptionSelectors) {
      const descriptionElement = await page.$(selector);
      if (descriptionElement) {
        details.job_description = (await descriptionElement.innerText()).trim();
        if (details.job_description && details.job_description.length > 50) {
          logger.info(`成功获取职位描述，使用选择器: ${selector}`);
          break;
        }
      }
    }

    if (details.job_description === "未找到") {
      logger.warning("未能找到职位描述，尝试获取页面内容作为备选");
      try {
        const pageContentText = await page.locator("body").innerText({ timeout: 5000 });
        if (pageContentText.length > 200) {
          details.job_description_fallback = pageContentText.substring(0, 2000);
        }
      } catch(e) {
        logger.warning(`获取备用正文文本失败: ${e.message}`);
      }
    }

  } catch (e) {
    logger.error(`获取职位详情时出错 ${jobUrl}: ${e.message}`);
  }
  return details;
}

async function scrapeLinkedinJobs(page, keywords, location, maxJobs = 20, fetchDetails = true, maxJobDetails = 5) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    logger.info("Chromium浏览器已启动");

    const context = await browser.newContext({
      locale: 'en-US',
      geolocation: { longitude: -122.4194, latitude: 37.7749 },
      permissions: ["geolocation"],
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    
    logger.info("浏览器上下文已配置为en-US");
    const page = await context.newPage();

    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9"
    });

    const searchUrl = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_TPR=&trk=public_jobs_jobs-search-bar_search-submit&position=1&pageNum=0`;

    logger.info(`导航到搜索URL: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(Math.random() * (4000 - 2000) + 2000);

    // 处理弹窗
    try {
      logger.info("⏳ 等待特定弹窗按钮出现...");
      await page.waitForSelector("button.modal__dismiss", { timeout: 5000 });
      logger.info("执行JavaScript来关闭弹窗...");
      await page.evaluate(() => {
        const topModal = document.querySelector('.top-level-modal-container');
        if (topModal) topModal.remove();
        document.querySelectorAll('.modal, .modal__overlay, .modal__wrapper').forEach(el => el.remove());
        document.body.style.overflow = 'auto';
        document.body.classList.remove('overflow-hidden');
        document.documentElement.style.overflow = 'auto';
        window.open = () => null;
        document.querySelectorAll('iframe').forEach(iframe => {
          iframe.style.pointerEvents = 'none';
        });
      });
      logger.info("✅ JavaScript已执行，尝试关闭弹窗");
    } catch (e) {
      logger.warning(`⚠️ 等待特定弹窗按钮超时或执行JS时发生错误: ${e.message}`);
    }

    logger.info("滚动加载职位列表...");
    let previousCardCount = 0;
    let noChangeScrollCount = 0;
    let consecutiveNoChangeCount = 0;
    const MAX_SCROLLS = 50;
    const MAX_NO_CHANGE = 5;
    
    for (let i = 0; i < MAX_SCROLLS; i++) {
      const showMoreButton = await page.$('.infinite-scroller__show-more-button.infinite-scroller__show-more-button--visible');
      if (showMoreButton) {
        try {
          logger.info("找到'显示更多职位'按钮，点击加载更多职位...");
          await showMoreButton.click({timeout: 5000});
          await page.waitForTimeout(Math.random() * (5000 - 3000) + 3000);
          consecutiveNoChangeCount = 0;
        } catch (e) {
          logger.warning(`点击'显示更多职位'按钮时出错: ${e.message}`);
        }
      }

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(Math.random() * (3500 - 2000) + 2000);

      const jobCards = await page.$$(".jobs-search__results-list > li div.base-card");
      const currentCardCount = jobCards.length;
      logger.info(`滚动/点击 ${i + 1}/${MAX_SCROLLS}: 找到 ${currentCardCount} 个职位卡片`);

      if (currentCardCount >= maxJobs) {
        logger.info(`已达到所需职位数量 ${maxJobs}，停止滚动`);
        break;
      }

      if (currentCardCount === previousCardCount) {
        consecutiveNoChangeCount++;
        if (consecutiveNoChangeCount >= MAX_NO_CHANGE) {
          logger.info(`连续 ${MAX_NO_CHANGE} 次没有新职位加载，停止滚动`);
          break;
        }
      } else {
        consecutiveNoChangeCount = 0;
      }
      
      previousCardCount = currentCardCount;
    }

    const jobCardsFinal = await page.$$(".jobs-search__results-list > li div.base-card");
    logger.info(`🔍 滚动后检测到 ${jobCardsFinal.length} 个职位卡片`);

    const jobsData = [];
    const jobIdsSeen = new Set();

    for (let cardIndex = 0; cardIndex < jobCardsFinal.length && jobsData.length < maxJobs; cardIndex++) {
      const card = jobCardsFinal[cardIndex];
      
      try {
        const titleEl = await card.$(".base-search-card__title");
        const companyEl = await card.$(".base-search-card__subtitle a");
        const locationEl = await card.$(".job-search-card__location");
        const postedEl = await card.$("time.job-search-card__listdate");
        let linkEl = await card.$("a.base-card__full-link");

        let rawJobId = null;
        try {
          const parentLi = await card.evaluateHandle((node) => {
            let parent = node;
            while (parent && parent.tagName !== 'LI') {
              parent = parent.parentElement;
            }
            return parent;
          });
          
          if (parentLi) {
            const isNotNull = await parentLi.evaluate(node => node !== null);
            if (isNotNull) {
              rawJobId = await parentLi.getAttribute("data-entity-urn");
            }
          }
          await parentLi.dispose();
        } catch (e) {
          logger.warning(`查找职位ID的父'li'元素时出错: ${e.message}`);
        }
        
        const jobId = rawJobId ? rawJobId.split(":").pop() : `generated_id_${Date.now()}_${cardIndex}`;

        if (jobIdsSeen.has(jobId)) {
          logger.info(`跳过重复的职位ID: ${jobId}`);
          continue;
        }
        jobIdsSeen.add(jobId);

        const title = titleEl ? (await titleEl.innerText()).trim() : "N/A";
        const company = companyEl ? (await companyEl.innerText()).trim() : "N/A";
        const location = locationEl ? (await locationEl.innerText()).trim() : "N/A";
        const postedDate = postedEl ? (await postedEl.getAttribute("datetime")) : "N/A";
        const postedText = postedEl ? (await postedEl.innerText()).trim() : "N/A";

        let link = "";
        if (linkEl) {
          const href = await linkEl.getAttribute("href");
          if (href) {
            link = href.startsWith("/") ? `https://www.linkedin.com${href}` : href;
          }
        } else {
          const titleLinkEl = await card.$(".base-search-card__title a");
          if (titleLinkEl) {
            const href = await titleLinkEl.getAttribute("href");
            if (href) {
              link = href.startsWith("/") ? `https://www.linkedin.com${href}` : href;
            }
          }
        }
        if (!link) link = "N/A";

        const jobInfo = {
          job_id: jobId.trim(),
          title: title,
          company: company,
          location: location,
          posted_date_attr: postedDate,
          posted_text: postedText,
          link: link.split('?')[0],
        };

        jobsData.push(jobInfo);
        logger.info(`提取基本信息: ${title} at ${company}`);
      } catch (e) {
        logger.error(`提取职位信息时出错: ${e.message}`);
        continue;
      }
    }

    logger.info(`\n✅ 基本信息的职位总数: ${jobsData.length}`);

    if (fetchDetails && jobsData.length > 0) {
      const maxDetailsToFetch = Math.min(jobsData.length, maxJobDetails);
      logger.info(`\n--- 开始获取最多 ${maxDetailsToFetch} 个职位的详细信息 ---`);
      
      for (let i = 0; i < maxDetailsToFetch; i++) {
        const job = jobsData[i];
        if (job.link && job.link !== "N/A") {
          const details = await scrapeJobDetail(page, job.link);
          Object.assign(job, details);
          await page.waitForTimeout(Math.random() * (5000 - 2500) + 2500);
        }
      }

      const jobsWithDetailsCount = jobsData.filter(job => job.job_description && job.job_description !== "未找到").length;
      logger.info(`✅ 成功获取 ${jobsWithDetailsCount} 个职位的详细信息`);
    }

    return jobsData;

  } catch (error) {
    logger.error(`scrapeLinkedinJobs发生错误: ${error.stack}`);
    throw new Error(`爬取LinkedIn职位时出错: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
      logger.info("浏览器已关闭");
    }
  }
}

export default async function handler(req, res) {
  if (req.method === 'POST' || req.method === 'GET') {
    // 从请求中获取参数
    const params = req.method === 'POST' ? req.body : req.query;
    const { keywords, location, maxJobs = 20, fetchDetails = true, maxJobDetails = 5 } = params;

    if (!keywords || !location) {
      res.status(400).json({ error: '关键词和地点为必填项' });
      return;
    }

    try {
      const browser = await chromium.launch({
        headless: true,
      });

      const context = await browser.newContext();
      const page = await context.newPage();

      const jobs = await scrapeLinkedinJobs(
        page, 
        keywords, 
        location, 
        maxJobs, 
        fetchDetails, 
        maxJobDetails
      );

      res.status(200).json({ jobs });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}