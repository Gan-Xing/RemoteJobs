/**
 * fetchDetailsFromJson.js
 * -----------------------
 * 读取 data/job_urls.json 中的 detailUrl，
 * 逐条爬取职位详情并写入数据库；失败时落盘到 data/failed_job_details.json。
 *
 * 环境变量 SCRAPE_SPEED 可设为 fast / normal / safe。
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
// --- saveJobs 全量实现（与 utils/prisma.js 保持一致） ---
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { convertSalaryToUSD } = require('./salaryConverter');

const { customAlphabet } = require('nanoid');

// 数据库连接检查
const checkDatabaseConnection = async () => {
  try {
    await prisma.$connect();
    return true;
  } catch (error) {
    console.error('数据库连接失败:', error);
    return false;
  }
};

// —— 获取项目根目录（沿着目录树向上找到 package.json） —— //
function getProjectRoot() {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return __dirname; // fallback
}

// —— 预先解析目录 —— //
const projectRoot = getProjectRoot();
const failedPath  = path.join(projectRoot, 'data', 'failed_job_details.json');
// job_urls.json 真实路径（在主流程中赋值）
let jobUrlsPath = '';

// 自定义ID
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);
const generateCustomId = () => {
  const timestamp = Date.now().toString(36);
  const random = nanoid();
  return `${timestamp}-${random}`;
};
/* ---------- 判定“完整数据” ---------- */
const isJobComplete = (job) => (
  job.job_id &&                                                      // jobId 存在
  job.title && job.title !== '未知职位' &&
  job.company && job.company !== '未知公司' &&
  job.location && job.location !== '未知地点' &&
  job.job_description && job.job_description !== '未找到描述' &&
  job.link &&                                                        // url 存在
  job.posted_text && job.posted_text !== '未知日期' &&
  job.applicants_count && job.applicants_count !== '未找到' &&
  job.seniority && job.employment_type && job.industries
);

