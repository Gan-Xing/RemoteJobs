// utils/migrateOneJob.mjs  ---------------------------------------------------
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import { convertSalaryToUSD } from './salaryConverter.js';
import fs from 'fs';
import path from 'path';

/* ---------------------------- 初始化 ------------------------------------- */
const prisma = new PrismaClient();
const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) { console.error('❌ 缺少 DEEPSEEK_API_KEY'); process.exit(1); }

/* ---------------------------- 枚举/工具 ---------------------------------- */
const TITLE_CATEGORIES = [
  "Engineering Management", "AI/ML/Data Science", "Data Engineering",
  "Mobile Development", "Specialized Platforms (ERP/CRM/CMS/Insurance/eCommerce)",
  "Full-Stack Development", "Frontend Development", "Backend Development",
  "DevOps/Cloud/Infrastructure", "Technical Lead (General)",
  "Software Engineering (General/Specialized Fields)", "Web Development (General/Junior)",
  "Quality Assurance/Testing", "Security", "Business Analyst/Product Management",
  "Consulting", "Internship/Entry-Level", "Other/Uncategorized"
];
const IDX2CAT = Object.fromEntries(TITLE_CATEGORIES.map((c, i) => [String(i + 1), c]));

/* ---- Salary Currency 白名单 ---- */
import { SalaryCurrency as SALARY_ENUM } from '@prisma/client';
const ALLOWED_CURRENCIES = Object.values(SALARY_ENUM);
const currencyAliases = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'CNY', '￥': 'CNY', 'RMB': 'CNY', '₹': 'INR' };
const normCurrency = raw => {
  if (!raw) return 'USD';
  const up = raw.trim().toUpperCase();
  const iso = currencyAliases[up] || up;
  return ALLOWED_CURRENCIES.includes(iso) ? iso : 'USD';
};

/* ---- 其它枚举 ---- */
import {
  EmploymentType,
  WorkplaceType,
  Seniority,
  ExperienceCategory,
  EducationLevel
} from '@prisma/client';

const safeEnum = (val, AllowedEnum, fallback = null) =>
  val && Object.values(AllowedEnum).includes(val) ? val : fallback;

/* ------------------------- DeepSeek JSON 调用 --------------------------- */
async function deepSeekJSON(systemPrompt, userPrompt) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat', temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt.trim() },
        { role: 'user', content: userPrompt.trim() }
      ]
    })
  });
  if (!r.ok) throw new Error(`DeepSeek HTTP ${r.status}`);
  const data = await r.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
}

/* ---------------------- 单次 LLM 分析（Prompt ★升级） ------------------- */
async function llmAnalyze(job) {
  const sys = `
You are "RecruitGPT", an expert that cleans and structures job-posting data.
**Return ONLY valid JSON** that exactly matches the schema below.
If any field is unknown put **null** or an empty array [].
**Do not output comments or any extra keys**.

ENUMS  (use UPPERCASE):
• idx                : 1-18                     (titleClass list below)
• experienceCategory : Y0_1 | Y1_3 | Y3_5 | Y5P
• educationRequired  : NONE | HIGH_SCHOOL | BACHELOR | MASTER | PHD
• jobFunction        : Engineering | Sales | Marketing | Finance | HR |
                       Operations | Product | Design | Customer_Success |
                       Legal | Data | IT | null
• workplaceType: REMOTE | HYBRID | ON_SITE，结合title、description、location等字段智能判断。

GEO rules:
• country = 2-letter ISO (e.g. "US") – REQUIRED if any location present.
• If region / city unknown set null.
• Always provide lat / lng.  
  – If only country known → use its capital or most-populous city centre.  
  – 5 decimal places is enough.


timezoneRestriction:
• Array of **integers** representing allowed UTC offsets (e.g. [-8,3]).  
  • Unrestricted or global remote → empty array [].

Tech / skills extraction:
• mandatoryTech      – technologies explicitly **required**. (max 10)
• niceToHaveTech     – explicitly "nice to have / preferred". (max 10)
• softSkills         – non-technical skills (communication, leadership …)
• benefits           – one benefit per item (insurance, PTO …)
• certificatesRequired – e.g. ["AWS Solutions Architect"]

languages:
• list ONLY human languages explicitly required (e.g. ["English","Spanish"]).

STRUCTURE TO RETURN  ↓↓↓
{
 "idx": 5,
 "geo": { "country":"US", "region":"California", "city":"San Francisco",
          "lat":37.77, "lng":-122.42 },
 "workplaceType": "REMOTE",
 "experienceCategory": "Y3_5",
 "educationRequired": "BACHELOR",
 "mandatoryTech": [],
 "niceToHaveTech": [],
 "softSkills": [],
 "certificatesRequired": [],
 "benefits": [],
 "languages": [],
 "jobFunction": "Engineering",
 "timezoneRestriction": []
}

TITLE-CLASS LIST (1-18):
${TITLE_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}
`;
  return deepSeekJSON(sys, JSON.stringify(job));
}

