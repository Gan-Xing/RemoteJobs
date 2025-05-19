const axios = require('axios');

// 缓存汇率数据
let exchangeRates = null;
let lastFetchTime = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时

// 获取最新汇率
async function getExchangeRates() {
  const now = Date.now();
  if (exchangeRates && lastFetchTime && (now - lastFetchTime < CACHE_DURATION)) {
    return exchangeRates;
  }

  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    exchangeRates = response.data.rates;
    lastFetchTime = now;
    return exchangeRates;
  } catch (error) {
    console.error('获取汇率失败:', error);
    // 使用默认汇率
    return {
      EUR: 0.92,
      GBP: 0.79,
      JPY: 151.62,
      CNY: 7.23,
      INR: 83.30
    };
  }
}

// 将薪资转换为美元年薪
async function convertSalaryToUSD(salaryString) {
  if (!salaryString || salaryString === '0' || salaryString === '未找到') {
    return null;
  }

  try {
    const rates = await getExchangeRates();
    
    // 提取数字和货币符号
    const match = salaryString.match(/([¥€£$₹])([\d,.]+)(?:\s*-\s*[\d,.]+)?(?:\s*\/\s*([a-zA-Z]+))?/);
    if (!match) return null;

    const [_, currency, amount, period] = match;
    let numericAmount = parseFloat(amount.replace(/,/g, ''));
    
    // 根据货币转换
    switch (currency) {
      case '¥': // 日元
        numericAmount = numericAmount / rates.JPY;
        break;
      case '€': // 欧元
        numericAmount = numericAmount / rates.EUR;
        break;
      case '£': // 英镑
        numericAmount = numericAmount / rates.GBP;
        break;
      case '₹': // 印度卢比
        numericAmount = numericAmount / rates.INR;
        break;
      // 美元不需要转换
    }

    // 根据时间单位转换为年薪
    if (period) {
      switch (period.toLowerCase()) {
        case 'hr':
          numericAmount = numericAmount * 40 * 52; // 假设每周40小时，52周
          break;
        case 'mo':
          numericAmount = numericAmount * 12;
          break;
        // 年薪不需要转换
      }
    }

    return Math.round(numericAmount);
  } catch (error) {
    console.error('薪资转换失败:', error);
    return null;
  }
}

module.exports = {
  convertSalaryToUSD
}; 