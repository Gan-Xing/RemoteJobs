const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
// —— 缓存文件放到独立 cache 目录 —— //
const CACHE_DIR = path.join(process.cwd(), 'cache');   // ⬅️ 用 process.cwd()
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log('[salaryConverter] 创建缓存目录:', CACHE_DIR);
}
const CACHE_FILE = path.join(CACHE_DIR, 'exchangeRateCache.json');
console.log(`[salaryConverter] CACHE_FILE path: ${CACHE_FILE}`);
console.log(`[salaryConverter] CACHE_FILE exists: ${fs.existsSync(CACHE_FILE)}`);

// ---------- 本地文件缓存工具 ----------
function loadCacheFromFile() {
  console.log('[salaryConverter] ➡ loadCacheFromFile()');
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (data && data.rates && data.expiry) {
        data.expiry = new Date(data.expiry);
        console.log('[salaryConverter] ⬅ loadCacheFromFile(): VALID CACHE FOUND, expiry =', data.expiry);
        return data;
      }
    }
  } catch (e) {
    console.error('[salaryConverter] 读取本地汇率缓存文件失败:', e.message);
  }
  console.log('[salaryConverter] ⬅ loadCacheFromFile(): NO VALID CACHE');
  return null;
}

function saveCacheToFile(cacheObj) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheObj, null, 2));
    console.log('[salaryConverter] 已写入缓存文件, expiry =', cacheObj.expiry);
  } catch (e) {
    console.error('[salaryConverter] 写入本地汇率缓存文件失败:', e.message);
  }
}
// ---------- 本地文件缓存工具结束 ----------
const prisma = new PrismaClient();

// 添加汇率缓存
let exchangeRateCache = {
  rates: null,
  expiry: null,
};

// 尝试从本地文件恢复缓存
const fileCache = loadCacheFromFile();
if (fileCache) {
  exchangeRateCache = fileCache;
}

// ──────────────────────────────────────────
// 防并发：正在进行中的汇率获取 Promise（全局唯一）
// 如果有多个调用同时请求汇率，除第 1 个外，其他调用会等待这条 Promise，
// 避免重复访问外部 API 并写入多条数据库记录。
let pendingRatesPromise = null;
// ──────────────────────────────────────────

// 缓存有效期：24小时
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// 获取最新汇率（并发锁 + 单日只落一条记录）
async function getExchangeRates() {
  /* ───── 1. 并发锁 ───── */
  if (pendingRatesPromise) {
    console.log('[salaryConverter] ↻ 复用正在进行的汇率请求…');
    return pendingRatesPromise;        // 直接复用同一个 Promise
  }

  /* 把真正的获取逻辑包装成一个 IIFE，赋给 pendingRatesPromise，
     这样后续并发调用会直接 await 同一条 Promise */
  pendingRatesPromise = (async () => {
    const now = new Date();

    /* ───── 2. 内存缓存 ───── */
    if (exchangeRateCache.rates && exchangeRateCache.expiry && now < exchangeRateCache.expiry) {
      console.log('[salaryConverter] 使用缓存的汇率');
      return exchangeRateCache.rates;
    }

    /* ───── 3. 查询数据库当天记录 ───── */
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    console.log('[salaryConverter] 查询当天汇率，范围:', todayStart.toISOString(), '~', todayEnd.toISOString());

    let todayRates = await prisma.exchangeRate.findFirst({
      where: { date: { gte: todayStart, lt: todayEnd } },
      orderBy: { date: 'desc' }
    });

    if (todayRates) {
      console.log('[salaryConverter] 数据库已有今日汇率，直接返回');
      exchangeRateCache = {
        rates: todayRates.rates,
        expiry: new Date(now.getTime() + CACHE_DURATION)
      };
      saveCacheToFile(exchangeRateCache);
      return todayRates.rates;
    }

    /* ───── 4. 调用开放汇率 API ───── */
    console.log('[salaryConverter] 未找到今日汇率，调用 API…');
    try {
      const { data } = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 10000 });
      if (!data || !data.rates) throw new Error('API 无有效 rates 字段');

      const rates = data.rates;
      if (!rates.USD) rates.USD = 1;

      /* 单日只插一条：再次确认不存在后写入 */
      await prisma.exchangeRate.create({ data: { date: now, rates } });

      console.log('[salaryConverter] API 汇率已写入数据库');

      exchangeRateCache = {
        rates,
        expiry: new Date(now.getTime() + CACHE_DURATION)
      };
      saveCacheToFile(exchangeRateCache);
      return rates;
    } catch (apiErr) {
      console.error('[salaryConverter] API 调用失败:', apiErr.message);

      /* ───── 5. 兜底：再查一次数据库（可能别的并发已写）───── */
      todayRates = await prisma.exchangeRate.findFirst({
        where: { date: { gte: todayStart, lt: todayEnd } },
        orderBy: { date: 'desc' }
      });
      if (todayRates) {
        console.log('[salaryConverter] 兜底阶段找到数据库今日汇率，返回');
        exchangeRateCache = {
          rates: todayRates.rates,
          expiry: new Date(now.getTime() + CACHE_DURATION)
        };
        saveCacheToFile(exchangeRateCache);
        return todayRates.rates;
      }

      /* ───── 6. 最终兜底：静态默认汇率 ───── */
      console.warn('[salaryConverter] 使用默认静态汇率兜底');
      const defaultRates = {
        EUR: 0.92, GBP: 0.79, JPY: 151.62, CNY: 7.23,
        INR: 83.3, CHF: 0.9, PLN: 3.98, SEK: 10.68, USD: 1
      };
      exchangeRateCache = {
        rates: defaultRates,
        expiry: new Date(now.getTime() + CACHE_DURATION)
      };
      saveCacheToFile(exchangeRateCache);
      return defaultRates;
    }
  })();

  /* 等待获取结束，无论成功与否都清空 pendingRatesPromise */
  try {
    return await pendingRatesPromise;
  } finally {
    pendingRatesPromise = null;
  }
}

