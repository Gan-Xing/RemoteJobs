// LinkedIn 数据获取性能基准测试
const axios = require('axios');
const cheerio = require('cheerio');
const LinkedInScraper = require('./linkedin-api-advanced');

class PerformanceBenchmark {
  constructor() {
    this.results = {
      original: { times: [], errors: 0, success: 0 },
      optimized: { times: [], errors: 0, success: 0 },
      advanced: { times: [], errors: 0, success: 0 }
    };
    
    this.testCases = [
      { keyword: 'frontend', location: 'Worldwide' },
      { keyword: 'react', location: 'United States' },
      { keyword: 'python', location: 'Europe' }
    ];
  }
  
  // 原始简单版本 (你的初始代码)
  async originalMethod(keyword, location) {
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&start=0`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8'
    };
    
    const startTime = Date.now();
    try {
      const resp = await axios.get(url, { headers, timeout: 10000 });
      const endTime = Date.now();
      
      const $ = cheerio.load(resp.data);
      const jobCount = $('li').filter((i, el) => 
        $(el).find('div.base-card').attr('data-entity-urn')
      ).length;
      
      return {
        success: true,
        time: endTime - startTime,
        jobCount,
        method: 'original'
      };
    } catch (error) {
      return {
        success: false,
        time: Date.now() - startTime,
        error: error.message,
        method: 'original'
      };
    }
  }
  
  // 优化版本 (基于你的 job.js 改进)
  async optimizedMethod(keyword, location) {
    const client = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Chromium";v="118", "Google Chrome";v="118"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Connection': 'keep-alive'
      }
    });
    
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&start=0`;
    
    const startTime = Date.now();
    try {
      // 添加随机延迟模拟人类行为
      await this.delay(Math.random() * 1000 + 500);
      
      const resp = await client.get(url);
      const endTime = Date.now();
      
      const $ = cheerio.load(resp.data);
      const jobCount = $('li').filter((i, el) => 
        $(el).find('div.base-card').attr('data-entity-urn')
      ).length;
      
      return {
        success: true,
        time: endTime - startTime,
        jobCount,
        method: 'optimized'
      };
    } catch (error) {
      return {
        success: false,
        time: Date.now() - startTime,
        error: error.message,
        method: 'optimized'
      };
    }
  }
  