/* ------------------------- 薪资区间解析 --------------------------------- */
function extractSalaryPieces(str) {
  if (!str || str === '未找到') return null;
  // 允许 K/k 缩写
  const num = '(\\d+[\\d,\\.]*[Kk]?)';
  const sym = '([¥€£$A-Z]{0,5})?';
  const rgx = new RegExp(`${sym}\\s*${num}[^\\dKk]+${sym}\\s*${num}`, 'i');
  const m = str.match(rgx);
  if (m) {
    return { curL: m[1] || m[3] || '', numL: m[2], curR: m[3] || m[1] || '', numR: m[4] };
  }
  const single = str.match(new RegExp(`${sym}\\s*${num}`, 'i'));
  if (single) { return { curL: single[1] || '', numL: single[2], curR: single[1] || '', numR: single[2] }; }
  return null;
}
const parseNumber = s => /k/i.test(s) ? parseFloat(s.replace(/,/g, '')) * 1e3 : parseFloat(s.replace(/,/g, ''));
async function convertRangeToUSD(piece, raw) {
  const mk = (cur, num) => `${cur}${num}${/\/|hr|day|week|month|year|年|月|天|时/.test(raw) ? raw.replace(/.*?(\/|月|年|天|时).*/, '$1') : ''}`;
  const usdL = await convertSalaryToUSD(mk(piece.curL, piece.numL));
  const usdR = await convertSalaryToUSD(mk(piece.curR, piece.numR));
  return { usdMin: Math.min(usdL, usdR), usdMax: Math.max(usdL, usdR) };
}

/* --------------------- 申请人数上限判断 ---------------------------------- */
const parseApplicants = str => {
  if (!str || str === '未找到') return { cnt: null, capped: false };
  const n = parseInt(str.replace(/[^\d]/g, ''), 10);
  return { cnt: isNaN(n) ? null : n, capped: n === 200 };
};

/* ---------------------- 选一条完整 Job（同前） --------------------------- */
// async function pickJobs(limit = 10) {
//   return prisma.job.findMany({
//     where: {
//       jobId: { notIn: [""] }, // jobId 是主键必有，无需 not: null
//       refId: { notIn: [""] }, // 可以缺省
//       title: { notIn: ["未知职位", ""] },
//       company: { notIn: ["未知公司", ""] },
//       companyUrl: { notIn: [""] },
//       location: { notIn: ["未知地点", ""] },
//       description: { notIn: [""] },
//       url: { notIn: [""] },
//       salary: { notIn: ["未找到", ""] },
//       salaryNumeric: { not: null },
//       postedAt: { not: null },
//       postedText: { notIn: ["未知日期", ""] },
//       applicantsCount: { notIn: ["未找到", ""] },
//       seniority: { notIn: [""] },
//       employmentType: { notIn: [""] },
//       jobFunction: { notIn: [""] },
//       industries: { notIn: [""] }
//     },
//     orderBy: { createdAt: 'desc' },
//     take: limit
//   });
// }

