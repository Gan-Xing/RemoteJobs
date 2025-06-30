// linkedin_jobs_optimized.js
const axios = require('axios');
const cheerio = require('cheerio');

// 配置参数
const keyword = 'frontend';
const location = 'Worldwide';
const start = 0;

// 创建模拟真实浏览器的 axios 实例
const linkedinClient = axios.create({
  timeout: 30000, // 30秒超时
  headers: {
    // 完整的浏览器请求头
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

// 请求延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 随机延迟（模拟人类行为） - 优化为更短延迟
const randomDelay = () => delay(Math.random() * 600 + 200); // 200-800ms随机延迟

async function getJobList() {
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&start=${start}`;
  
  console.log(`🔍 正在搜索: ${keyword} @ ${location} (起始位置: ${start})`);
  
  try {
    // 添加随机延迟
    await randomDelay();
    
    const startTime = Date.now();
    const resp = await linkedinClient.get(url);
    const requestTime = Date.now() - startTime;
    
    console.log(`⏱️  请求耗时: ${requestTime}ms`);
    console.log(`📊 响应状态: ${resp.status}`);
    console.log(`📏 响应大小: ${resp.data.length} 字符`);
    
    const html = resp.data;
    const $ = cheerio.load(html);
    const jobs = [];
    
    $('li').each((i, li) => {
      const $li = $(li);
      const cardDiv = $li.find('div.base-card').first();
      
      if (cardDiv.length === 0) return;
      
      const entityUrn = cardDiv.attr('data-entity-urn');
      const refId = cardDiv.attr('data-reference-id');
      
      if (!entityUrn) return;
      
      const id = entityUrn.split(':').pop();
      const title = $li.find('.base-search-card__title').text().trim();
      const companyEl = $li.find('.base-search-card__subtitle a');
      const company = companyEl.length > 0 ? companyEl.text().trim() : $li.find('.base-search-card__subtitle').text().trim();
      const location = $li.find('.job-search-card__location').text().trim();
      const jobLink = $li.find('a.base-card__full-link').attr('href');
      const postedEl = $li.find('time.job-search-card__listdate');
      const postedDate = postedEl.attr('datetime');
      const postedText = postedEl.text().trim();
      
      if (id && title) {
        jobs.push({ 
          id, 
          title, 
          company, 
          location,
          jobLink,
          postedDate,
          postedText,
          refId: refId ? refId.trim() : null
        });
      }
    });
    
    console.log(`✅ 成功解析 ${jobs.length} 个职位`);
    return jobs;
    
  } catch (error) {
    console.error(`❌ 获取职位列表失败:`, error.message);
    if (error.response) {
      console.error(`   状态码: ${error.response.status}`);
      console.error(`   响应头:`, error.response.headers);
    }
    throw error;
  }
}

async function getJobDetail(jobId, refId = null) {
  const baseUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
  const url = refId ? `${baseUrl}?refId=${encodeURIComponent(refId)}` : baseUrl;
  
  console.log(`🔍 获取职位详情: ${jobId}`);
  
  try {
    // 添加随机延迟
    await randomDelay();
    
    const startTime = Date.now();
    const resp = await linkedinClient.get(url);
    const requestTime = Date.now() - startTime;
    
    console.log(`⏱️  详情请求耗时: ${requestTime}ms`);
    
    const html = resp.data;
    const $ = cheerio.load(html);
    
    // 提取详细信息
    const description = $('.show-more-less-html__markup, .description__text, .jobs-description-content__text').first().text().trim();
    const salaryEl = $('.compensation__salary, .jobs-unified-top-card__salary-details').first();
    const salary = salaryEl.length > 0 ? salaryEl.text().trim() : null;
    const applicantsEl = $('span.num-applicants__caption, .jobs-unified-top-card__applicant-count').first();
    const applicants = applicantsEl.length > 0 ? applicantsEl.text().trim() : null;
    
    // 提取职位标准信息
    const criteria = {};
    $('.description__job-criteria-item, .jobs-description-details__list-item').each((i, item) => {
      const $item = $(item);
      const header = $item.find('.description__job-criteria-subheader, h3').text().trim();
      const text = $item.find('.description__job-criteria-text, span:not(h3)').text().trim();
      if (header && text) {
        criteria[header] = text;
      }
    });
    
    console.log(`✅ 成功获取职位详情`);
    
    return {
      jobId,
      description: description || '未找到描述',
      salary: salary || '未找到薪资信息',
      applicants: applicants || '未找到申请人数',
      criteria,
      rawHtml: html.slice(0, 500) + '...' // 保留原始HTML片段
    };
    
  } catch (error) {
    console.error(`❌ 获取职位详情失败 (${jobId}):`, error.message);
    if (error.response) {
      console.error(`   状态码: ${error.response.status}`);
    }
    throw error;
  }
}

// 更高级的批量获取函数
async function getBatchJobDetails(jobs, maxConcurrent = 3) {
  console.log(`🚀 开始批量获取 ${jobs.length} 个职位详情 (并发数: ${maxConcurrent})`);
  
  const results = [];
  const errors = [];
  
  // 分批处理，避免并发过多
  for (let i = 0; i < jobs.length; i += maxConcurrent) {
    const batch = jobs.slice(i, i + maxConcurrent);
    console.log(`📦 处理批次 ${Math.floor(i/maxConcurrent) + 1}/${Math.ceil(jobs.length/maxConcurrent)}`);
    
    const batchPromises = batch.map(async (job) => {
      try {
        const detail = await getJobDetail(job.id, job.refId);
        return { ...job, ...detail, success: true };
      } catch (error) {
        console.error(`❌ 获取职位详情失败 (${job.id}): ${error.message}`);
        errors.push({ job, error: error.message });
        return { ...job, success: false, error: error.message };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // 批次间延迟
    if (i + maxConcurrent < jobs.length) {
      await delay(2000); // 批次间等待2秒
    }
  }
  
  console.log(`✅ 批量获取完成: 成功 ${results.filter(r => r.success).length}, 失败 ${errors.length}`);
  return { results, errors };
}

// 测试不同参数的函数
async function testDifferentParams() {
  const testCases = [
    { keyword: 'frontend', location: 'United States' },
    { keyword: 'react', location: 'Europe' },
    { keyword: 'python', location: 'Worldwide' }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 测试参数: ${testCase.keyword} @ ${testCase.location}`);
    try {
      // 临时更新全局参数
      Object.assign(global, testCase);
      const jobs = await getJobList();
      console.log(`   结果: 找到 ${jobs.length} 个职位`);
    } catch (error) {
      console.log(`   结果: 失败 - ${error.message}`);
    }
    await delay(3000); // 测试间隔
  }
}

async function main() {
  console.log('🎯 === LinkedIn 职位数据获取测试 ===\n');
  
  try {
    // 1. 获取职位列表
    console.log('1️⃣ 获取职位列表...');
    const startTime = Date.now();
    const jobs = await getJobList();
    const listTime = Date.now() - startTime;
    
    console.log(`\n📊 职位列表获取结果:`);
    console.log(`   总耗时: ${listTime}ms`);
    console.log(`   找到职位: ${jobs.length} 个`);
    
    if (jobs.length === 0) {
      console.log('❌ 没有找到职位，可能是参数问题或被限制');
      return;
    }
    
    // 2. 显示前3个职位的基本信息
    console.log(`\n📋 前3个职位预览:`);
    jobs.slice(0, 3).forEach((job, i) => {
      console.log(`   #${i+1}: [${job.title}] @ ${job.company}`);
      console.log(`        位置: ${job.location || '未知'}`);
      console.log(`        发布: ${job.postedText || '未知'}`);
      console.log(`        ID: ${job.id}`);
      console.log(`        链接: ${job.jobLink || '无'}`);
      console.log('');
    });
    
    // 3. 获取第一个职位的详细信息
    if (jobs.length > 0) {
      console.log('2️⃣ 获取职位详情...');
      const detailStartTime = Date.now();
      
      try {
        const firstJob = jobs[0];
        const detail = await getJobDetail(firstJob.id, firstJob.refId);
        const detailTime = Date.now() - detailStartTime;
        
        console.log(`\n📋 职位详情 (${firstJob.title}):`);
        console.log(`   获取耗时: ${detailTime}ms`);
        console.log(`   描述长度: ${detail.description.length} 字符`);
        console.log(`   薪资信息: ${detail.salary}`);
        console.log(`   申请人数: ${detail.applicants}`);
        console.log(`   职位标准: ${Object.keys(detail.criteria).length} 项`);
        
        // 显示职位标准信息
        if (Object.keys(detail.criteria).length > 0) {
          console.log(`\n   详细标准:`);
          Object.entries(detail.criteria).forEach(([key, value]) => {
            console.log(`     ${key}: ${value}`);
          });
        }
        
      } catch (error) {
        console.error(`❌ 获取详情失败: ${error.message}`);
      }
    }
    
    // 4. 性能对比测试
    console.log('\n3️⃣ 性能对比测试...');
    if (jobs.length >= 3) {
      const testJobs = jobs.slice(0, 3);
      const { results, errors } = await getBatchJobDetails(testJobs, 2);
      
      console.log(`\n📊 批量获取结果:`);
      console.log(`   成功: ${results.filter(r => r.success).length}/${testJobs.length}`);
      console.log(`   失败: ${errors.length}/${testJobs.length}`);
      
      const successfulResults = results.filter(r => r.success);
      if (successfulResults.length > 0) {
        const avgTime = successfulResults.reduce((sum, r) => sum + (r.requestTime || 0), 0) / successfulResults.length;
        console.log(`   平均耗时: ${avgTime.toFixed(0)}ms`);
      }
    }
    
  } catch (error) {
    console.error(`\n❌ 主流程失败:`, error.message);
    if (error.response) {
      console.error(`   HTTP状态: ${error.response.status}`);
      console.error(`   响应头:`, JSON.stringify(error.response.headers, null, 2));
    }
  }
  
  console.log('\n🏁 测试完成');
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

// 导出函数供其他模块使用
module.exports = {
  getJobList,
  getJobDetail,
  getBatchJobDetails,
  linkedinClient
};