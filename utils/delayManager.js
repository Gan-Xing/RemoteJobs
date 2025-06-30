// 智能延迟管理器
class DelayManager {
  constructor(options = {}) {
    this.profiles = {
      // 快速模式 - 最小延迟，高性能
      fast: {
        search: { min: 100, max: 300 },
        detail: { min: 50, max: 200 },
        batch: { min: 500, max: 1000 }
      },
      
      // 正常模式 - 平衡性能和安全性
      normal: {
        search: { min: 200, max: 800 },
        detail: { min: 200, max: 600 },
        batch: { min: 1000, max: 2000 }
      },
      
      // 安全模式 - 更长延迟，避免被限制
      safe: {
        search: { min: 1000, max: 3000 },
        detail: { min: 800, max: 1500 },
        batch: { min: 2000, max: 4000 }
      },
      
      // 测试模式 - 最小延迟，仅用于测试
      test: {
        search: { min: 10, max: 50 },
        detail: { min: 10, max: 50 },
        batch: { min: 100, max: 200 }
      }
    };
    
    this.currentProfile = options.profile || 'normal';
    this.adaptiveMode = options.adaptive !== false; // 默认启用自适应
    this.requestHistory = [];
    this.maxHistorySize = 20;
    
    console.log(`[延迟管理器] 初始化，配置: ${this.currentProfile}, 自适应: ${this.adaptiveMode}`);
  }
  
  /**
   * 获取延迟配置
   * @param {string} type - 延迟类型 (search, detail, batch)
   * @returns {Object} 延迟配置
   */
  getDelayConfig(type = 'search') {
    const profile = this.profiles[this.currentProfile];
    if (!profile || !profile[type]) {
      console.warn(`[延迟管理器] 未知的延迟类型: ${type}, 使用默认配置`);
      return this.profiles.normal.search;
    }
    return profile[type];
  }
  
  /**
   * 生成随机延迟时间
   * @param {string} type - 延迟类型
   * @returns {number} 延迟毫秒数
   */
  getRandomDelay(type = 'search') {
    const config = this.getDelayConfig(type);
    const delay = Math.random() * (config.max - config.min) + config.min;
    return Math.round(delay);
  }
  
  /**
   * 执行延迟
   * @param {string} type - 延迟类型
   * @returns {Promise} 延迟 Promise
   */
  async delay(type = 'search') {
    const delayTime = this.getRandomDelay(type);
    
    if (delayTime > 0) {
      console.log(`[延迟管理器] ${type} 延迟: ${delayTime}ms`);
      await new Promise(resolve => setTimeout(resolve, delayTime));
    }
    
    return delayTime;
  }
  
  /**
   * 记录请求结果，用于自适应调整
   * @param {boolean} success - 请求是否成功
   * @param {number} responseTime - 响应时间
   * @param {string} type - 请求类型
   */
  recordRequest(success, responseTime, type = 'search') {
    const record = {
      success,
      responseTime,
      type,
      timestamp: Date.now(),
      profile: this.currentProfile
    };
    
    this.requestHistory.push(record);
    
    // 保持历史记录大小
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.shift();
    }
    
    // 如果启用自适应模式，分析并调整
    if (this.adaptiveMode) {
      this.analyzeAndAdapt();
    }
  }
  
  /**
   * 分析请求历史并自适应调整延迟策略
   */
  analyzeAndAdapt() {
    if (this.requestHistory.length < 5) return; // 样本太少
    
    const recentRequests = this.requestHistory.slice(-10); // 最近10次请求
    const successRate = recentRequests.filter(r => r.success).length / recentRequests.length;
    const avgResponseTime = recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length;
    
    // 自适应策略
    if (successRate < 0.7) {
      // 成功率低，增加延迟
      if (this.currentProfile === 'fast') {
        this.switchProfile('normal');
        console.log(`[延迟管理器] 成功率过低 (${(successRate * 100).toFixed(1)}%)，切换到 normal 模式`);
      } else if (this.currentProfile === 'normal') {
        this.switchProfile('safe');
        console.log(`[延迟管理器] 成功率过低 (${(successRate * 100).toFixed(1)}%)，切换到 safe 模式`);
      }
    } else if (successRate > 0.95 && avgResponseTime < 2000) {
      // 成功率高且响应快，可以减少延迟
      if (this.currentProfile === 'safe') {
        this.switchProfile('normal');
        console.log(`[延迟管理器] 性能良好，切换到 normal 模式`);
      } else if (this.currentProfile === 'normal') {
        this.switchProfile('fast');
        console.log(`[延迟管理器] 性能良好，切换到 fast 模式`);
      }
    }
  }
  
  /**
   * 切换延迟配置
   * @param {string} profile - 新的配置名称
   */
  switchProfile(profile) {
    if (this.profiles[profile]) {
      this.currentProfile = profile;
      console.log(`[延迟管理器] 切换到配置: ${profile}`);
    } else {
      console.warn(`[延迟管理器] 未知的配置: ${profile}`);
    }
  }
  
  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    if (this.requestHistory.length === 0) {
      return {
        profile: this.currentProfile,
        requests: 0,
        successRate: '0%',
        avgResponseTime: '0ms'
      };
    }
    
    const successCount = this.requestHistory.filter(r => r.success).length;
    const successRate = ((successCount / this.requestHistory.length) * 100).toFixed(1);
    const avgResponseTime = Math.round(
      this.requestHistory.reduce((sum, r) => sum + r.responseTime, 0) / this.requestHistory.length
    );
    
    return {
      profile: this.currentProfile,
      requests: this.requestHistory.length,
      successRate: successRate + '%',
      avgResponseTime: avgResponseTime + 'ms',
      adaptive: this.adaptiveMode
    };
  }
  
  /**
   * 重置统计数据
   */
  resetStats() {
    this.requestHistory = [];
    console.log(`[延迟管理器] 统计数据已重置`);
  }
}

// 单例实例
let delayManagerInstance = null;

/**
 * 获取延迟管理器实例
 * @param {Object} options - 配置选项
 * @returns {DelayManager} 延迟管理器实例
 */
function getDelayManager(options = {}) {
  if (!delayManagerInstance) {
    delayManagerInstance = new DelayManager(options);
  }
  return delayManagerInstance;
}

/**
 * 重新配置延迟管理器
 * @param {Object} options - 新的配置选项
 * @returns {DelayManager} 新的延迟管理器实例
 */
function reconfigureDelayManager(options = {}) {
  delayManagerInstance = new DelayManager(options);
  return delayManagerInstance;
}

module.exports = {
  DelayManager,
  getDelayManager,
  reconfigureDelayManager
};