// 支持直接传递limit
async function pickJobs(limit = 10) {
  // 1. 读取 titleclassify.jsonl 到 Map
  const classifyFile = path.resolve(
    './cleanjob/title/llm/titleclassify.jsonl'
  );
  const lines = fs.readFileSync(classifyFile, 'utf-8').split('\n').filter(Boolean);
  const id2class = new Map();
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.id && obj.titleClass) id2class.set(obj.id, obj.titleClass);
    } catch (e) {
      console.warn('[titleclassify.jsonl] JSON 解析失败:', line);
    }
  }
  console.log(`[pickJobs] titleclassify.jsonl 条数: ${id2class.size}`);

  // 2. 指定允许的 titleClass
  const allowed = new Set([
    // 'AI/ML/Data Science',
    // 'Full-Stack Development',
    'Frontend Development',
    'Web Development (General/Junior)',
    // 'Internship/Entry-Level'
  ]);
  console.log('[pickJobs] 允许的 titleClass:', Array.from(allowed).join(', '));

  // 3. 先查一大批 job，后本地筛选
  const jobs = await prisma.job.findMany({
    where: {
      jobId: { notIn: [""] },
      refId: { notIn: [""] },
      title: { notIn: ["未知职位", ""] },
      company: { notIn: ["未知公司", ""] },
      companyUrl: { notIn: [""] },
      location: { notIn: ["未知地点", ""] },
      description: { notIn: [""] },
      url: { notIn: [""] },
      salary: { notIn: ["未找到", ""] },
      salaryNumeric: { not: null },
      postedAt: { not: null },
      postedText: { notIn: ["未知日期", ""] },
      applicantsCount: { notIn: ["未找到", ""] },
      seniority: { notIn: [""] },
      employmentType: { notIn: [""] },
      jobFunction: { notIn: [""] },
      industries: { notIn: [""] }
    },
    orderBy: { createdAt: 'desc' },
    take: limit * 100
  });
  console.log(`[pickJobs] 从数据库查得 job 数: ${jobs.length}`);

  // 打印前 10 个 jobId 做个映射检测
  if (jobs.length) {
    console.log('[pickJobs] 前10个 jobId 和 titleClass 对应:');
    for (let i = 0; i < Math.min(10, jobs.length); i++) {
      const job = jobs[i];
      const titleClass = id2class.get(job.id) || '(无分类)';
      console.log(`  #${i+1}: ${job.id}  →  ${titleClass}`);
    }
  }

  // 4. 结合分类结果筛选
  const filtered = [];
  let missed = 0;
  for (const job of jobs) {
    const titleClass = id2class.get(job.id);
    if (titleClass && allowed.has(titleClass)) {
      filtered.push({ ...job, titleClass });
      if (filtered.length >= limit) break;
    } else {
      missed++;
    }
  }
  console.log(`[pickJobs] 筛选后得到 job 数: ${filtered.length}，被排除数: ${missed}`);

  if (!filtered.length) {
    // 打印前20个被筛掉的 jobId + 分类情况
    console.log('[pickJobs] 未通过 titleClass 的前20条:');
    for (let i = 0, j = 0; i < jobs.length && j < 20; i++) {
      const job = jobs[i];
      const titleClass = id2class.get(job.id) || '(无分类)';
      if (!allowed.has(titleClass)) {
        console.log(`  ${job.jobId} → ${titleClass}`);
        j++;
      }
    }
  }

  return filtered;
}

