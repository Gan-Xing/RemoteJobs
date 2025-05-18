import { chromium } from 'playwright';
import path from 'path';
import { generateSearchId, saveSearch, saveJobs } from '../../utils/prisma';

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

// 在文件顶部添加缓存对象
const jobDetailsCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时缓存有效期

// 简化版的日志记录器
const logger = {
  info: (message) => console.log(`${new Date().toISOString()} - INFO - ${message}`),
  warning: (message) => console.warn(`${new Date().toISOString()} - WARN - ${message}`),
  error: (message) => console.error(`${new Date().toISOString()} - ERROR - ${message}`),
};

// 在文件顶部修改CONFIG配置
const CONFIG = {
  useCache: true, // 启用缓存
  minDetailRequestDelay: 500,
  maxDetailRequestDelay: 1000,
};

// 使用LinkedIn API端点获取职位数据
async function getLinkedinJobs(page, keywords, location, maxJobs = 20, fetchDetails = true, maxJobDetails = 5, filters = {}) {
  try {
    logger.info("使用LinkedIn API端点获取职位数据");
    
    // 构建查询参数
    const baseParams = {
      keywords: keywords,
      location: location,
      // 可以从filters参数中添加更多过滤选项
      ...(filters.geoId ? { geoId: filters.geoId } : {}),
      ...(filters.f_TPR ? { f_TPR: filters.f_TPR } : {}), // 发布日期过滤器
      
      // 处理多选过滤器，如果有多个值用逗号连接
      ...(filters.f_WT && filters.f_WT.length > 0 ? { f_WT: filters.f_WT.join(',') } : {}), // 工作方式
      ...(filters.f_JT && filters.f_JT.length > 0 ? { f_JT: filters.f_JT.join(',') } : {}), // 职位类型
      ...(filters.f_E && filters.f_E.length > 0 ? { f_E: filters.f_E.join(',') } : {}),    // 经验级别
      
      ...(filters.f_SB2 ? { f_SB2: filters.f_SB2 } : {}), // 薪资过滤
    };
    
    const allJobsData = [];
    const jobIdsSeen = new Set();
    let start = 0;
    let hasMorePages = true;
    
    // 限制最多爬取的页数
    const maxPages = Math.ceil(maxJobs / 10) + 1; // 每页约10个结果（虽然请求25个，但LinkedIn API一般返回约10个）
    let currentPage = 0;
    let retryCount = 0; // 为每一页定义的重试计数器
    let consecutiveEmptyPages = 0; // 记录连续空页面数量
    
    while (allJobsData.length < maxJobs && hasMorePages && currentPage < maxPages) {
      // 构建API URL
      const apiUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search`;
      const queryParams = new URLSearchParams({
        ...baseParams,
        start: start.toString()
      }).toString();
      
      const fullUrl = `${apiUrl}?${queryParams}`;
      logger.info(`获取第 ${currentPage + 1} 页职位: ${fullUrl}`);
      
      // 使用页面访问API URL
      await page.goto(fullUrl, { 
        waitUntil: "domcontentloaded",
        timeout: 30000
      });
      
      // 等待页面加载
      await page.waitForTimeout(500);
      
      // 提取职位数据
      const jobCards = await page.$$("li");
      if (jobCards.length === 0) {
        logger.info("当前页没有找到职位卡片，可能已到达末页或LinkedIn限制了请求");
        
        // 检查是否有被封的信号或其他错误信息
        const errorText = await page.$eval("body", el => el.textContent)
          .catch(() => "");
        
        if (errorText.includes("无法访问") || errorText.includes("频率限制") || 
            errorText.includes("rate limit") || errorText.includes("blocked")) {
          logger.warning("LinkedIn可能限制了请求，暂停爬取");
          hasMorePages = false;
          break;
        }
        
        // 增加重试计数
        retryCount++;
        
        // 最多重试2次，超过就放弃当前页
        if (retryCount <= 2) {
          logger.info(`尝试重试当前页... (第${retryCount}次重试)`);
          await page.waitForTimeout(2000); // 稍等长一些再重试
          continue; // 不增加start，重试当前页
        } else {
          // 增加连续空页面计数
          consecutiveEmptyPages++;
          logger.info(`已重试${retryCount}次，放弃当前页。连续空页面数: ${consecutiveEmptyPages}`);
          
          // 如果连续2个页面都为空，认为已到达末尾，结束搜索
          if (consecutiveEmptyPages >= 2) {
            logger.info(`连续${consecutiveEmptyPages}个页面为空，可能已到达职位列表末尾，停止搜索`);
            hasMorePages = false;
            break;
          }
          
          // 否则继续尝试下一页
          currentPage++;
          start += 25;
          retryCount = 0; // 重置重试计数器
          continue;
        }
      }
      
      // 重置计数器，当前页面成功获取到数据
      retryCount = 0;
      consecutiveEmptyPages = 0; // 重置连续空页面计数
      
      logger.info(`在第 ${currentPage + 1} 页发现 ${jobCards.length} 个职位卡片`);
      
      // 解析每个职位卡片
      for (const card of jobCards) {
        try {
          // 提取职位ID和refID
          const cardDiv = await card.$("div.base-card");
          if (!cardDiv) continue;
          
          const entityUrn = await cardDiv.getAttribute("data-entity-urn");
          const refId = await cardDiv.getAttribute("data-reference-id");
          
          if (!entityUrn) continue;
          
          // 提取jobId
          const jobId = entityUrn.split(":").pop();
          
          if (jobIdsSeen.has(jobId)) {
            logger.info(`跳过重复的职位ID: ${jobId}`);
            continue;
          }
          jobIdsSeen.add(jobId);
          
          // 提取标题 - 避免XSS和HTML
          const titleEl = await card.$(".base-search-card__title");
          const title = titleEl ? 
            (await titleEl.evaluate(el => {
              // 移除任何HTML标签，只获取文本内容
              return el.textContent.trim();
            })) : "N/A";
          
          // 提取公司
          const companyEl = await card.$(".base-search-card__subtitle a");
          const company = companyEl ? 
            (await companyEl.evaluate(el => el.textContent.trim())) : "N/A";
          
          // 提取地点
          const locationEl = await card.$(".job-search-card__location");
          const location = locationEl ? 
            (await locationEl.evaluate(el => el.textContent.trim())) : "N/A";
          
          // 提取发布日期
          const postedEl = await card.$("time.job-search-card__listdate");
          const postedDate = postedEl ? (await postedEl.getAttribute("datetime")) : "N/A";
          const postedText = postedEl ? 
            (await postedEl.evaluate(el => el.textContent.trim())) : "N/A";
          
          // 构建详情页URL
          const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}${refId ? `?refId=${encodeURIComponent(refId.trim())}` : ''}`;
          
          const jobInfo = {
            job_id: jobId.trim(),
            title: title,
            company: company,
            location: location,
            posted_date_attr: postedDate,
            posted_text: postedText,
            link: detailUrl,
            ref_id: refId ? refId.trim() : '',
          };
          
          allJobsData.push(jobInfo);
          logger.info(`提取基本信息: ${title} at ${company}`);
          
          if (allJobsData.length >= maxJobs) {
            break;
          }
        } catch (e) {
          logger.error(`提取职位信息时出错: ${e.message}`);
          continue;
        }
      }
      
      // 准备获取下一页
      currentPage++;
      start += 25; // LinkedIn每页请求参数增加25
      
      // 在请求下一页之前等待随机时间(3-5秒)，减少被封风险
      await page.waitForTimeout(Math.random() * 200 + 100);
    }
    
    logger.info(`\n✅ 基本信息的职位总数: ${allJobsData.length}`);
    
    // 清理过期缓存
    if (CONFIG.useCache) {
      const now = Date.now();
      for (const [key, value] of jobDetailsCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          jobDetailsCache.delete(key);
        }
      }
    }
    
    // 获取职位详情
    if (fetchDetails && allJobsData.length > 0) {
      const maxDetailsToFetch = Math.min(allJobsData.length, maxJobDetails);
      logger.info(`\n--- 开始获取最多 ${maxDetailsToFetch} 个职位的详细信息 ---`);
      
      let successCount = 0;
      for (let i = 0; i < maxDetailsToFetch; i++) {
        const job = allJobsData[i];
        
        // 检查缓存
        let usedCache = false;
        if (CONFIG.useCache && job.job_id && jobDetailsCache.has(job.job_id)) {
          try {
            const cachedData = jobDetailsCache.get(job.job_id);
            if (cachedData && cachedData.details && typeof cachedData.details === 'object') {
              logger.info(`使用缓存数据: ${job.job_id}`);
              Object.assign(job, cachedData.details);
              usedCache = true;
              successCount++;
            }
          } catch (cacheError) {
            logger.error(`读取缓存数据出错: ${cacheError.message}`);
          }
        }
        
        // 如果没有缓存，获取详情
        if (!usedCache) {
          try {
            logger.info(`爬取第 ${i+1}/${maxDetailsToFetch} 个职位详情: ${job.job_id}`);
            
            // 构建直接API URL
            const detailUrl = job.link;
            
            await page.goto(detailUrl, { 
              waitUntil: "domcontentloaded",
              timeout: 30000
            });
            
            // 等待页面加载
            await page.waitForTimeout(Math.random() * 500 + 500);
            
            // 提取详情数据
            const details = await extractJobDetails(page);
            Object.assign(job, details);
            
            // 保存到缓存
            if (CONFIG.useCache && job.job_id) {
              jobDetailsCache.set(job.job_id, {
                details: { ...details },
                timestamp: Date.now()
              });
            }
            
            if (job.job_description && job.job_description !== "未找到") {
              successCount++;
            }
            
            // 随机延迟
            const delayTime = Math.random() * (CONFIG.maxDetailRequestDelay - CONFIG.minDetailRequestDelay) + CONFIG.minDetailRequestDelay;
            logger.info(`等待 ${Math.round(delayTime/1000)} 秒后继续...`);
            await page.waitForTimeout(delayTime);
          } catch (e) {
            logger.error(`爬取详情页失败 ${job.job_id}: ${e.message}`);
          }
        }
      }
      
      logger.info(`✅ 成功获取 ${successCount} 个职位的详细信息`);
    }
    
    return allJobsData;
  } catch (error) {
    logger.error(`获取LinkedIn职位数据时出错: ${error.stack}`);
    throw new Error(`获取LinkedIn职位数据时出错: ${error.message}`);
  }
}