/* ---------- 从 job_urls.json 移除已完成职位 ---------- */
const removeCompletedFromJobUrls = (completedIds) => {
  if (!jobUrlsPath || !fs.existsSync(jobUrlsPath) || completedIds.length === 0) return;
  try {
    const oldList = JSON.parse(fs.readFileSync(jobUrlsPath, 'utf8'));
    const newList = oldList.filter(item => !completedIds.includes(item.jobId));
    if (newList.length !== oldList.length) {
      fs.writeFileSync(jobUrlsPath, JSON.stringify(newList, null, 2));
      console.log(`[DetailFetcher] 🔥 已从 job_urls.json 移除 ${oldList.length - newList.length} 条，剩余 ${newList.length} 条`);
    } else {
      console.log(`[DetailFetcher] 📝 job_urls.json 无需更新，仍剩 ${oldList.length} 条`);
    }
  } catch (err) {
    console.error('[DetailFetcher] ⚠️ 更新 job_urls.json 失败:', err.message);
  }
};
// 完整 saveJobs 与 prisma.js 保持一致
const saveJobs = async (jobs) => {
  let retryCount = 0;
  const maxRetries = 3;

  console.log(`[数据库] 开始保存 ${jobs.length} 个职位数据到数据库...`);

  while (retryCount < maxRetries) {
    try {
      console.log(`[数据库] 检查数据库连接 (尝试 ${retryCount + 1}/${maxRetries})...`);
      const isConnected = await checkDatabaseConnection();
      if (!isConnected) {
        console.error(`[数据库] ❌ 数据库连接失败`);
        throw new Error('数据库连接失败');
      }
      console.log(`[数据库] ✅ 数据库连接成功`);

      const jobsData = jobs.map(job => {
        const criteria = job.job_criteria || {};
        return {
          jobId: job.job_id,
          title: job.title,
          company: job.company,
          companyUrl: job.companyUrl || null,
          location: job.location,
          description: job.job_description,
          descriptionFallback: job.job_description_fallback,
          url: job.link,
          salary: job.salary_range,
          salaryNumeric: job.salary_numeric || null,
          postedAt: job.posted_date_attr ? new Date(job.posted_date_attr) : null,
          postedText: job.posted_text,
          applicantsCount: job.applicants_count,
          seniority: job.seniority || criteria['Seniority level'] || null,
          employmentType: job.employment_type || criteria['Employment type'] || null,
          jobFunction: job.job_function || criteria['Job function'] || null,
          industries: job.industries || criteria['Industries'] || null,
          isRemote: typeof job.is_remote === 'boolean' ? job.is_remote : true,
          refId: job.ref_id || null,
        };
      });

      // 过滤无效日期
      const validJobsData = jobsData.filter(job => {
        if (job.postedAt && isNaN(job.postedAt.getTime())) {
          job.postedAt = null;
        }
        return true;
      });

      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < validJobsData.length; i += batchSize) {
        batches.push(validJobsData.slice(i, i + batchSize));
      }

      console.log(`[数据库] 将数据分为 ${batches.length} 个批次进行保存`);

      const results = [];
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`[数据库] 开始处理第 ${i + 1}/${batches.length} 批次，包含 ${batch.length} 个职位...`);
        try {
          const batchResult = await prisma.$transaction(async (tx) => {
            const ops = batch.map(job => {
              const updateData = {
                ...(job.title && { title: job.title }),
                ...(job.company && { company: job.company }),
                ...(job.companyUrl && { companyUrl: job.companyUrl }),
                ...(job.location && { location: job.location }),
                ...(job.description && job.description !== '未找到描述' && { description: job.description }),
                ...(job.descriptionFallback && job.descriptionFallback !== '未找到描述' && { descriptionFallback: job.descriptionFallback }),
                ...(job.salary && job.salary !== '未找到' && { salary: job.salary }),
                ...(job.salaryNumeric && { salaryNumeric: job.salaryNumeric }),
                ...(job.postedAt && { postedAt: job.postedAt }),
                ...(job.postedText && { postedText: job.postedText }),
                ...(job.applicantsCount && job.applicantsCount !== '未找到' && { applicantsCount: job.applicantsCount }),
                ...(job.seniority && { seniority: job.seniority }),
                ...(job.employmentType && { employmentType: job.employmentType }),
                ...(job.jobFunction && { jobFunction: job.jobFunction }),
                ...(job.industries && { industries: job.industries }),
                ...(typeof job.isRemote === 'boolean' && { isRemote: job.isRemote }),
                ...(job.refId && { refId: job.refId }),
                searchCount: { increment: 1 },
                lastSearchedAt: new Date(),
              };
              return tx.job.upsert({
                where: { jobId: job.jobId },
                update: updateData,
                create: {
                  ...job,
                  id: generateCustomId(),
                  searchCount: 1,
                  lastSearchedAt: new Date(),
                },
              });
            });
            return await Promise.all(ops);
          }, { timeout: 15000 });
          console.log(`[数据库] ✅ 第 ${i + 1}/${batches.length} 批次保存成功`);
          results.push(batchResult);
        } catch (batchErr) {
          console.error(`[数据库] ❌ 第 ${i + 1}/${batches.length} 批次保存失败:`, batchErr);
          throw batchErr;
        }
      }

      console.log(`[数据库] ✅ 所有数据保存完成，共保存 ${results.flat().length} 个职位`);
      // 检测完整数据并更新 job_urls.json
      try {
        const completedIds = jobs.filter(isJobComplete).map(j => j.job_id || j.jobId);
        appendDoneJobIds(completedIds);
        removeCompletedFromJobUrls(completedIds);
      } catch (e) {
        console.error('[数据库] 更新 job_urls.json 时出错:', e.message);
      }
      return results.flat();
    } catch (err) {
      console.error(`[数据库] ❌ 尝试 ${retryCount + 1}/${maxRetries} 失败:`, err);
      retryCount++;
      if (retryCount < maxRetries) {
        const wait = 1000 * retryCount;
        console.log(`[数据库] 将在 ${wait / 1000} 秒后重试...`);
        await new Promise(res => setTimeout(res, wait));
      } else {
        console.error(`[数据库] ❌ 已重试 ${maxRetries} 次，全部失败`);
      }
    }
  }
  return [];
};

