const fs = require('fs');
const readline = require('readline');
const wasm = require('./kmeans/kmeans_wasm/pkg/kmeans_wasm');   // 这里假设已经用wasm-pack构建完成

const FILE = 'title_embeddings.jsonl';   // 你的输入jsonl
const K = 50;                            // 聚类数
const MINI_BATCH = 1000;                 // 减小批次大小以减少内存压力
const LOG_EVERY = 5000;                  // 每处理多少条log一次

async function loadEmbeddings(path) {
  const emb = [];
  const meta = [];
  let dim = null;

  const rl = readline.createInterface({
    input: fs.createReadStream(path),
    crlfDelay: Infinity,
  });

  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);

      if (dim === null) dim = o.embedding.length;
      if (o.embedding.length !== dim) {
        console.error(`⚠️ skip ${o.id} (dim=${o.embedding.length})`);
        continue;
      }
      emb.push(o.embedding);
      meta.push({ id: o.id, title: o.title });
      count++;
      if (count % LOG_EVERY === 0) {
        console.log(`[LOAD] 已读取 ${count} 行`);
      }
    } catch (e) {
      console.error(`⚠️ 解析失败: ${line.substring(0, 100)}...`);
    }
  }
  return { dim, emb, meta };
}

(async () => {
  try {
    // wasm-pack导出的模块初始化
    if (typeof wasm.default === 'function') await wasm.default();

    const { dim, emb, meta } = await loadEmbeddings(FILE);
    console.log(`[INFO] 成功加载 ${emb.length} 条 embedding, 维度=${dim}`);

    if (emb.length < K) {
      throw new Error(`样本数(${emb.length})必须大于聚类数(${K})`);
    }

    // 检查数据量，如果太大则采样
    let sampledEmb = emb;
    let sampledMeta = meta;
    const MAX_SAMPLES = 50000; // 最大处理50k个样本
    
    if (emb.length > MAX_SAMPLES) {
      console.log(`[INFO] 数据量过大 (${emb.length})，随机采样到 ${MAX_SAMPLES} 条`);
      const indices = Array.from({length: emb.length}, (_, i) => i)
        .sort(() => Math.random() - 0.5)
        .slice(0, MAX_SAMPLES);
      
      sampledEmb = indices.map(i => emb[i]);
      sampledMeta = indices.map(i => meta[i]);
    }

    // 初始化KMeans
    console.log(`[INFO] 初始化 K-Means: dim=${dim}, k=${K}, batch=${MINI_BATCH}`);
    if (!wasm.kmeans_init(dim, K, MINI_BATCH)) {
      throw new Error('K-Means 初始化失败');
    }

    // 分批推送给wasm
    console.log(`[INFO] 开始推送数据...`);
    let pushFailures = 0;
    for (let off = 0; off < sampledEmb.length; off += MINI_BATCH) {
      const slice = sampledEmb.slice(off, off + MINI_BATCH);
      const flat = new Float32Array(slice.length * dim);
      
      // 填充数据
      slice.forEach((vec, i) => {
        flat.set(vec, i * dim);
      });
      
      // 推送数据
      if (!wasm.kmeans_push(flat)) {
        pushFailures++;
        console.error(`⚠️ 批次 ${Math.floor(off/MINI_BATCH)} 推送失败`);
        if (pushFailures > 5) {
          throw new Error('推送失败次数过多，终止处理');
        }
      }
      
      if (off % (10 * MINI_BATCH) === 0) {
        console.log(`[PUSH] 已推送 ${off + slice.length} / ${sampledEmb.length}`);
      }
    }

    if (pushFailures > 0) {
      console.log(`[WARN] 共有 ${pushFailures} 个批次推送失败`);
    }

    // 聚类
    console.log(`[INFO] 开始聚类计算...`);
    console.time('KMEANS');
    const labels = wasm.kmeans_finalize();
    console.timeEnd('KMEANS');

    if (!labels) {
      throw new Error('聚类计算失败');
    }

    console.log(`[INFO] 聚类成功，得到 ${labels.length} 个标签`);

    // 合并聚类结果
    if (labels.length !== sampledMeta.length) {
      throw new Error(`标签数量 (${labels.length}) 与样本数量 (${sampledMeta.length}) 不匹配`);
    }

    labels.forEach((c, i) => (sampledMeta[i].cluster = c));
    
    // 统计每个簇的大小
    const clusterSizes = new Array(K).fill(0);
    labels.forEach(c => clusterSizes[c]++);
    console.log(`[INFO] 簇大小分布: ${clusterSizes.map((size, i) => `簇${i}: ${size}个`).join(', ')}`);

    fs.writeFileSync('clustered_titles.json', JSON.stringify(sampledMeta, null, 2));
    console.log(`✅ 聚类完成：${sampledMeta.length} 行 ➜ ${K} 类，已写入 clustered_titles.json`);

    // 如果进行了采样，也保存原始映射
    if (emb.length > MAX_SAMPLES) {
      console.log(`[INFO] 原始数据被采样，完整结果需要进一步处理`);
    }

  } catch (e) {
    console.error('❌ 错误:', e);
    process.exit(1);
  }
})();