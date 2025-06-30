// 测试JobAPI的优化功能
const axios = require('axios');

// 简单复制一个JobService的核心功能进行测试
const { getDelayManager } = require('./utils/delayManager');

// 创建优化的LinkedIn客户端
const createOptimizedClient = () => {
  const delayManager = getDelayManager({ profile: 'fast', adaptive: true });
  
  const client = axios.create({
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

  return { client, delayManager };
};

async function testOptimizedSearch() {
  console.log('🚀 测试优化后的LinkedIn搜索功能...\n');
  
  const { client, delayManager } = createOptimizedClient();
  
  // 测试参数
  const testParams = {
    keywords: 'frontend developer',
    location: 'Worldwide',
    start: 0
  };
  
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(testParams.keywords)}&location=${encodeURIComponent(testParams.location)}&start=${testParams.start}`;
  
  console.log(`📡 请求URL: ${url}\n`);
  
  const requestStartTime = Date.now();
  let networkTime = 0;
  let totalTime = 0;
  
  try {
    // 应用智能延迟
    console.log('⏳ 应用智能延迟...');
    const delayTime = await delayManager.delay('search');
    console.log(`   延迟时间: ${delayTime}ms\n`);
    
    // 发送请求
    console.log('📨 发送请求...');
    const networkStartTime = Date.now();
    const response = await client.get(url);
    networkTime = Date.now() - networkStartTime;
    
    console.log(`✅ 请求成功: 状态码 ${response.status}`);
    console.log(`   网络耗时: ${networkTime}ms`);
    console.log(`   响应大小: ${response.data.length} 字符\n`);
    
    // 解析数据 (简化版)
    const cheerio = require('cheerio');
    const $ = cheerio.load(response.data);
    const jobs = [];
    
    $('li').each((_, li) => {
      const base = $(li).find('div.base-card');
      const entityUrn = base.attr('data-entity-urn');
      const refId = base.attr('data-reference-id');
      
      if (!entityUrn) return;
      
      const id = entityUrn.split(':').pop();
      if (!id) return;

      jobs.push({
        id,
        refId: refId ? refId.trim() : null,
        title: $(li).find('.base-search-card__title').text().trim(),
        company: $(li).find('.base-search-card__subtitle').text().trim(),
        location: $(li).find('.job-search-card__location').text().trim(),
        postedAt: $(li).find('time.job-search-card__listdate').attr('datetime'),
      });
    });
    
    totalTime = Date.now() - requestStartTime;
    
    // 记录请求结果
    delayManager.recordRequest(true, networkTime, 'search');
    
    console.log('📊 解析结果:');
    console.log(`   找到职位: ${jobs.length} 个`);
    console.log(`   总耗时: ${totalTime}ms (网络 ${networkTime}ms + 延迟 ${delayTime}ms + 处理 ${totalTime - networkTime - delayTime}ms)\n`);
    
    // 显示前3个职位
    console.log('🔍 前3个职位预览:');
    jobs.slice(0, 3).forEach((job, i) => {
      console.log(`   ${i+1}. [${job.title}] @ ${job.company}`);
      console.log(`      位置: ${job.location || '未知'}`);
      console.log(`      ID: ${job.id}\n`);
    });
    
    // 延迟管理器统计
    console.log('📈 延迟管理器统计:');
    const stats = delayManager.getStats();
    console.log(`   配置模式: ${stats.profile}`);
    console.log(`   请求次数: ${stats.requests}`);
    console.log(`   成功率: ${stats.successRate}`);
    console.log(`   平均响应: ${stats.avgResponseTime}`);
    console.log(`   自适应: ${stats.adaptive ? '启用' : '关闭'}\n`);
    
    // 测试职位详情 (如果有职位的话)
    if (jobs.length > 0) {
      await testJobDetail(client, delayManager, jobs[0]);
    }
    
    return {
      success: true,
      jobCount: jobs.length,
      performance: {
        totalTime,
        networkTime,
        delayTime
      },
      delayManagerStats: stats
    };
    
  } catch (error) {
    totalTime = Date.now() - requestStartTime;
    delayManager.recordRequest(false, totalTime, 'search');
    
    console.error(`❌ 请求失败 (${totalTime}ms):`, error.message);
    
    if (error.response) {
      console.error(`   状态码: ${error.response.status}`);
      console.error(`   响应头: ${JSON.stringify(error.response.headers, null, 2)}`);
    }
    
    throw error;
  }
}

async function testJobDetail(client, delayManager, job) {
  console.log('🔍 测试职位详情获取...\n');
  
  const baseUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${job.id}`;
  const url = job.refId ? `${baseUrl}?refId=${encodeURIComponent(job.refId)}` : baseUrl;
  
  console.log(`📡 详情URL: ${url}\n`);
  
  const requestStartTime = Date.now();
  
  try {
    // 智能延迟
    const delayTime = await delayManager.delay('detail');
    console.log(`⏳ 详情延迟: ${delayTime}ms\n`);
    
    const networkStartTime = Date.now();
    const response = await client.get(url);
    const networkTime = Date.now() - networkStartTime;
    
    console.log(`✅ 详情请求成功: 状态码 ${response.status}`);
    console.log(`   网络耗时: ${networkTime}ms`);
    console.log(`   响应大小: ${response.data.length} 字符\n`);
    
    // 简单解析详情
    const cheerio = require('cheerio');
    const $ = cheerio.load(response.data);
    
    const description = $('.show-more-less-html__markup, .description__text').first().text().trim();
    const salary = $('.compensation__salary, .jobs-unified-top-card__salary-details').first().text().trim();
    
    console.log('📋 职位详情:');
    console.log(`   职位: ${job.title}`);
    console.log(`   公司: ${job.company}`);
    console.log(`   描述长度: ${description.length} 字符`);
    console.log(`   薪资信息: ${salary || '未找到'}\n`);
    
    const totalTime = Date.now() - requestStartTime;
    delayManager.recordRequest(true, networkTime, 'detail');
    
    console.log(`⏱️  详情总耗时: ${totalTime}ms\n`);
    
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    delayManager.recordRequest(false, totalTime, 'detail');
    
    console.error(`❌ 详情获取失败 (${totalTime}ms):`, error.message);
  }
}

// 运行测试
async function main() {
  console.log('🎯 === LinkedIn API 优化功能测试 ===\n');
  
  try {
    const result = await testOptimizedSearch();
    
    console.log('🎉 测试完成! 优化结果:');
    console.log(`   ✅ 成功获取 ${result.jobCount} 个职位`);
    console.log(`   ⚡ 总耗时: ${result.performance.totalTime}ms`);
    console.log(`   🛡️  反反爬措施: 已启用`);
    console.log(`   🧠 智能延迟: 已启用`);
    console.log(`   📊 自适应调整: 已启用\n`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testOptimizedSearch, createOptimizedClient };