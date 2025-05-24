const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 添加汇率缓存
let exchangeRateCache = {
  rates: null,
  expiry: null,
};

// 缓存有效期：24小时
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// 获取最新汇率
async function getExchangeRates() {
  const now = new Date();

  // ✅ 1. 检查缓存是否存在并在有效期内
  if (exchangeRateCache.rates && exchangeRateCache.expiry && now < exchangeRateCache.expiry) {
    console.log('[salaryConverter] 使用缓存的汇率');
    return exchangeRateCache.rates;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 2. 从数据库查询今天的汇率
    const todayRates = await prisma.exchangeRate.findFirst({
      where: {
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (todayRates) {
      console.log('[salaryConverter] 使用数据库中今天的汇率:', todayRates.rates);

      // ✅ 更新缓存
      exchangeRateCache = {
        rates: todayRates.rates,
        expiry: new Date(now.getTime() + CACHE_DURATION),
      };

      return todayRates.rates;
    }

    // 3. 如果数据库没有今天的汇率，调用 API
    console.log('[salaryConverter] 未找到今天的汇率，从 API 获取...');
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');

    if (response?.data?.rates && Object.keys(response.data.rates).length > 0) {
      const rates = response.data.rates;
      if (!rates.USD) rates.USD = 1.0;

      // 写入数据库
      await prisma.exchangeRate.create({
        data: {
          date: new Date(),
          rates,
        },
      });

      console.log('[salaryConverter] 成功将新汇率保存到数据库:', rates);

      // ✅ 更新缓存
      exchangeRateCache = {
        rates,
        expiry: new Date(now.getTime() + CACHE_DURATION),
      };

      return rates;
    } else {
      throw new Error('从 API 接收到的汇率数据无效');
    }
  } catch (error) {
    console.error('[salaryConverter] 获取或验证汇率失败:', error.message);

    try {
      // 4. 从数据库中获取最近有效的一条
      const lastValidRates = await prisma.exchangeRate.findFirst({
        orderBy: {
          date: 'desc',
        },
      });

      if (lastValidRates) {
        console.log('[salaryConverter] 使用数据库中最近的有效汇率:', lastValidRates.rates);

        // ✅ 更新缓存
        exchangeRateCache = {
          rates: lastValidRates.rates,
          expiry: new Date(now.getTime() + CACHE_DURATION),
        };

        return lastValidRates.rates;
      }
    } catch (dbError) {
      console.error('[salaryConverter] 从数据库获取最近有效汇率失败:', dbError.message);
    }

    // 5. 使用默认汇率
    const defaultRates = {
      EUR: 0.92,
      GBP: 0.79,
      JPY: 151.62,
      CNY: 7.23,
      INR: 83.30,
      CHF: 0.90,
      PLN: 3.98,
      SEK: 10.68,
      USD: 1.0,
    };

    try {
      await prisma.exchangeRate.create({
        data: {
          date: new Date(),
          rates: defaultRates,
        },
      });

      console.log('[salaryConverter] 已将默认汇率保存到数据库');
    } catch (dbError) {
      console.error('[salaryConverter] 保存默认汇率到数据库失败:', dbError.message);
    }

    // ✅ 更新缓存
    exchangeRateCache = {
      rates: defaultRates,
      expiry: new Date(now.getTime() + CACHE_DURATION),
    };

    return defaultRates;
  }
}

// 解析薪资字符串
function parseSalaryString(salaryString) {
  // 移除多余的空格
  salaryString = salaryString.trim();
  
  // 检查是否包含范围
  const rangeMatch = salaryString.match(/([¥€£$₹CHF\sPLN\sSEK\s])\s*([\d,.]+)(?:\s*-\s*[¥€£$₹CHF\sPLN\sSEK\s]?\s*([\d,.]+))?(?:\s*(?:\/|\s)\s*([a-zA-Z]+))?/);
  
  if (!rangeMatch) {
    return null;
  }

  const [, currencySymbol, amountString1, amountString2, periodUnit] = rangeMatch;
  
  // 解析金额
  const amount1 = parseFloat(amountString1.replace(/,/g, ''));
  const amount2 = amountString2 ? parseFloat(amountString2.replace(/,/g, '')) : null;
  
  // 标准化货币符号
  const normalizedCurrency = currencySymbol.trim();
  
  // 标准化周期单位
  const normalizedPeriod = periodUnit ? periodUnit.toLowerCase() : null;
  
  return {
    currency: normalizedCurrency,
    amount1,
    amount2,
    period: normalizedPeriod
  };
}

// 将金额转换为美元
function convertToUSD(amount, currency, rates) {
  if (!amount || isNaN(amount)) return null;
  
  const rate = rates[currency] || 1.0;
  return amount * rate;
}

// 将不同周期的薪资转换为年薪
function convertToAnnual(amount, period) {
  if (!amount || isNaN(amount)) return null;
  
  switch (period) {
    case 'hr':
    case 'hour':
    case 'hourly':
      return amount * 40 * 52; // 每周40小时，52周
    case 'mo':
    case 'month':
    case 'monthly':
      return amount * 12; // 12个月
    case 'daily':
      return amount * 5 * 52; // 每周5天，52周
    case 'yr':
    case 'year':
    case 'annually':
    case 'annual':
      return amount; // 已经是年薪
    default:
      // 如果没有指定周期，根据金额大小判断
      if (amount < 1000) {
        // 如果金额较小，假设是时薪
        return amount * 40 * 52;
      } else if (amount < 10000) {
        // 如果金额中等，假设是月薪
        return amount * 12;
      } else {
        // 如果金额较大，假设是年薪
        return amount;
      }
  }
}

// 将薪资转换为美元年薪
async function convertSalaryToUSD(salaryString) {
  console.log(`[salaryConverter] Attempting to convert salary: "${salaryString}"`);
  
  if (!salaryString || typeof salaryString !== 'string' || salaryString.trim() === '0' || salaryString.trim() === '未找到') {
    console.log(`[salaryConverter] Salary string is invalid, null, zero, or '未找到'. Returning null.`);
    return null;
  }

  try {
    const rates = await getExchangeRates();
    console.log(`[salaryConverter] Using rates: ${JSON.stringify(rates)}`);

    if (!rates || typeof rates !== 'object' || Object.keys(rates).length === 0) {
      console.error('[salaryConverter] Invalid or empty rates object received. Returning null.', rates);
      return null;
    }

    // 解析薪资字符串
    const parsed = parseSalaryString(salaryString);
    if (!parsed) {
      console.log(`[salaryConverter] Failed to parse salary string: "${salaryString}". Returning null.`);
      return null;
    }

    console.log(`[salaryConverter] Parsed salary:`, parsed);

    // 处理范围薪资
    let amount;
    if (parsed.amount2) {
      amount = (parsed.amount1 + parsed.amount2) / 2;
      console.log(`[salaryConverter] Range salary detected. Using average: (${parsed.amount1} + ${parsed.amount2}) / 2 = ${amount}`);
    } else {
      amount = parsed.amount1;
    }

    // 转换为美元
    let usdAmount = convertToUSD(amount, parsed.currency, rates);
    if (usdAmount === null) {
      console.error(`[salaryConverter] Failed to convert to USD. Currency: ${parsed.currency}, Amount: ${amount}`);
      return null;
    }
    console.log(`[salaryConverter] Converted to USD: ${usdAmount}`);

    // 转换为年薪
    let annualAmount = convertToAnnual(usdAmount, parsed.period);
    if (annualAmount === null) {
      console.error(`[salaryConverter] Failed to convert to annual. Period: ${parsed.period}, Amount: ${usdAmount}`);
      return null;
    }
    console.log(`[salaryConverter] Converted to annual: ${annualAmount}`);

    // 四舍五入到整数
    const finalAmount = Math.round(annualAmount);
    console.log(`[salaryConverter] Final rounded amount: ${finalAmount}`);

    return finalAmount;

  } catch (error) {
    console.error(`[salaryConverter] CRITICAL ERROR during conversion for "${salaryString}":`, error.message, error.stack);
    return null;
  }
}

module.exports = {
  convertSalaryToUSD
}; 