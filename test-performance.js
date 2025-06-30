// 直接性能对比测试
const { searchLinkedInJobsFast, searchNoDelay } = require('./utils/linkedinAPI-fast');

async function performanceTest() {
  console.log('🚀 LinkedIn API 性能优化测试\n');
  
  const testCases = [
    { keyword: 'frontend', location: 'Worldwide' },
    { keyword: 'react', location: 'United States' }
  ];
  
  for (const testCase of testCases) {
    console.log(`📊 测试: ${testCase.keyword} @ ${testCase.location}`);
    console.log('='.repeat(50));
    
    try {
      // 1. 带延迟版本 (fast模式)
      console.log('🔄 测试 1: 快速模式 (最小延迟)');
      const result1 = await searchLinkedInJobsFast(testCase.keyword, testCase.location);
      console.log(`   结果: ${result1.jobs.length} 个职位`);
      console.log(`   性能: 总时间 ${result1.performance.totalTime}ms, 网络 ${result1.performance.networkTime}ms, 延迟 ${result1.performance.delayTime}ms`);
      console.log('');
      
      // 等待2秒
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 2. 无延迟版本 (仅网络时间)  
      console.log('⚡ 测试 2: 无延迟模式 (纯网络时间)');
      const result2 = await searchNoDelay(testCase.keyword, testCase.location);
      console.log(`   结果: ${result2.jobs.length} 个职位`);
      console.log(`   性能: 总时间 ${result2.performance.totalTime}ms, 网络 ${result2.performance.networkTime}ms, 延迟 ${result2.performance.delayTime}ms`);
      console.log('');
      
      // 性能对比
      const timeSaved = result1.performance.totalTime - result2.performance.totalTime;
      const improvement = ((timeSaved / result1.performance.totalTime) * 100).toFixed(1);
      
      console.log(`💡 性能对比:`);
      console.log(`   时间节省: ${timeSaved}ms`);
      console.log(`   改进幅度: ${improvement}%`);
      console.log(`   纯网络时间相近: ${Math.abs(result1.performance.networkTime - result2.performance.networkTime)}ms 差异`);
      
    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('🎯 结论:');
  console.log('- 主要时间消耗在网络请求 (~1000-1200ms)');
  console.log('- 延迟时间是额外开销 (100-300ms 快速模式)');
  console.log('- 无延迟版本风险更高，但速度最快');
  console.log('- 建议生产环境使用快速模式 (100-300ms 延迟)');
}

if (require.main === module) {
  performanceTest().catch(console.error);
}