  // 高级版本 (使用 LinkedInScraper 类)
  async advancedMethod(keyword, location) {
    const scraper = new LinkedInScraper({
      maxRetries: 2,
      retryDelay: 1000,
      rateLimitDelay: { min: 500, max: 1500 }
    });
    
    const startTime = Date.now();
    try {
      const jobs = await scraper.searchJobs(keyword, location, 0);
      const endTime = Date.now();
      
      return {
        success: true,
        time: endTime - startTime,
        jobCount: jobs.length,
        method: 'advanced'
      };
    } catch (error) {
      return {
        success: false,
        time: Date.now() - startTime,
        error: error.message,
        method: 'advanced'
      };
    }
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async runSingleTest(method, keyword, location, testNumber) {
    console.log(`🧪 测试 ${testNumber}: ${method} - ${keyword} @ ${location}`);
    
    let result;
    switch (method) {
      case 'original':
        result = await this.originalMethod(keyword, location);
        break;
      case 'optimized':
        result = await this.optimizedMethod(keyword, location);
        break;
      case 'advanced':
        result = await this.advancedMethod(keyword, location);
        break;
    }
    
    // 记录结果
    this.results[method].times.push(result.time);
    if (result.success) {
      this.results[method].success++;
      console.log(`   ✅ 成功: ${result.time}ms, 找到 ${result.jobCount} 个职位`);
    } else {
      this.results[method].errors++;
      console.log(`   ❌ 失败: ${result.time}ms, 错误: ${result.error}`);
    }
    
    return result;
  }
  
  async runBenchmark() {
    console.log('🚀 开始 LinkedIn API 性能基准测试\n');
    console.log(`测试用例: ${this.testCases.length} 个`);
    console.log(`测试方法: original, optimized, advanced`);
    console.log(`每个方法运行: ${this.testCases.length} 次\n`);
    
    const methods = ['original', 'optimized', 'advanced'];
    
    for (const method of methods) {
      console.log(`\n📊 测试方法: ${method.toUpperCase()}`);
      console.log('='.repeat(50));
      
      for (let i = 0; i < this.testCases.length; i++) {
        const testCase = this.testCases[i];
        
        try {
          await this.runSingleTest(method, testCase.keyword, testCase.location, i + 1);
          
          // 测试间隔，避免被限制
          if (i < this.testCases.length - 1) {
            console.log(`   ⏱️  等待 3 秒...`);
            await this.delay(3000);
          }
        } catch (error) {
          console.error(`   💥 测试异常: ${error.message}`);
          this.results[method].errors++;
        }
      }
      
      // 方法间更长的等待时间
      if (method !== methods[methods.length - 1]) {
        console.log(`\n⏸️  方法间等待 5 秒...\n`);
        await this.delay(5000);
      }
    }
  }
  
  generateReport() {
    console.log('\n\n📈 === 性能测试报告 ===');
    console.log('='.repeat(60));
    
    const methods = ['original', 'optimized', 'advanced'];
    const reportData = [];
    
    methods.forEach(method => {
      const data = this.results[method];
      const totalTests = data.times.length;
      const successRate = ((data.success / totalTests) * 100).toFixed(1);
      const avgTime = data.times.length > 0 
        ? (data.times.reduce((a, b) => a + b, 0) / data.times.length).toFixed(0)
        : 0;
      const minTime = data.times.length > 0 ? Math.min(...data.times) : 0;
      const maxTime = data.times.length > 0 ? Math.max(...data.times) : 0;
      
      reportData.push({
        method: method.toUpperCase(),
        tests: totalTests,
        success: data.success,
        errors: data.errors,
        successRate: successRate + '%',
        avgTime: avgTime + 'ms',
        minTime: minTime + 'ms',
        maxTime: maxTime + 'ms'
      });
    });
    
    // 表格输出
    console.log('\\n📊 详细统计:');
    console.table(reportData);
    
    // 性能改进分析
    console.log('\\n🔍 性能改进分析:');
    if (reportData.length >= 3) {
      const original = this.results.original;
      const optimized = this.results.optimized;
      const advanced = this.results.advanced;
      
      const originalAvg = original.times.length > 0 
        ? original.times.reduce((a, b) => a + b, 0) / original.times.length 
        : 0;
      const optimizedAvg = optimized.times.length > 0 
        ? optimized.times.reduce((a, b) => a + b, 0) / optimized.times.length 
        : 0;
      const advancedAvg = advanced.times.length > 0 
        ? advanced.times.reduce((a, b) => a + b, 0) / advanced.times.length 
        : 0;
      
      if (originalAvg > 0) {
        const optimizedImprovement = ((originalAvg - optimizedAvg) / originalAvg * 100).toFixed(1);
        const advancedImprovement = ((originalAvg - advancedAvg) / originalAvg * 100).toFixed(1);
        
        console.log(`• 优化版本比原始版本快: ${optimizedImprovement}%`);
        console.log(`• 高级版本比原始版本快: ${advancedImprovement}%`);
      }
      
      const originalSuccess = (original.success / original.times.length * 100);
      const optimizedSuccess = (optimized.success / optimized.times.length * 100);
      const advancedSuccess = (advanced.success / advanced.times.length * 100);
      
      console.log(`• 成功率改进: ${originalSuccess.toFixed(1)}% → ${optimizedSuccess.toFixed(1)}% → ${advancedSuccess.toFixed(1)}%`);
    }
    
    // 推荐方案
    console.log('\\n💡 推荐方案:');
    const bestMethod = reportData.reduce((best, current) => {
      const currentScore = parseFloat(current.successRate) * 0.7 + 
                          (10000 / parseFloat(current.avgTime)) * 0.3;
      const bestScore = parseFloat(best.successRate) * 0.7 + 
                       (10000 / parseFloat(best.avgTime)) * 0.3;
      return currentScore > bestScore ? current : best;
    });
    
    console.log(`推荐使用: ${bestMethod.method} 方案`);
    console.log(`理由: 成功率 ${bestMethod.successRate}, 平均响应时间 ${bestMethod.avgTime}`);
    
    // 使用建议
    console.log('\\n🛠️  集成建议:');
    console.log('1. 开发环境: 使用 OPTIMIZED 方案（快速测试）');
    console.log('2. 生产环境: 使用 ADVANCED 方案（稳定可靠）'); 
    console.log('3. 大批量抓取: 考虑混合 ADVANCED + Playwright 备用');
    console.log('4. 速率限制: 建议间隔 1-3 秒，避免IP被封');
  }
  
  async runQuickTest() {
    console.log('🔥 快速测试模式 - 每种方法测试一次\n');
    
    const testCase = { keyword: 'frontend', location: 'Worldwide' };
    const methods = ['original', 'optimized', 'advanced'];
    
    for (const method of methods) {
      await this.runSingleTest(method, testCase.keyword, testCase.location, 1);
      if (method !== methods[methods.length - 1]) {
        await this.delay(2000);
      }
    }
    
    this.generateReport();
  }
}

// 主函数
async function main() {
  const benchmark = new PerformanceBenchmark();
  
  const mode = process.argv[2] || 'quick';
  
  try {
    if (mode === 'full') {
      console.log('🏁 完整基准测试模式 (需要 ~3 分钟)');
      await benchmark.runBenchmark();
    } else {
      console.log('⚡ 快速测试模式 (需要 ~30 秒)');
      await benchmark.runQuickTest();
    }
    
    benchmark.generateReport();
    
  } catch (error) {
    console.error('❌ 基准测试失败:', error.message);
  }
}

if (require.main === module) {
  console.log('🧪 LinkedIn API 性能基准测试工具');
  console.log('用法:');
  console.log('  node benchmark-test.js quick  # 快速测试 (默认)');
  console.log('  node benchmark-test.js full   # 完整测试');
  console.log('');
  
  main().catch(console.error);
}

module.exports = PerformanceBenchmark;