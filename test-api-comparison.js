// JobAPI 性能对比测试：优化前 vs 优化后
const axios = require('axios');
const { testOptimizedSearch } = require('./test-job-api');

// 原始版本的简单实现 (模拟你之前的代码)
async function testOriginalAPI() {
  console.log('📡 测试原始API性能...');
  
  const startTime = Date.now();
  
  try {
    const response = await axios.get(
      'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=frontend%20developer&location=Worldwide&start=0',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      }
    );
    
    const totalTime = Date.now() - startTime;
    
    const cheerio = require('cheerio');
    const $ = cheerio.load(response.data);
    const jobCount = $('li').filter((_, li) => {
      return $(li).find('div.base-card').attr('data-entity-urn');
    }).length;
    
    return {
      success: true,
      jobCount,
      totalTime,
      features: {
        delayManagement: false,
        antiDetection: false,
        adaptiveDelay: false,
        performanceTracking: false
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      totalTime: Date.now() - startTime,
      features: {
        delayManagement: false,
        antiDetection: false,
        adaptiveDelay: false,
        performanceTracking: false
      }
    };
  }
}

async function runComparison() {
  console.log('🎯 === JobAPI 性能对比测试 ===\n');
  
  console.log('🔵 测试 1: 原始API版本');
  console.log('─'.repeat(50));
  const originalResult = await testOriginalAPI();
  
  console.log(`结果: ${originalResult.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`职位数: ${originalResult.jobCount || 0}`);
  console.log(`耗时: ${originalResult.totalTime}ms`);
  console.log(`功能: 基础请求\n`);
  
  console.log('🟢 测试 2: 优化后版本');
  console.log('─'.repeat(50));
  const optimizedResult = await testOptimizedSearch();
  
  console.log('\n🏆 === 对比结果 ===');
  console.log('─'.repeat(50));
  
  if (originalResult.success && optimizedResult.success) {
    const timeImprovement = originalResult.totalTime - optimizedResult.performance.totalTime;
    const timePercent = ((timeImprovement / originalResult.totalTime) * 100).toFixed(1);
    
    console.log('📊 性能对比:');
    console.log(`   原始版本: ${originalResult.totalTime}ms`);
    console.log(`   优化版本: ${optimizedResult.performance.totalTime}ms`);
    console.log(`   时间${timeImprovement > 0 ? '节省' : '增加'}: ${Math.abs(timeImprovement)}ms (${Math.abs(timePercent)}%)`);
    console.log(`   职位获取: ${originalResult.jobCount} → ${optimizedResult.jobCount}`);
  }
  
  console.log('\n🔧 功能对比:');
  console.log('┌─────────────────────────────┬────────────┬────────────┐');
  console.log('│ 功能                        │ 原始版本   │ 优化版本   │');
  console.log('├─────────────────────────────┼────────────┼────────────┤');
  console.log('│ 基础爬取                    │     ✅     │     ✅     │');
  console.log('│ 智能延迟管理                │     ❌     │     ✅     │');
  console.log('│ 反反爬检测                  │     ❌     │     ✅     │');
  console.log('│ 自适应调整                  │     ❌     │     ✅     │');
  console.log('│ 性能监控                    │     ❌     │     ✅     │');
  console.log('│ 详情页支持                  │     ❌     │     ✅     │');
  console.log('│ 错误重试机制                │     ❌     │     ✅     │');
  console.log('│ 数据提取优化                │     ❌     │     ✅     │');
  console.log('└─────────────────────────────┴────────────┴────────────┘');
  
  console.log('\n🎯 推荐建议:');
  console.log('✅ 建议使用优化版本，因为:');
  console.log('   • 更好的反反爬能力，降低被封风险');
  console.log('   • 智能延迟管理，自适应调整请求频率');
  console.log('   • 完整的性能监控和错误处理');
  console.log('   • 支持职位详情获取');
  console.log('   • 更稳定的长期运行能力');
  
  if (optimizedResult.delayManagerStats) {
    console.log(`\n📈 当前延迟管理状态:`);
    console.log(`   模式: ${optimizedResult.delayManagerStats.profile}`);
    console.log(`   成功率: ${optimizedResult.delayManagerStats.successRate}`);
    console.log(`   平均响应: ${optimizedResult.delayManagerStats.avgResponseTime}`);
  }
}

if (require.main === module) {
  runComparison().catch(console.error);
}

module.exports = { runComparison, testOriginalAPI };