// 解析薪资字符串
function parseSalaryString(salaryString) {
  console.log('[salaryConverter] ➡ parseSalaryString()', salaryString);
  // 移除多余的空格
  salaryString = salaryString.trim();

  // 检查是否包含范围
  const rangeMatch = salaryString.match(/([¥€£$₹CHF\sPLN\sSEK\s])\s*([\d,.]+)(?:\s*-\s*[¥€£$₹CHF\sPLN\sSEK\s]?\s*([\d,.]+))?(?:\s*(?:\/|\s)\s*([a-zA-Z]+))?/);
  console.log(`[parseSalaryString] Range match: ${rangeMatch}`);

  if (!rangeMatch) {
    return null;
  }

  const [, currencySymbol, amountString1, amountString2, periodUnit] = rangeMatch;
  console.log(`[parseSalaryString] Currency symbol: ${currencySymbol}, Amount string 1: ${amountString1}, Amount string 2: ${amountString2}, Period unit: ${periodUnit}`);

  // 解析金额
  const amount1 = parseFloat(amountString1.replace(/,/g, ''));
  const amount2 = amountString2 ? parseFloat(amountString2.replace(/,/g, '')) : null;

  // 标准化货币符号
  const normalizedCurrency = currencySymbol.trim();
  console.log(`[parseSalaryString] Normalized currency: ${normalizedCurrency}`);

  // 标准化周期单位
  const normalizedPeriod = periodUnit ? periodUnit.toLowerCase() : null;
  console.log(`[parseSalaryString] Normalized period: ${normalizedPeriod}`);

  return {
    currency: normalizedCurrency,
    amount1,
    amount2,
    period: normalizedPeriod
  };
}

// ──────────────────────────────────────────
// 统一货币符号 / 代码，移除空格、NBSP 并转大写
function normalizeCurrency(token = '') {
  // 去掉普通空格和&nbsp;(\u00A0)
  return token.replace(/[\s\u00A0]/g, '').toUpperCase();
}
// ──────────────────────────────────────────