// 从职位详情页提取数据
async function extractJobDetails(page) {
  const details = {
    job_description: "未找到",
    applicants_count: "未找到",
    salary_range: "未找到",
    job_criteria: {},
    is_remote: false
  };
  
  try {
    // 提取职位描述 - 使用更精确的选择器
    const descriptionSelectors = [
      // 最优先 - 直接获取内容标记
      ".show-more-less-html__markup",
      // 次优先 - 各种描述容器
      ".description__text > .show-more-less-html > .show-more-less-html__markup",
      ".jobs-description > .show-more-less-html > .show-more-less-html__markup",
      ".jobs-description-content__text > .show-more-less-html > .show-more-less-html__markup",
      ".jobs-box__html-content > .show-more-less-html > .show-more-less-html__markup",
      // 备选
      ".description__text",
      ".jobs-description-content__text",
      ".jobs-description__content",
      ".jobs-box__html-content",
      ".job-description",
      "[data-job-description]",
      ".jobs-box__details"
    ];
    
    let description = null;
    for (const selector of descriptionSelectors) {
      try {
        // 使用特定的函数来处理可能包含按钮的内容
        const text = await page.$eval(selector, (el) => {
          // 移除所有按钮元素后再获取文本
          const clone = el.cloneNode(true);
          const buttons = clone.querySelectorAll('button');
          buttons.forEach(button => button.remove());
          
          // 删除"Show more"和"Show less"文本节点
          const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
          const textsToRemove = [];
          let currentNode;
          while (currentNode = walker.nextNode()) {
            const text = currentNode.textContent.trim();
            if (text === 'Show more' || text === 'Show less' || 
                text === '显示更多' || text === '显示较少' ||
                text === '查看更多' || text === '收起') {
              textsToRemove.push(currentNode);
            }
          }
          textsToRemove.forEach(textNode => {
            if (textNode.parentNode) {
              textNode.parentNode.removeChild(textNode);
            }
          });
          
          return clone.textContent.trim();
        });
        
        if (text && text.length > 50) {
          description = text;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (description) {
      details.job_description = description;
    }
    
    // 提取申请人数 - 使用更多选择器和更干净的内容
    try {
      const applicantSelectors = [
        "span.num-applicants__caption",
        ".jobs-unified-top-card__applicant-count",
        ".jobs-company-hiring__applicant-count",
        ".job-analytics__applicant-count",
        ".applicant-count"
      ];
      
      for (const selector of applicantSelectors) {
        try {
          const text = await page.$eval(selector, el => {
            // 移除任何HTML特殊元素
            const clone = el.cloneNode(true);
            // 移除所有子元素，只保留直接文本
            while (clone.firstChild && clone.firstChild.nodeType !== Node.TEXT_NODE) {
              clone.removeChild(clone.firstChild);
            }
            return clone.textContent.trim();
          });
          if (text) {
            details.applicants_count = text.replace(/[^\d,.]+/g, ''); // 只保留数字、逗号和小数点
            break;
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {}
    
    // 提取薪资范围 - 使用更多选择器和更干净的方法
    try {
      const salarySelectors = [
        ".compensation__salary",
        ".jobs-unified-top-card__salary-details",
        ".job-details-jobs-unified-top-card__job-insight",
        ".salary-range",
        ".job-salary"
      ];
      
      for (const selector of salarySelectors) {
        try {
          const text = await page.$eval(selector, el => {
            // 过滤出薪资相关文本
            const fullText = el.textContent.trim();
            // 匹配薪资相关格式
            const salaryMatch = fullText.match(/[\$¥€£]\s*[\d,.]+([\s\-]+[\$¥€£]?[\d,.]+)?(\s*\/\s*[a-zA-Z]+)?/);
            return salaryMatch ? salaryMatch[0].trim() : fullText;
          });
          
          if (text && (
              text.includes("$") || text.includes("¥") || 
              text.includes("€") || text.includes("£") || 
              text.includes("元") || text.includes("万") ||
              /\d+[Kk]/.test(text) || // 匹配50K这样的格式
              /\d+.*\d+/.test(text)   // 匹配有数字区间的格式
            )) {
            details.salary_range = text;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {}
    
    // 提取职位标准信息 - 使用多种可能的选择器
    try {
      const criteriaSelectors = [
        ".description__job-criteria-item",
        ".jobs-description-details__list-item",
        ".jobs-unified-top-card__job-insight",
        ".job-criteria-item"
      ];
      
      for (const selector of criteriaSelectors) {
        const items = await page.$$(selector);
        if (items.length > 0) {
          for (const item of items) {
            // 尝试不同的标题/值选择器组合
            const headerSelectors = [".description__job-criteria-subheader", "h3", ".job-criteria-subheader", ".job-insight-label"];
            const valueSelectors = [".description__job-criteria-text", "span:not(h3)", ".job-criteria-text", ".job-insight-value"];
            
            let headerText = null;
            let valueText = null;
            
            // 尝试每一个标题选择器
            for (const headerSelector of headerSelectors) {
              try {
                const headerEl = await item.$(headerSelector);
                if (headerEl) {
                  headerText = await headerEl.innerText();
                  break;
                }
              } catch (e) {}
            }
            
            // 尝试每一个值选择器
            for (const valueSelector of valueSelectors) {
              try {
                const valueEl = await item.$(valueSelector);
                if (valueEl) {
                  valueText = await valueEl.innerText();
                  break;
                }
              } catch (e) {}
            }
            
            if (headerText && valueText) {
              details.job_criteria[headerText.trim()] = valueText.trim();
            }
          }
          
          // 如果找到了职位标准信息，就跳出循环
          if (Object.keys(details.job_criteria).length > 0) {
            break;
          }
        }
      }
    } catch (e) {}
    
    // 检测远程工作状态 - 扩展检测方法
    try {
      // 从各种可能的位置检测
      const remoteSelectors = [
        ".jobs-unified-top-card__workplace-type",
        ".jobs-unified-top-card__subtitle-primary .jobs-unified-top-card__bullet",
        ".job-details-jobs-unified-top-card__workplace-type",
        ".workplace-type",
        ".job-type-info"
      ];
      
      let locationText = "";
      for (const selector of remoteSelectors) {
        try {
          const text = await page.$eval(selector, el => el.textContent.toLowerCase());
          if (text) {
            locationText += " " + text;
          }
        } catch (e) {}
      }
      
      // 扩展远程关键词检查
      if (locationText.includes('remote') || 
          locationText.includes('在家工作') || 
          locationText.includes('远程') || 
          locationText.includes('remoto') || 
          locationText.includes('télétravail') ||
          locationText.includes('homeoffice')) {
        details.is_remote = true;
      } else {
        // 从职位描述检测
        const pageText = await page.$eval("body", el => el.textContent.toLowerCase());
        const remoteKeywords = [
          'fully remote', '100% remote', 'work from home', 'remote position', 
          'remoto', 'trabajo remoto', '远程工作', '在家工作', 'working remotely', 
          'remote work', 'remote opportunity', 'home office', 'work from anywhere',
          '远程办公', '居家办公', '全远程', '可远程'
        ];
        for (const keyword of remoteKeywords) {
          if (pageText.includes(keyword.toLowerCase())) {
            details.is_remote = true;
            break;
          }
        }
      }
    } catch (e) {}
    
  } catch (e) {
    logger.error(`提取职位详情数据时出错: ${e.message}`);
  }
  
  return details;
}

export default async function handler(req, res) {
  const startTime = Date.now();
  logger.info(`[${new Date().toISOString()}] 开始处理搜索请求`);

  if (req.method === 'POST' || req.method === 'GET') {
    const params = req.method === 'POST' ? req.body : req.query;
    const { 
      keywords, 
      location, 
      maxJobs = 20, 
      fetchDetails = true, 
      maxJobDetails = 5,
      geoId,
      f_TPR,    // 发布日期过滤器
      f_WT,     // 工作方式：1=现场，2=远程，3=混合
      f_JT,     // 职位类型：F=全职，P=兼职，C=合同
      f_E,      // 经验级别
      f_SB2     // 薪资过滤
    } = params;

    if (!keywords || !location) {
      res.status(400).json({ error: '关键词和地点为必填项' });
      return;
    }
    
    // 处理多选过滤器，将逗号分隔字符串转为数组
    const filters = {
      geoId,
      f_TPR,
      f_WT: f_WT ? f_WT.split(',') : undefined,
      f_JT: f_JT ? f_JT.split(',') : undefined,
      f_E: f_E ? f_E.split(',') : undefined,
      f_SB2
    };

    let browser;
    try {
      logger.info(`[${new Date().toISOString()}] 启动浏览器...`);
      browser = await chromium.launch({
        headless: process.env.NODE_ENV === 'production' ? true : false,  // 生产环境使用无头模式，开发环境可配置
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1200,800',  // 增加窗口大小，提高渲染效果
        ],
        slowMo: 20, // 减少延迟，提高速度
      });

      const context = await browser.newContext({
        viewport: { width: 1200, height: 800 },  // 匹配窗口大小
        locale: 'en-US',
        geolocation: { longitude: -122.4194, latitude: 37.7749 },
        permissions: ["geolocation"],
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",  // 更新用户代理
        extraHTTPHeaders: {
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "max-age=0",
          "sec-ch-ua": '"Chromium";v="118", "Google Chrome";v="118"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "macOS",
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "none",
          "sec-fetch-user": "?1",
        }
      });
      
      const page = await context.newPage();
      
      // 监听页面错误
      page.on('pageerror', error => {
        logger.error(`页面错误: ${error.message}`);
      });
      
      // 设置页面超时
      page.setDefaultTimeout(60000); // 增加到60秒超时
      page.setDefaultNavigationTimeout(60000);
      
      // 等待页面加载
      logger.info("等待页面完全加载...");
      await page.waitForLoadState("domcontentloaded");
      logger.info("DOM内容已加载");

      logger.info(`[${new Date().toISOString()}] 开始获取LinkedIn职位...`);
      const jobs = await getLinkedinJobs(
        page, 
        keywords, 
        location, 
        parseInt(maxJobs), 
        fetchDetails === 'true', 
        parseInt(maxJobDetails),
        filters
      );

      // 只有在成功获取数据后才保存
      if (jobs && jobs.length > 0) {
        try {
          logger.info(`[${new Date().toISOString()}] 开始处理职位数据...`);
          // 处理每个职位的远程工作状态和职位级别
          jobs.forEach(job => {
            // 确保is_remote字段存在，转换为布尔值
            job.is_remote = !!job.is_remote; 
            
            // 标准化job_criteria中的字段名称（如果有）
            if (job.job_criteria) {
              // 确保职位级别字段正确传递
              if (job.job_criteria["Seniority level"]) {
                job.seniority = job.job_criteria["Seniority level"];
              }
              
              // 确保雇佣类型字段正确传递
              if (job.job_criteria["Employment type"]) {
                job.employment_type = job.job_criteria["Employment type"];
              }
              
              // 确保工作职能字段正确传递
              if (job.job_criteria["Job function"]) {
                job.job_function = job.job_criteria["Job function"];
              }
              
              // 确保行业字段正确传递
              if (job.job_criteria["Industries"]) {
                job.industries = job.job_criteria["Industries"];
              }
            }
          });
          
          // 先返回数据给前端
          const endTime = Date.now();
          logger.info(`[${new Date().toISOString()}] 请求处理完成，准备返回数据，总耗时: ${endTime - startTime}ms`);
          
          // 确保complete为true并添加一些元数据
          res.status(200).json({ 
            jobs, 
            meta: {
              total: jobs.length,
              query: { keywords, location },
              time_ms: endTime - startTime,
              timestamp: new Date().toISOString()
            } 
          });
          
          try {
            // 异步保存数据到数据库
            logger.info(`[${new Date().toISOString()}] 开始异步保存职位数据到数据库...`);
            saveJobs(jobs).then(() => {
              logger.info(`[${new Date().toISOString()}] 职位数据异步保存完成`);
            }).catch(dbError => {
              logger.error(`[${new Date().toISOString()}] 异步保存数据失败: ${dbError.message}`);
            });
          } catch (saveError) {
            logger.error(`[${new Date().toISOString()}] 尝试保存数据时发生错误: ${saveError.message}`);
            // 不要让数据库保存错误影响API响应，因为已经响应了
          }
        } catch (error) {
          logger.error(`[${new Date().toISOString()}] 处理数据时出错: ${error.message}`);
          res.status(500).json({ error: error.message });
        }
      } else {
        const endTime = Date.now();
        logger.info(`[${new Date().toISOString()}] 请求处理完成（无数据），总耗时: ${endTime - startTime}ms`);
        res.status(200).json({ jobs: [] });
      }
    } catch (error) {
      logger.error(`[${new Date().toISOString()}] 搜索过程中发生错误: ${error.message}`);
      logger.error(`[${new Date().toISOString()}] 错误堆栈: ${error.stack}`);
      const endTime = Date.now();
      logger.info(`[${new Date().toISOString()}] 请求处理失败，总耗时: ${endTime - startTime}ms`);
      res.status(500).json({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } finally {
      if (browser) {
        try {
          // 给一些时间查看浏览器内容
          if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
            logger.info("开发模式：保持浏览器打开30秒供调试...");
            await new Promise(resolve => setTimeout(resolve, 30000));
          }
          await browser.close();
          logger.info("浏览器已关闭");
        } catch (closeError) {
          logger.error(`关闭浏览器时出错: ${closeError.message}`);
        }
      }
    }
  } else {
    const endTime = Date.now();
    logger.info(`[${new Date().toISOString()}] 请求方法不允许，总耗时: ${endTime - startTime}ms`);
    res.status(405).json({ error: 'Method not allowed' });
  }
}