// --- 与 taskManager.js 相同的延迟配置 -----------------
const scrapingConfig = {
  pageLoadDelay:  { min: 50,  max: 100 },
  jobIntervalDelay: { min: 100, max: 200, factor: 500 },
  navigationTimeout: 30_000,
};
switch (process.env.SCRAPE_SPEED) {
  case 'fast':
    Object.assign(scrapingConfig, {
      pageLoadDelay: { min: 20,  max: 50 },
      jobIntervalDelay: { min: 50, max: 100, factor: 300 },
    });
    break;
  case 'safe':
    Object.assign(scrapingConfig, {
      pageLoadDelay: { min: 200, max: 400 },
      jobIntervalDelay: { min: 500, max: 1_000, factor: 800 },
    });
    break;
}

const randWait = (a, b) => new Promise(r => setTimeout(r, Math.random() * (b - a) + a));
const appendFailed = arr => {
  const prev = fs.existsSync(failedPath) ? JSON.parse(fs.readFileSync(failedPath, 'utf8')) : [];
  fs.writeFileSync(failedPath, JSON.stringify([...prev, ...arr], null, 2));
  console.log(`[DetailFetcher] 💾 已追加 ${arr.length} 条到 ${failedPath}`);
};

/**
 * 抓取职位详情（重构版）
 * @param {import('playwright').Page} page
 * @param {object} meta         // 来自列表页的元信息
 * @param {number} retries      // 失败重试次数（默认 2 次）
 */
async function scrapeDetail(page, meta, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // ---------- 导航 ----------
      await page.goto(meta.detailUrl, {
        waitUntil: 'domcontentloaded',
        timeout: scrapingConfig.navigationTimeout
      });
      await randWait(
        scrapingConfig.pageLoadDelay.min,
        scrapingConfig.pageLoadDelay.max
      );

      // ---------- 一次性抓取大部分字段 ----------
      const domData = await page.evaluate(() => {
        // DOM 辅助函数
        const q = (sel) => document.querySelector(sel);
        const qText = (sel) => q(sel)?.textContent.trim();
        const pickText = (sels) =>
          sels.map(qText).find((t) => !!t) || null;

        // 1) 基础字段
        const companyUrl = q('a.topcard__org-name-link')?.href || null;
        const location = pickText([
          'span.topcard__flavor--bullet',
          '.jobs-unified-top-card__subtitle-primary'
        ]);

        const primaryLink = q('a.topcard__link')?.href || null;
        const postedText = qText('span.posted-time-ago__text');
        const postedDateAttr =
          q('time.posted-time-ago__text')?.getAttribute('datetime') || null;

        // 2) 描述
        const description =
          pickText([
            '.show-more-less-html__markup',
            '.description__text',
            '.jobs-description-content__text',
            '.jobs-description__content',
            '.jobs-box__html-content',
            '.job-description'
          ]) || '未找到描述';

        // 3) 申请人数
        const applicantsRaw =
          pickText([
            '.num-applicants__caption',
            '.jobs-unified-top-card__applicant-count',
            '.jobs-company-hiring__applicant-count',
            '.job-analytics__applicant-count',
            '.applicant-count'
          ]) || '未找到';
        const applicantsCount = applicantsRaw.replace(/[^\d,.]+/g, '');

        // 4) 薪资
        const salaryRaw =
          pickText([
            '.compensation__salary',
            '.jobs-unified-top-card__salary-details',
            '.job-details-jobs-unified-top-card__job-insight',
            '.salary-range',
            '.job-salary'
          ]) || '未找到';

        // 5) 职位标准
        const criteriaNodes = [
          ...document.querySelectorAll(
            '.description__job-criteria-item,' +
              '.jobs-description-details__list-item,' +
              '.jobs-unified-top-card__job-insight,' +
              '.job-criteria-item'
          )
        ];
        const criteria = {};
        criteriaNodes.forEach((node) => {
          const header = node
            .querySelector(
              '.description__job-criteria-subheader,' +
                'h3,' +
                '.job-criteria-subheader,' +
                '.job-insight-label'
            )
            ?.textContent.trim()
            .toLowerCase();
          const value = node
            .querySelector(
              '.description__job-criteria-text,' +
                'span:not(h3),' +
                '.job-criteria-text,' +
                '.job-insight-value'
            )
            ?.textContent.trim();
          if (header && value) criteria[header] = value;
        });

        return {
          companyUrl,
          location,
          primaryLink,
          postedText,
          postedDateAttr,
          description,
          applicantsCount,
          salaryRaw,
          criteria
        };
      });

      // ---------- 后处理 ----------
      const salary = domData.salaryRaw;
      let salaryNumeric = null;
      if (salary && salary !== '未找到') {
        try {
          salaryNumeric = await convertSalaryToUSD(salary);
          if (typeof salaryNumeric !== 'number' || isNaN(salaryNumeric))
            salaryNumeric = null;
        } catch (_) {}
      }

      const seniority = domData.criteria['seniority level'] || null;
      const employmentType = domData.criteria['employment type'] || null;
      const jobFunction = domData.criteria['job function'] || null;
      const industries = domData.criteria['industries'] || null;

      // ---------- 是否远程 ----------
      let isRemote = false;
      try {
        const bodyText = (
          await page.evaluate(() =>
            document.body.textContent.toLowerCase()
          )
        ).replace(/\s+/g, ' ');
        isRemote = /(remote|远程|work from home|télétravail|homeoffice|remoto)/.test(
          bodyText
        );
      } catch (_) {}

      // ---------- Fallback with meta ----------
      const locationFinal = domData.location || meta.location || null;
      const applicantsFinal =
        domData.applicantsCount || meta.applicantsCount || '未找到';
      const postedTextFinal = domData.postedText || meta.postedText || null;
      const postedDateAttrFinal =
        domData.postedDateAttr || meta.postedAt || null;

      // ---------- 结果 ----------
      return {
        job_id: meta.jobId,
        ref_id: meta.refId || '',
        title: meta.title,
        company: meta.company,
        companyUrl: domData.companyUrl,
        location: locationFinal,
        link:
          domData.primaryLink ||
          `https://www.linkedin.com/jobs/view/${meta.jobId}`,
        detail_url: meta.detailUrl,
        job_description: domData.description,
        job_description_fallback: domData.description,
        applicants_count: applicantsFinal,
        salary_range: salary,
        salary_numeric: salaryNumeric,
        posted_date_attr: postedDateAttrFinal,
        posted_text: postedTextFinal,
        is_remote: isRemote,
        job_criteria: domData.criteria,
        seniority,
        employment_type: employmentType,
        job_function: jobFunction,
        industries
      };
    } catch (err) {
      // ---------- retry ----------
      if (attempt < retries) {
        console.warn(
          `[DetailFetcher] attempt ${attempt + 1} failed, retrying...`,
          err.message
        );
        continue;
      }
      console.error('[DetailFetcher] ❌ 最终失败:', err.message);
      throw err; // 抛给上层 appendFailed
    } finally {
      // 若在同一 page 循环使用，可略过
      // await page.close().catch(() => {});
    }
  }
}

