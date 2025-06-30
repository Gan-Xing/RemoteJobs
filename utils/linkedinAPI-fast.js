// LinkedIn API 快速版本 - 基于你的成功测试，最小延迟
const axios = require('axios');
const cheerio = require('cheerio');
const { getDelayManager } = require('./delayManager');

// 获取延迟管理器 - 使用快速模式
const delayManager = getDelayManager({ profile: 'fast', adaptive: true });

// 创建优化的 LinkedIn 客户端
const linkedinClient = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive',
    'DNT': '1'
  }
});

/**
 * 快速搜索 LinkedIn 职位 - 最小延迟版本
 * @param {string} keyword - 搜索关键词
 * @param {string} location - 地理位置
 * @param {number} start - 起始位置
 * @param {Object} options - 额外选项
 * @returns {Promise<Array>} 职位列表
 */
async function searchLinkedInJobsFast(keyword, location = 'Worldwide', start = 0, options = {}) {
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&start=${start}`;
  
  console.log(`[LinkedIn API Fast] 搜索: ${keyword} @ ${location} (起始: ${start})`);
  
  const requestStartTime = Date.now();
  let networkTime = 0;
  let totalTime = 0;
  
  try {
    // 根据选项决定是否添加延迟
    let delayTime = 0;
    if (!options.noDelay) {
      delayTime = await delayManager.delay('search');
    }
    
    const networkStartTime = Date.now();
    const response = await linkedinClient.get(url);
    networkTime = Date.now() - networkStartTime;
    
    console.log(`[LinkedIn API Fast] 网络请求: ${networkTime}ms, 状态: ${response.status}`);
    
    const $ = cheerio.load(response.data);
    const jobs = parseJobList($);
    
    totalTime = Date.now() - requestStartTime;
    
    // 记录请求结果用于自适应调整
    delayManager.recordRequest(true, networkTime, 'search');
    
    console.log(`[LinkedIn API Fast] 完成: 总时间 ${totalTime}ms (网络 ${networkTime}ms + 延迟 ${delayTime}ms), 找到 ${jobs.length} 个职位`);
    
    return {
      jobs,
      performance: {
        totalTime,
        networkTime,
        delayTime,
        jobCount: jobs.length
      }
    };
    
  } catch (error) {
    totalTime = Date.now() - requestStartTime;
    delayManager.recordRequest(false, totalTime, 'search');
    
    console.error(`[LinkedIn API Fast] 搜索失败 (${totalTime}ms):`, error.message);
    throw error;
  }
}

/**
 * 快速获取职位详细信息
 * @param {string} jobId - 职位ID
 * @param {string} refId - 引用ID
 * @param {Object} options - 额外选项
 * @returns {Promise<Object>} 职位详情
 */
async function getJobDetailFast(jobId, refId = null, options = {}) {
  const baseUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
  const url = refId ? `${baseUrl}?refId=${encodeURIComponent(refId)}` : baseUrl;
  
  console.log(`[LinkedIn API Fast] 获取详情: ${jobId}`);
  
  const requestStartTime = Date.now();
  let networkTime = 0;
  let totalTime = 0;
  
  try {
    // 根据选项决定是否添加延迟
    let delayTime = 0;
    if (!options.noDelay) {
      delayTime = await delayManager.delay('detail');
    }
    
    const networkStartTime = Date.now();
    const response = await linkedinClient.get(url);
    networkTime = Date.now() - networkStartTime;
    
    const $ = cheerio.load(response.data);
    const jobDetail = parseJobDetail($, jobId);
    
    totalTime = Date.now() - requestStartTime;
    
    // 记录请求结果
    delayManager.recordRequest(true, networkTime, 'detail');
    
    console.log(`[LinkedIn API Fast] 详情完成: 总时间 ${totalTime}ms (网络 ${networkTime}ms + 延迟 ${delayTime}ms)`);
    
    return {
      ...jobDetail,
      performance: {
        totalTime,
        networkTime,
        delayTime
      }
    };
    
  } catch (error) {
    totalTime = Date.now() - requestStartTime;
    delayManager.recordRequest(false, totalTime, 'detail');
    
    console.error(`[LinkedIn API Fast] 获取详情失败 (${jobId}, ${totalTime}ms):`, error.message);
    throw error;
  }
}

/**
 * 无延迟版本 - 最快速度 (仅用于测试)
 * @param {string} keyword 
 * @param {string} location 
 * @param {number} start 
 * @returns {Promise<Object>} 搜索结果
 */
async function searchNoDelay(keyword, location = 'Worldwide', start = 0) {
  return await searchLinkedInJobsFast(keyword, location, start, { noDelay: true });
}

/**
 * 批量获取职位详情 - 优化版本
 * @param {Array} jobs - 职位列表
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 批量结果
 */
async function batchGetJobDetailsFast(jobs, options = {}) {
  const {
    maxConcurrent = 3,
    noDelay = false,
    trackPerformance = true
  } = options;
  
  console.log(`[LinkedIn API Fast] 批量获取 ${jobs.length} 个职位详情 (并发: ${maxConcurrent}, 无延迟: ${noDelay})`);
  
  const startTime = Date.now();
  const results = [];
  const performanceData = {
    totalJobs: jobs.length,
    successCount: 0,
    failureCount: 0,
    totalTime: 0,
    networkTime: 0,
    delayTime: 0,
    batches: []
  };
  
  for (let i = 0; i < jobs.length; i += maxConcurrent) {
    const batch = jobs.slice(i, i + maxConcurrent);
    const batchNumber = Math.floor(i / maxConcurrent) + 1;
    const totalBatches = Math.ceil(jobs.length / maxConcurrent);
    
    console.log(`[LinkedIn API Fast] 处理批次 ${batchNumber}/${totalBatches} (${batch.length} 个职位)`);
    
    const batchStartTime = Date.now();
    
    const batchPromises = batch.map(async (job) => {
      try {
        const detail = await getJobDetailFast(job.job_id, job.ref_id, { noDelay });
        
        if (trackPerformance) {
          performanceData.networkTime += detail.performance.networkTime;
          performanceData.delayTime += detail.performance.delayTime;
        }
        
        return { ...job, ...detail, success: true };
      } catch (error) {
        console.error(`[LinkedIn API Fast] 批量获取详情失败 (${job.job_id}): ${error.message}`);
        return { ...job, success: false, error: error.message };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    const batchTime = Date.now() - batchStartTime;
    const batchSuccesses = batchResults.filter(r => r.success).length;
    
    performanceData.batches.push({
      batchNumber,
      jobs: batch.length,
      successes: batchSuccesses,
      time: batchTime
    });
    
    performanceData.successCount += batchSuccesses;
    performanceData.failureCount += (batch.length - batchSuccesses);
    
    console.log(`[LinkedIn API Fast] 批次 ${batchNumber} 完成: ${batchSuccesses}/${batch.length} 成功, ${batchTime}ms`);
    
    // 批次间延迟 (除非明确要求无延迟)
    if (!noDelay && i + maxConcurrent < jobs.length) {
      const batchDelayTime = await delayManager.delay('batch');
      performanceData.delayTime += batchDelayTime;
    }
  }
  
  performanceData.totalTime = Date.now() - startTime;
  
  console.log(`[LinkedIn API Fast] 批量获取完成: ${performanceData.successCount}/${jobs.length} 成功, 总耗时 ${performanceData.totalTime}ms`);
  
  if (trackPerformance) {
    console.log(`[LinkedIn API Fast] 性能分析:`);
    console.log(`  - 网络时间: ${performanceData.networkTime}ms`);
    console.log(`  - 延迟时间: ${performanceData.delayTime}ms`);
    console.log(`  - 处理时间: ${performanceData.totalTime - performanceData.networkTime - performanceData.delayTime}ms`);
    console.log(`  - 成功率: ${((performanceData.successCount / jobs.length) * 100).toFixed(1)}%`);
  }
  
  return {
    results: results.filter(r => r.success),
    errors: results.filter(r => !r.success),
    performance: performanceData,
    delayManagerStats: delayManager.getStats()
  };
}

// 解析函数 (复用之前的代码)
function parseJobList($) {
  const jobs = [];
  
  $('li').each((i, li) => {
    const $li = $(li);
    const cardDiv = $li.find('div.base-card').first();
    
    if (cardDiv.length === 0) return;
    
    const entityUrn = cardDiv.attr('data-entity-urn');
    const refId = cardDiv.attr('data-reference-id');
    
    if (!entityUrn) return;
    
    const jobData = {
      job_id: entityUrn.split(':').pop(),
      ref_id: refId ? refId.trim() : '',
      title: $li.find('.base-search-card__title').text().trim(),
      company: extractCompany($li),
      location: $li.find('.job-search-card__location').text().trim(),
      link: $li.find('a.base-card__full-link').attr('href'),
      ...extractPostingInfo($li)
    };
    
    if (jobData.job_id && jobData.title) {
      jobs.push(jobData);
    }
  });
  
  return jobs;
}

function parseJobDetail($, jobId) {
  return {
    job_description: extractDescription($),
    salary_range: extractSalary($),
    applicants_count: extractApplicants($),
    job_criteria: extractJobCriteria($),
    is_remote: detectRemoteWork($),
    ...extractJobStandards($)
  };
}

// 辅助函数 (复用之前的代码)
function extractCompany($li) {
  const companyEl = $li.find('.base-search-card__subtitle a');
  return companyEl.length > 0 
    ? companyEl.text().trim() 
    : $li.find('.base-search-card__subtitle').text().trim();
}

function extractPostingInfo($li) {
  const postedEl = $li.find('time.job-search-card__listdate');
  return {
    posted_date_attr: postedEl.attr('datetime'),
    posted_text: postedEl.text().trim()
  };
}

function extractDescription($) {
  const selectors = [
    '.show-more-less-html__markup',
    '.description__text',
    '.jobs-description-content__text'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      return element.text().trim();
    }
  }
  return '未找到描述';
}

function extractSalary($) {
  const selectors = [
    '.compensation__salary',
    '.jobs-unified-top-card__salary-details'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const salaryText = element.text().trim();
      if (salaryText && /[\$¥€£₹\d]/.test(salaryText)) {
        return salaryText;
      }
    }
  }
  return '未找到';
}

function extractApplicants($) {
  const selectors = [
    'span.num-applicants__caption',
    '.jobs-unified-top-card__applicant-count'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      return element.text().trim().replace(/[^\d,.]+/g, '') || '未找到';
    }
  }
  return '未找到';
}

function extractJobCriteria($) {
  const criteria = {};
  
  $('.description__job-criteria-item').each((i, item) => {
    const $item = $(item);
    const header = $item.find('.description__job-criteria-subheader').text().trim();
    const text = $item.find('.description__job-criteria-text').text().trim();
    if (header && text) {
      criteria[header] = text;
    }
  });
  
  return criteria;
}

function extractJobStandards($) {
  const criteria = extractJobCriteria($);
  
  let seniority = null;
  let employmentType = null;
  let jobFunction = null;
  let industries = null;
  
  Object.entries(criteria).forEach(([key, value]) => {
    const keyLower = key.toLowerCase();
    if (keyLower.includes('seniority') || keyLower.includes('级别')) {
      seniority = value;
    } else if (keyLower.includes('employment') || keyLower.includes('类型')) {
      employmentType = value;
    } else if (keyLower.includes('function') || keyLower.includes('职能')) {
      jobFunction = value;
    } else if (keyLower.includes('industries') || keyLower.includes('行业')) {
      industries = value;
    }
  });
  
  return {
    seniority,
    employment_type: employmentType,
    job_function: jobFunction,
    industries
  };
}

function detectRemoteWork($) {
  const pageText = $.text().toLowerCase();
  const remoteKeywords = ['remote', 'work from home', '远程', '在家工作'];
  return remoteKeywords.some(keyword => pageText.includes(keyword));
}

module.exports = {
  searchLinkedInJobsFast,
  getJobDetailFast,
  batchGetJobDetailsFast,
  searchNoDelay,
  linkedinClient,
  delayManager
};