// 将金额转换为美元
function convertToUSD(amount, currency, rates) {
  console.log('[salaryConverter] ➡ convertToUSD()');
  console.log(
    `[convertToUSD] Amount: ${amount}, Raw currency: "${currency}"`
  );
  if (!amount || isNaN(amount)) return null;

  // 1️⃣ 货币符号/代码标准化
  const norm = normalizeCurrency(currency);

  // 2️⃣ 映射表（包含常见符号、三字母代码及部分别名）
  const currencyMap = {
    // 美元
    '$': 'USD', 'USD': 'USD', 'US$': 'USD', '＄': 'USD',

    // 欧元
    '€': 'EUR', 'EUR': 'EUR',

    // 英镑
    '£': 'GBP', 'GBP': 'GBP',

    // 日元 / 人民币（默认按 CNY 处理，可按需拆分）
    '¥': 'CNY', '￥': 'CNY', 'CNY': 'CNY', 'RMB': 'CNY',
    'JPY': 'JPY',

    // 印度卢比
    '₹': 'INR', 'INR': 'INR',

    // 瑞士法郎
    'CHF': 'CHF',

    // 波兰兹罗提
    'PLN': 'PLN',

    // 瑞典克朗
    'SEK': 'SEK'
  };

  // 3️⃣ 取 ISO 代码，fallback: 直接使用标准化后的值
  const isoCode = currencyMap[norm] || norm;

  // 4️⃣ 使用汇率
  const rate = rates[isoCode] || 1.0;

  console.log(`[convertToUSD] Using code: ${isoCode}, rate: ${rate}`);
  return amount / rate;
}

// 将不同周期的薪资转换为年薪
function convertToAnnual(amount, period) {
  console.log('[salaryConverter] ➡ convertToAnnual()', amount, period);
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
  console.log('[salaryConverter] ➡ convertSalaryToUSD()', salaryString);
  // console.log(`[salaryConverter] Attempting to convert salary: "${salaryString}"`);

  if (!salaryString || typeof salaryString !== 'string' || salaryString.trim() === '0' || salaryString.trim() === '未找到') {
    console.log(`[salaryConverter] Salary string is invalid, null, zero, or '未找到'. Returning null.`);
    console.log('[salaryConverter] ← EXIT convertSalaryToUSD() with null');
    return null;
  }

  try {
    const rates = await getExchangeRates();
    // console.log(`[salaryConverter] Using rates: ${JSON.stringify(rates)}`);

    if (!rates || typeof rates !== 'object' || Object.keys(rates).length === 0) {
      // console.error('[salaryConverter] Invalid or empty rates object received. Returning null.', rates);
      console.log('[salaryConverter] ← EXIT convertSalaryToUSD() with null');
      return null;
    }

    // 解析薪资字符串
    const parsed = parseSalaryString(salaryString);
    if (!parsed) {
      // console.log(`[salaryConverter] Failed to parse salary string: "${salaryString}". Returning null.`);
      console.log('[salaryConverter] ← EXIT convertSalaryToUSD() with null');
      return null;
    }

    // console.log(`[salaryConverter] Parsed salary:`, parsed);

    // 处理范围薪资
    let amount;
    if (parsed.amount2) {
      amount = (parsed.amount1 + parsed.amount2) / 2;
      // console.log(`[salaryConverter] Range salary detected. Using average: (${parsed.amount1} + ${parsed.amount2}) / 2 = ${amount}`);
    } else {
      amount = parsed.amount1;
    }

    // 转换为美元
    let usdAmount = convertToUSD(amount, parsed.currency, rates);
    if (usdAmount === null) {
      console.error(`[salaryConverter] Failed to convert to USD. Currency: ${parsed.currency}, Amount: ${amount}`);
      console.log('[salaryConverter] ← EXIT convertSalaryToUSD() with null');
      return null;
    }
    // console.log(`[salaryConverter] Converted to USD: ${usdAmount}`);

    // 转换为年薪
    let annualAmount = convertToAnnual(usdAmount, parsed.period);
    if (annualAmount === null) {
      console.error(`[salaryConverter] Failed to convert to annual. Period: ${parsed.period}, Amount: ${usdAmount}`);
      console.log('[salaryConverter] ← EXIT convertSalaryToUSD() with null');
      return null;
    }
    // console.log(`[salaryConverter] Converted to annual: ${annualAmount}`);

    // 四舍五入到整数
    const finalAmount = Math.round(annualAmount);
    // console.log(`[salaryConverter] Final rounded amount: ${finalAmount}`);
    console.log('[salaryConverter] ← DONE convertSalaryToUSD(), result =', finalAmount);

    return finalAmount;

  } catch (error) {
    console.error(`[salaryConverter] CRITICAL ERROR during conversion for "${salaryString}":`, error.message, error.stack);
    return null;
  }
}

module.exports = {
  convertSalaryToUSD
};