const fs = require('fs');
const readline = require('readline');

const filePath = 'title_embeddings.jsonl'; // 你的 jsonl 文件

let badCount = 0;
let total = 0;

const rl = readline.createInterface({
  input: fs.createReadStream(filePath),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  total++;
  if (!line.trim()) return; // 跳过空行
  try {
    JSON.parse(line);
  } catch (e) {
    badCount++;
    // 只打印前200个字符，避免控制台爆炸
    console.log(`第${total}行损坏: ${line.slice(0, 200)}...`);
  }
});

rl.on('close', () => {
  if (badCount === 0) {
    console.log(`✅ 没有发现坏行，全部 ${total} 行正常`);
  } else {
    console.log(`❌ 共发现 ${badCount} 个坏行（共 ${total} 行）`);
  }
});