/* ======================================================================= */
(async () => {
  const jobs = await pickJobs(100); // 例如 20 条

  // for (const job of jobs) {
  //   console.log(job.salary)
  // }

  if (!jobs || jobs.length === 0) {
    console.log('❌ 没找到符合条件的 Job');
    process.exit(1);
  }

  // 2. 批量查已存在 jobId
  const jobIds = jobs.map(j => j.jobId);

  const existing = await prisma.jobClean.findMany({
    where: { jobId: { in: jobIds } },
    select: { jobId: true }
  });
  const existingIds = new Set(existing.map(e => e.jobId));

  // 3. 过滤掉已存在的
  const newJobs = jobs.filter(j => !existingIds.has(j.jobId));

  if (newJobs.length === 0) {
    console.log('⚠️ 批量 jobs 中无新数据需要插入，全部已存在');
    process.exit(0);
  }

  for (const origin of newJobs) {
    console.log('🎯 处理 Job.id =', origin.id);

    // -------- LLM 一次分析 --------
    const ai = await llmAnalyze({
      title: origin.title,
      description: origin.description,
      location: origin.location,
      jobFunction: origin.jobFunction,
      industries: origin.industries,
      isRemote: origin.isRemote
    });

    // 最终 JobClean，参考你已有的 clean 结构
    const titleClass = IDX2CAT[String(ai.idx)] || 'Other/Uncategorized';
    const geo = ai.geo || {};
    if ((!geo.lat || !geo.lng) && origin.location) {
      try {
        const g = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(origin.location)}`)
          .then(r => r.json());
        if (g?.[0]) { geo.lat = parseFloat(g[0].lat); geo.lng = parseFloat(g[0].lon); }
      } catch { }
    }

    let salaryMin = null, salaryMax = null, salaryCurrency = null,
      salaryUsdYearMin = null, salaryUsdYearMax = null, salaryPeriod = 'YEAR';
    if (origin.salary && origin.salary !== '未找到') {
      const p = extractSalaryPieces(origin.salary);
      if (p) {
        salaryMin = parseNumber(p.numL);
        salaryMax = parseNumber(p.numR);
        salaryCurrency = normCurrency(p.curL || p.curR || '$');
        const usd = await convertRangeToUSD(p, origin.salary);
        salaryUsdYearMin = usd.usdMin; salaryUsdYearMax = usd.usdMax;
      }
      if (/hour|hr|时|\/h/i.test(origin.salary)) salaryPeriod = 'HOUR';
      else if (/day|\/d|天/i.test(origin.salary)) salaryPeriod = 'DAY';
      else if (/week|\/w/i.test(origin.salary)) salaryPeriod = 'WEEK';
      else if (/month|\/m|月/i.test(origin.salary)) salaryPeriod = 'MONTH';
    }

    const { cnt: applicantsCount, capped: applicantsIsCapped } = parseApplicants(origin.applicantsCount);

    let workplaceType = ai.workplaceType ? ai.workplaceType.toUpperCase() : null;
    workplaceType = safeEnum(workplaceType, WorkplaceType, null);
    if (!workplaceType) {
      const txt = `${origin.title} ${origin.description} ${origin.benefits || ''}`.toLowerCase();
      if (/(remote|在家|home|anywhere|digital nomad|远程)/.test(txt)) workplaceType = 'REMOTE';
      else if (/(hybrid|flexible|remote-friendly|部分远程)/.test(txt)) workplaceType = 'HYBRID';
      else workplaceType = 'ON_SITE';
      workplaceType = safeEnum(workplaceType, WorkplaceType, 'ON_SITE');
    }

    const employmentType = safeEnum(origin.employmentType?.replace(/\s|-/g, '_').toUpperCase(), EmploymentType, 'OTHER');
    const seniority = safeEnum(origin.seniority?.replace(/\s|-/g, '_').toUpperCase(), Seniority, 'NOT_APPLICABLE');
    const educationRequired = safeEnum(ai.educationRequired, EducationLevel, null);
    const experienceCategory = safeEnum(ai.experienceCategory, ExperienceCategory, null);

    const buildCompanyId = url => {
      if (!url) return null;
      try { const u = new URL(url); return `${u.hostname.split('.')[0]}++${u.pathname.split('/')[2] || ''}`; } catch { return null; }
    };

    const tz = Array.isArray(ai.timezoneRestriction) ? ai.timezoneRestriction
      .map(x => parseInt(x, 10))
      .filter(n => Number.isInteger(n) && n >= -12 && n <= 14) : [];

    const clean = {
      jobId: origin.jobId,
      refId: origin.refId,
      jobUrl: origin.url,

      title: origin.title,
      titleClass,

      companyName: origin.company,
      companyId: buildCompanyId(origin.companyUrl),
      companyUrl: origin.companyUrl,

      country: geo.country || null, region: geo.region || null, city: geo.city || null,
      lat: geo.lat || null, lng: geo.lng || null,

      salaryMin, salaryMax, salaryCurrency, salaryPeriod,
      salaryUsdYearMin, salaryUsdYearMax,

      postedAt: origin.postedAt,
      applicantsCount, applicantsIsCapped,

      platform: 'linkedin',
      workplaceType, employmentType, seniority,

      experienceCategory,
      jobFunction: origin.jobFunction || ai.jobFunction || null,
      industries: origin.industries,

      educationRequired,
      mandatoryTech: ai.mandatoryTech || [],
      niceToHaveTech: ai.niceToHaveTech || [],
      softSkills: ai.softSkills || [],
      certificatesRequired: ai.certificatesRequired || [],
      benefits: ai.benefits || [],

      languages: ai.languages || [],
      timezoneRestriction: tz,

      description: origin.description
    };

    console.log('\n🔧 JobClean:\n', JSON.stringify(clean, null, 2));

    const saved = await prisma.jobClean.create({ data: clean });
    console.log('\n✅ 已写入 JobClean，id =', saved.id);
  }

  await prisma.$disconnect();
  process.exit(0);
})().catch(async e => {
  console.error('❌ 脚本异常：', e);
  await prisma.$disconnect(); process.exit(1);
});