function appendDoneJobIds(ids) {
  if (!ids.length) return;
  const donePath = path.join(projectRoot, 'data', 'done_job_ids.json');
  let prev = [];
  if (fs.existsSync(donePath)) {
    try {
      prev = JSON.parse(fs.readFileSync(donePath, 'utf8'));
    } catch (e) {
      prev = [];
    }
  }
  // 去重合并
  const merged = Array.from(new Set([...prev, ...ids]));
  fs.writeFileSync(donePath, JSON.stringify(merged, null, 2));
  console.log(`[DetailFetcher] 📥 已追加写入 ${ids.length} 个 job_id 到 ${donePath}，共 ${merged.length} 条`);
}

// ------------------ 主流程 -------------------------
(async () => {
  const projectRoot = getProjectRoot();
  const argPath     = process.argv[2];
  const jsonPath    = argPath
    ? (path.isAbsolute(argPath) ? argPath : path.join(projectRoot, argPath))
    : path.join(projectRoot, 'data', 'job_urls.json');
  jobUrlsPath = jsonPath;
  if (!fs.existsSync(jsonPath)) {
    console.error(`[DetailFetcher] ❌ 文件不存在: ${jsonPath}`); process.exit(1);
  }
  const jobs = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).reverse();
  console.log(`[DetailFetcher] 将处理 ${jobs.length} 条职位详情`);

  const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    viewport:{width:1200,height:800},
    userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const batch=[], successes=[];
  const BATCH_SIZE=50;

  for (const [idx,meta] of jobs.entries()) {
    try {
      const detail = await scrapeDetail(page, meta);
      console.log(`[DetailFetcher] ✅ 抓取成功 ${detail.job_id} - ${detail.title}`);
      successes.push(detail); batch.push(detail);
    } catch (e) {
      console.error(`[DetailFetcher] ❌ 抓取失败 ${meta.jobId||''}: ${e.message}`); appendFailed([meta]);
    }

    // if (batch.length>=BATCH_SIZE) {
    //   try { await saveJobs(batch); } catch(e){ console.error('[DetailFetcher] ❌ 批次保存失败:',e.message); appendFailed(batch); }
    //   batch.length=0;
    // }
    if (batch.length >= BATCH_SIZE) {
      // 输出本批次所有不完整 job 及具体不合格字段
      batch.forEach(job => {
        if (!isJobComplete(job)) {
          // 检查每个字段是否缺失，并输出详细原因
          const incompleteFields = [];
          if (!job.job_id) incompleteFields.push('job_id');
          if (!job.title || job.title === '未知职位') incompleteFields.push('title');
          if (!job.company || job.company === '未知公司') incompleteFields.push('company');
          if (!job.location || job.location === '未知地点') incompleteFields.push('location');
          if (!job.job_description || job.job_description === '未找到描述') incompleteFields.push('job_description');
          if (!job.link) incompleteFields.push('link');
          if (!job.posted_text || job.posted_text === '未知日期') incompleteFields.push('posted_text');
          if (!job.applicants_count || job.applicants_count === '未找到') incompleteFields.push('applicants_count');
          if (!job.seniority) incompleteFields.push('seniority');
          if (!job.employment_type) incompleteFields.push('employment_type');
          if (!job.industries) incompleteFields.push('industries');
          console.log('不完整的 job:', {
            id: job.job_id || job.jobId,
            title: job.title,
            company: job.company,
            location: job.location,
            incompleteFields,
            detailUrl: job.detail_url || job.detailUrl // 兼容旧/新字段
          });
        }
      });
    
      const completeJobs = batch.filter(isJobComplete);
      if (completeJobs.length > 0) {
        try {
          await saveJobs(completeJobs);
        } catch (e) {
          console.error('[DetailFetcher] ❌ 批次保存失败:', e.message);
          appendFailed(completeJobs);
        }
      }
      batch.length = 0;
    }
    const base = Math.random()*(scrapingConfig.jobIntervalDelay.max-scrapingConfig.jobIntervalDelay.min)+scrapingConfig.jobIntervalDelay.min;
    const fac = Math.max(0.5,1-jobs.length/scrapingConfig.jobIntervalDelay.factor);
    await randWait(base*fac, base*fac+50);
  }
  if (batch.length) {
    batch.forEach(job => {
      if (!isJobComplete(job)) {
        // 检查每个字段是否缺失，并输出详细原因
        const incompleteFields = [];
        if (!job.job_id) incompleteFields.push('job_id');
        if (!job.title || job.title === '未知职位') incompleteFields.push('title');
        if (!job.company || job.company === '未知公司') incompleteFields.push('company');
        if (!job.location || job.location === '未知地点') incompleteFields.push('location');
        if (!job.job_description || job.job_description === '未找到描述') incompleteFields.push('job_description');
        if (!job.link) incompleteFields.push('link');
        if (!job.posted_text || job.posted_text === '未知日期') incompleteFields.push('posted_text');
        if (!job.applicants_count || job.applicants_count === '未找到') incompleteFields.push('applicants_count');
        if (!job.seniority) incompleteFields.push('seniority');
        if (!job.employment_type) incompleteFields.push('employment_type');
        if (!job.industries) incompleteFields.push('industries');
        console.log('不完整的 job:', {
          id: job.job_id || job.jobId,
          title: job.title,
          company: job.company,
          location: job.location,
          incompleteFields,
          detailUrl: job.detail_url || job.detailUrl // 兼容旧/新字段
        });
      }
    });
    const completeJobs = batch.filter(isJobComplete);
    if (completeJobs.length > 0) {
      try {
        await saveJobs(completeJobs);
      } catch (e) {
        appendFailed(completeJobs);
      }
    }
  }
  console.log(`[DetailFetcher] 🎉 完成！共成功 ${successes.length}/${jobs.length} 条`);
  await browser.close(); await prisma.$disconnect();
  process.exit(0);
})();