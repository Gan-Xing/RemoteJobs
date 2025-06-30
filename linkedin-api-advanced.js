// LinkedIn API 高级优化版本
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

class LinkedInScraper {
  constructor(options = {}) {
    this.options = {
      maxRetries: 3,
      retryDelay: 2000,
      requestTimeout: 30000,
      userAgentRotation: true,
      proxySupport: false,
      rateLimitDelay: { min: 1000, max: 3000 },
      ...options
    };
    
    this.userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    ];
    
    this.sessionCookies = new Map();
    this.requestCount = 0;
    this.lastRequestTime = 0;
    
    // 创建自定义的 https agent 来处理 SSL
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      secureProtocol: 'TLS_method'
    });
    
    this.initializeClient();
  }
  
  initializeClient() {
    const baseConfig = {
      timeout: this.options.requestTimeout,
      httpsAgent: this.httpsAgent,
      maxRedirects: 5,
      headers: this.getBaseHeaders()
    };
    
    if (this.options.proxySupport && this.options.proxy) {
      baseConfig.proxy = this.options.proxy;
    }
    
    this.client = axios.create(baseConfig);
    
    // 添加响应拦截器来处理 cookies
    this.client.interceptors.response.use(
      (response) => {
        this.extractCookies(response);
        return response;
      },
      (error) => {
        if (error.response) {
          this.extractCookies(error.response);
        }
        return Promise.reject(error);
      }
    );
  }
  
  getBaseHeaders() {
    const userAgent = this.options.userAgentRotation 
      ? this.userAgents[Math.floor(Math.random() * this.userAgents.length)]
      : this.userAgents[0];
      
    return {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': this.getRandomPlatform(),
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'keep-alive',
      'DNT': '1'
    };
  }
  
  getRandomPlatform() {
    const platforms = ['"macOS"', '"Windows"', '"Linux"'];
    return platforms[Math.floor(Math.random() * platforms.length)];
  }
  
  extractCookies(response) {
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      setCookieHeader.forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        if (name && value) {
          this.sessionCookies.set(name.trim(), value.trim());
        }
      });
    }
  }
  
  getCookieString() {
    return Array.from(this.sessionCookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
  
  async rateLimitedRequest(url, options = {}) {
    // 实现智能速率限制
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = this.options.rateLimitDelay.min;
    const maxDelay = this.options.rateLimitDelay.max;
    
    // 根据请求次数动态调整延迟
    let dynamicDelay = minDelay + (this.requestCount % 10) * 100;
    if (dynamicDelay > maxDelay) dynamicDelay = maxDelay;
    
    if (timeSinceLastRequest < dynamicDelay) {
      const waitTime = dynamicDelay - timeSinceLastRequest;
      console.log(`⏱️  速率限制等待: ${waitTime}ms`);
      await this.delay(waitTime);
    }
    
    this.requestCount++;
    this.lastRequestTime = Date.now();
    
    // 更新请求头
    const headers = {
      ...this.getBaseHeaders(),
      ...options.headers
    };
    
    // 添加 cookies
    const cookieString = this.getCookieString();
    if (cookieString) {
      headers['Cookie'] = cookieString;
    }
    
    // 如果是 API 请求，添加特定的头部
    if (url.includes('/api/')) {
      headers['X-Requested-With'] = 'XMLHttpRequest';
      headers['Sec-Fetch-Dest'] = 'empty';
      headers['Sec-Fetch-Mode'] = 'cors';
    }
    
    return this.client.get(url, { ...options, headers });
  }
  
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async retryRequest(url, options = {}, retryCount = 0) {
    try {
      const response = await this.rateLimitedRequest(url, options);
      return response;
    } catch (error) {
      if (retryCount < this.options.maxRetries) {
        const retryDelay = this.options.retryDelay * Math.pow(2, retryCount); // 指数退避
        console.log(`❌ 请求失败 (${error.message})，${retryDelay}ms 后重试... (${retryCount + 1}/${this.options.maxRetries})`);
        await this.delay(retryDelay);
        return this.retryRequest(url, options, retryCount + 1);
      }
      throw error;
    }
  }
  
  // 先访问主页建立会话
  async establishSession() {
    console.log('🔐 建立LinkedIn会话...');
    try {
      const response = await this.retryRequest('https://www.linkedin.com/jobs/search');
      console.log(`✅ 会话建立成功 (${response.status})`);
      console.log(`🍪 获得 ${this.sessionCookies.size} 个cookies`);
      return true;
    } catch (error) {
      console.error(`❌ 会话建立失败: ${error.message}`);
      return false;
    }
  }
  
  async searchJobs(keyword, location = 'Worldwide', start = 0, filters = {}) {
    const params = new URLSearchParams({
      keywords: keyword,
      location: location,
      start: start.toString(),
      ...filters
    });
    
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
    
    console.log(`🔍 搜索职位: ${keyword} @ ${location} (start: ${start})`);
    
    try {
      const startTime = Date.now();
      // 对于 jobs-guest API，不使用从主页获取的 cookies
      const response = await this.client.get(url, {
        headers: {
          ...this.getBaseHeaders(),
          // 移除可能导致问题的 cookies
        }
      });
      const requestTime = Date.now() - startTime;
      
      console.log(`✅ 搜索完成 (${requestTime}ms, ${response.status})`);
      
      const $ = cheerio.load(response.data);
      const jobs = this.parseJobList($);
      
      console.log(`📋 解析到 ${jobs.length} 个职位`);
      return jobs;
      
    } catch (error) {
      console.error(`❌ 搜索失败: ${error.message}`);
      if (error.response) {
        console.error(`   状态码: ${error.response.status}`);
        if (error.response.status === 429) {
          console.error(`   🚫 触发速率限制，建议增加延迟时间`);
        }
      }
      throw error;
    }
  }
  
  parseJobList($) {
    const jobs = [];
    
    $('li').each((i, li) => {
      const $li = $(li);
      const cardDiv = $li.find('div.base-card').first();
      
      if (cardDiv.length === 0) return;
      
      const entityUrn = cardDiv.attr('data-entity-urn');
      const refId = cardDiv.attr('data-reference-id');
      
      if (!entityUrn) return;
      
      const jobData = {
        id: entityUrn.split(':').pop(),
        entityUrn,
        refId: refId ? refId.trim() : null,
        title: $li.find('.base-search-card__title').text().trim(),
        company: this.extractCompany($li),
        location: $li.find('.job-search-card__location').text().trim(),
        jobLink: $li.find('a.base-card__full-link').attr('href'),
        ...this.extractPostingInfo($li)
      };
      
      if (jobData.id && jobData.title) {
        jobs.push(jobData);
      }
    });
    
    return jobs;
  }
  
  extractCompany($li) {
    const companyEl = $li.find('.base-search-card__subtitle a');
    return companyEl.length > 0 
      ? companyEl.text().trim() 
      : $li.find('.base-search-card__subtitle').text().trim();
  }
  
  extractPostingInfo($li) {
    const postedEl = $li.find('time.job-search-card__listdate');
    return {
      postedDate: postedEl.attr('datetime'),
      postedText: postedEl.text().trim()
    };
  }
  
  async getJobDetail(jobId, refId = null) {
    const baseUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
    const url = refId ? `${baseUrl}?refId=${encodeURIComponent(refId)}` : baseUrl;
    
    console.log(`📋 获取职位详情: ${jobId}`);
    
    try {
      const startTime = Date.now();
      const response = await this.retryRequest(url);
      const requestTime = Date.now() - startTime;
      
      console.log(`✅ 详情获取完成 (${requestTime}ms)`);
      
      const $ = cheerio.load(response.data);
      return this.parseJobDetail($, jobId);
      
    } catch (error) {
      console.error(`❌ 获取详情失败 (${jobId}): ${error.message}`);
      throw error;
    }
  }
  
  parseJobDetail($, jobId) {
    const selectors = {
      description: [
        '.show-more-less-html__markup',
        '.description__text',
        '.jobs-description-content__text',
        '.job-description'
      ],
      salary: [
        '.compensation__salary',
        '.jobs-unified-top-card__salary-details',
        '.salary-range'
      ],
      applicants: [
        'span.num-applicants__caption',
        '.jobs-unified-top-card__applicant-count',
        '.applicant-count'
      ]
    };
    
    const extractBySelectors = (selectorList) => {
      for (const selector of selectorList) {
        const element = $(selector).first();
        if (element.length > 0) {
          return element.text().trim();
        }
      }
      return null;
    };
    
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
    
    return {
      jobId,
      description: extractBySelectors(selectors.description) || '未找到描述',
      salary: extractBySelectors(selectors.salary) || '未找到薪资信息',
      applicants: extractBySelectors(selectors.applicants) || '未找到申请人数',
      criteria,
      isRemote: this.detectRemoteWork($),
      extractedAt: new Date().toISOString()
    };
  }
  
  detectRemoteWork($) {
    const text = $.text().toLowerCase();
    const remoteKeywords = [
      'remote', 'work from home', 'telecommute', 'distributed',
      '远程', '在家工作', '居家办公'
    ];
    
    return remoteKeywords.some(keyword => text.includes(keyword));
  }
  
  // 获取统计信息
  getStats() {
    return {
      requestCount: this.requestCount,
      cookieCount: this.sessionCookies.size,
      lastRequestTime: this.lastRequestTime,
      userAgent: this.client.defaults.headers['User-Agent']
    };
  }
}

// 使用示例
async function main() {
  const scraper = new LinkedInScraper({
    maxRetries: 3,
    retryDelay: 1000,
    rateLimitDelay: { min: 800, max: 2000 },
    userAgentRotation: true
  });
  
  try {
    // 1. 建立会话
    await scraper.establishSession();
    
    // 2. 搜索职位
    const jobs = await scraper.searchJobs('frontend', 'Worldwide', 0);
    
    console.log(`\n📊 找到 ${jobs.length} 个职位`);
    
    if (jobs.length > 0) {
      // 3. 获取详情
      const firstJob = jobs[0];
      console.log(`\n📋 测试获取详情: ${firstJob.title}`);
      
      const detail = await scraper.getJobDetail(firstJob.id, firstJob.refId);
      
      console.log(`\n结果:`);
      console.log(`  描述长度: ${detail.description.length}`);
      console.log(`  薪资: ${detail.salary}`);
      console.log(`  申请人数: ${detail.applicants}`);
      console.log(`  是否远程: ${detail.isRemote}`);
      console.log(`  标准信息: ${Object.keys(detail.criteria).length} 项`);
    }
    
    // 4. 显示统计
    console.log(`\n📈 抓取统计:`, scraper.getStats());
    
  } catch (error) {
    console.error('❌ 抓取失败:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = LinkedInScraper;