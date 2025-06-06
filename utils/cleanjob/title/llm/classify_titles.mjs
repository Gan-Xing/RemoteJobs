/**
 * classify.js  (ESM, batched)
 * ---------------------------
 * 1) 流式读取 titles.json（4 万条 OK）
 * 2) 每 20 条拼成一次 DeepSeek 请求，模型只返回 idx 数组
 * 3) 每 100 条结果追加到 titleclassify.jsonl，可断点续跑
 */

import fs from 'fs';
import readline from 'readline';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';

/* stream-json 组件 */
import streamJsonPkg from 'stream-json';
import streamArrayPkg from 'stream-json/streamers/StreamArray.js';
const { parser } = streamJsonPkg;
const { streamArray } = streamArrayPkg;

dotenv.config();
const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) {
  console.error(chalk.red('请在 .env 中设置 DEEPSEEK_API_KEY')); process.exit(1);
}

/* ==== 可调参数 ==== */
const INPUT_FILE       = 'titles.json';
const OUTPUT_FILE      = 'titleclassify.jsonl';
const REQ_BATCH_SIZE   = 20;   // 一次问 20 个
const WRITE_BATCH_SIZE = 100;  // 写盘批量 100
const MAX_PARALLEL     = 3;    // 并发批次数
const RETRIES          = 3;
/* ================= */

const CATEGORIES = [
  "Engineering Management",
  "AI/ML/Data Science",
  "Data Engineering",
  "Mobile Development",
  "Specialized Platforms (ERP/CRM/CMS/Insurance/eCommerce)",
  "Full-Stack Development",
  "Frontend Development",
  "Backend Development",
  "DevOps/Cloud/Infrastructure",
  "Technical Lead (General)",
  "Software Engineering (General/Specialized Fields)",
  "Web Development (General/Junior)",
  "Quality Assurance/Testing",
  "Security",
  "Business Analyst/Product Management",
  "Consulting",
  "Internship/Entry-Level",
  "Other/Uncategorized"
];
const IDX_TO_CAT = Object.fromEntries(CATEGORIES.map((c, i) => [String(i + 1), c]));

/* ---------- 读取已完成 id ---------- */
async function loadDoneIds() {
  const set = new Set();
  if (!fs.existsSync(OUTPUT_FILE)) return set;
  const rl = readline.createInterface({ input: fs.createReadStream(OUTPUT_FILE) });
  for await (const line of rl) {
    try { const obj = JSON.parse(line); if (obj?.id) set.add(obj.id); } catch {}
  }
  console.log(chalk.cyan(`已存在 ${set.size} 条分类结果，自动跳过`));
  return set;
}

/* ---------- DeepSeek 批量调用 ---------- */
async function askLLMBatch(items) {
  const titles = items.map((it, idx) => `${idx + 1}. ${it.title.replace(/\n/g, ' ')}`).join('\n');
  const systemPrompt = `
  你是招聘专家。你会收到${items.length}个职位title，每行格式为“1. title”。
  你的任务是：为每个title选择**唯一且最优先**的分类（见下方列表，按从上到下优先级），
  只能返回如下json格式：{"idx":[数字,数字,...]}
  - "idx" 是只包含数字的数组，长度必须等于title数量（${items.length}），每个元素只填一个数字。
  - 严禁用对象、嵌套、key、map，只能返回一维数字数组。
  - 若某一条无法判断，请填18。
  - 不能输出任何其它内容。
  
  示例（假设3条title）:
  {"idx":[7,5,2]}
  
  分类列表（按优先级从上到下）：
  ${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}
  `.trim();

  const body = {
    model: 'deepseek-chat',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: titles }
    ]
  };

  let res, raw;
  try {
    res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(chalk.red(`HTTP ${res.status} 错误，内容：`), errText);
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }
    const data = await res.json();
    raw  = data.choices?.[0]?.message?.content?.trim() ?? '';
  } catch (e) {
    console.error(chalk.red('请求异常，body如下：\n'), JSON.stringify(body, null, 2));
    throw e;
  }

  // 打印 LLM 返回原文（只在解析失败时）
  try {
    const arr = JSON.parse(raw).idx;
    if (Array.isArray(arr) && arr.length === items.length) {
      return arr.map(i => IDX_TO_CAT[String(i)] ?? "Other/Uncategorized");
    } else {
      console.error(chalk.red('LLM 返回 idx 数组格式异常！'), raw);
      throw new Error('LLM 返回 idx 数组格式异常');
    }
  } catch (e) {
    console.error(chalk.red('\nJSON 解析失败，原始返回内容如下：\n'), raw, '\n');
    throw e;
  }
}

/* ---------- 带重试的批量分类 ---------- */
async function classifyBatch(originBatch) {
  for (let i = 1; i <= RETRIES; i++) {
    try {
      const classes = await askLLMBatch(originBatch);
      return originBatch.map((item, idx) => ({
        ...item,
        titleClass: classes[idx]
      }));
    } catch (e) {
      console.warn(chalk.yellow(`批量 ${originBatch[0].id}… 第 ${i}/${RETRIES} 次失败：${e.message}`));
      if (i === RETRIES) {
        return originBatch.map(item => ({
          ...item,
          titleClass: "Other/Uncategorized",
          error: e.message
        }));
      }
      await new Promise(r => setTimeout(r, 1000 * i));
    }
  }
}

/* ---------- 写盘 ---------- */
function flush(records) {
  fs.appendFileSync(
    OUTPUT_FILE,
    records.map(r => JSON.stringify(r)).join('\n') + '\n'
  );
}

/* ---------- 主流程 ---------- */
(async () => {
  const doneIds     = await loadDoneIds();
  const limit       = pLimit(MAX_PARALLEL);
  const reqBuffer   = []; // 等待凑满 20 条去问
  const writeBuffer = []; // 等待凑满 100 条写盘
  let processed     = 0;

  console.log(chalk.green('开始流式解析…'));

  await pipeline(
    createReadStream(INPUT_FILE),
    parser(),          // 解析任意 JSON
    streamArray(),     // 只取数组元素
    async function* (source) {
      for await (const { value: obj } of source) {
        if (doneIds.has(obj.id)) continue;

        reqBuffer.push(obj);

        // 凑够 20 条，发并发请求
        if (reqBuffer.length >= REQ_BATCH_SIZE) {
          const batch = reqBuffer.splice(0, REQ_BATCH_SIZE);
          writeBuffer.push(limit(() => classifyBatch(batch)));
        }

        // 写盘时机：累积的 promise 完成且够 100 条
        if (writeBuffer.length * REQ_BATCH_SIZE >= WRITE_BATCH_SIZE) {
          const resultChunks = await Promise.all(writeBuffer.splice(0));
          const flat = resultChunks.flat();
          flush(flat);
          processed += flat.length;
          console.log(chalk.blue(`[${new Date().toLocaleTimeString()}] 已写出 ${processed}`));
        }
      }

      /* 处理最后不足 20 条的请求 */
      if (reqBuffer.length) {
        writeBuffer.push(limit(() => classifyBatch(reqBuffer.splice(0))));
      }
      /* 等待剩余并发完成后统一写盘 */
      if (writeBuffer.length) {
        const resultChunks = await Promise.all(writeBuffer);
        const flat = resultChunks.flat();
        flush(flat);
        processed += flat.length;
        console.log(chalk.blue(`[${new Date().toLocaleTimeString()}] 已写出 ${processed}`));
      }
    }
  );

  console.log(chalk.bold.green('\n🎉 全部完成'));
})().catch(err => {
  console.error(chalk.red('程序异常终止：'), err);
  process.exit(1);
});