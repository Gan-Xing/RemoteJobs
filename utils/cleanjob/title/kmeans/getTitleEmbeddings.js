// scripts/getTitleEmbeddings_jsonl.js

const fs = require('fs');
const readline = require('readline');
const aiplatform = require('@google-cloud/aiplatform');
const { PredictionServiceClient } = aiplatform.v1;
const { helpers } = aiplatform;

const titlesPath = 'titles.json';
if (!fs.existsSync(titlesPath)) {
  console.error(`文件不存在: ${titlesPath}`);
  process.exit(1);
}
const fileContent = fs.readFileSync(titlesPath, 'utf-8');
let titles;
try {
  titles = JSON.parse(fileContent);
  if (!Array.isArray(titles)) throw new Error('titles.json格式错误，必须是数组');
} catch (e) {
  console.error('titles.json内容格式错误:', e);
  process.exit(1);
}

// 流式断点续传，支持超大 JSONL 文件
const savePath = 'title_embeddings.jsonl';
let doneIds = new Set();
function loadDoneIdsFromJsonl(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return resolve(new Set());
    const doneSet = new Set();
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        const obj = JSON.parse(line);
        if (obj && obj.id) doneSet.add(obj.id);
      } catch (e) {
        // 有坏行直接跳过
      }
    });
    rl.on('close', () => {
      resolve(doneSet);
    });
    rl.on('error', (err) => reject(err));
  });
}

// 配置
const project = 'grounded-braid-459615-q9';
const model = 'text-multilingual-embedding-002';
const apiEndpoint = 'us-central1-aiplatform.googleapis.com';
const endpoint = `projects/${project}/locations/us-central1/publishers/google/models/${model}`;
const client = new PredictionServiceClient({ apiEndpoint });

const BATCH_SIZE = 50;
const QUOTA_PER_MIN = 1000;
const RETRY_LIMIT = 3;

(async () => {
  doneIds = await loadDoneIdsFromJsonl(savePath);
  if (doneIds.size > 0) {
    console.log(`已存在记录: ${doneIds.size}`);
  }

  let processedThisMinute = 0;
  let batchCount = 0;
  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    const batch = titles.slice(i, i + BATCH_SIZE).filter(t => !doneIds.has(t.id));
    if (!batch.length) continue;

    if (processedThisMinute >= QUOTA_PER_MIN) {
      console.log(`已处理${QUOTA_PER_MIN}条，等待60秒防止超额...`);
      await new Promise(res => setTimeout(res, 60000));
      processedThisMinute = 0;
    }

    let predictions = [];
    for (let retry = 0; retry < RETRY_LIMIT; ++retry) {
      try {
        const instances = batch.map(t =>
          helpers.toValue({ content: t.title, task_type: 'RETRIEVAL_DOCUMENT' })
        );
        const [response] = await client.predict({ endpoint, instances });
        predictions = response.predictions.map(p => {
          const embeddingsProto = p.structValue.fields.embeddings;
          const valuesProto = embeddingsProto.structValue.fields.values;
          return valuesProto.listValue.values.map(v => v.numberValue);
        });
        break;
      } catch (err) {
        if (
          (err.code === 8 || err.message.includes('Quota exceeded')) &&
          retry < RETRY_LIMIT - 1
        ) {
          console.warn('配额用尽，自动等待60秒重试...');
          await new Promise(res => setTimeout(res, 60000));
        } else if (retry === RETRY_LIMIT - 1) {
          throw err;
        } else {
          console.error(`第${i / BATCH_SIZE + 1}批请求失败，重试一次...`, err.message);
          await new Promise(res => setTimeout(res, 3000));
        }
      }
    }

    let lines = '';
    for (let j = 0; j < predictions.length; ++j) {
      const record = {
        id: batch[j].id,
        title: batch[j].title,
        embedding: predictions[j]
      };
      lines += JSON.stringify(record) + '\n';
      doneIds.add(batch[j].id);
    }
    fs.appendFileSync(savePath, lines, 'utf-8');
    processedThisMinute += batch.length;
    batchCount++;
    console.log(`第${batchCount}批完成，总${doneIds.size}条（已保存进度）`);
  }
  console.log('全部完成！');
})();