// 启动JobAPI项目并运行测试
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const JOBAPI_DIR = path.resolve(__dirname, '../JobAPI');
const TEST_FILE = path.join(JOBAPI_DIR, 'test-jobapi.js');

async function startJobAPIAndTest() {
  console.log('🚀 启动JobAPI项目测试流程...\n');

  // 检查JobAPI目录和文件
  if (!fs.existsSync(JOBAPI_DIR)) {
    console.error('❌ JobAPI目录不存在:', JOBAPI_DIR);
    return;
  }

  if (!fs.existsSync(TEST_FILE)) {
    console.error('❌ 测试文件不存在:', TEST_FILE);
    return;
  }

  console.log('📁 JobAPI目录:', JOBAPI_DIR);
  console.log('🧪 测试文件:', TEST_FILE);

  // 启动JobAPI服务器
  console.log('\n🔄 启动JobAPI服务器...');
  const serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: JOBAPI_DIR,
    stdio: 'pipe',
    shell: true
  });

  let serverReady = false;
  let serverOutput = '';

  // 监听服务器输出
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    serverOutput += output;
    process.stdout.write(`[Server] ${output}`);
    
    // 检查服务器是否已启动
    if (output.includes('服务启动') || output.includes('listening') || output.includes('8000')) {
      serverReady = true;
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const output = data.toString();
    process.stderr.write(`[Server Error] ${output}`);
  });

  // 等待服务器启动
  console.log('⏳ 等待服务器启动...');
  let waitCount = 0;
  while (!serverReady && waitCount < 30) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    waitCount++;
    if (waitCount % 5 === 0) {
      console.log(`   等待中... ${waitCount}s`);
    }
  }

  if (!serverReady) {
    console.error('❌ 服务器启动超时');
    console.log('服务器输出:', serverOutput);
    serverProcess.kill();
    return;
  }

  console.log('\n✅ 服务器已启动，开始运行测试...\n');

  // 运行测试
  try {
    const testProcess = spawn('node', ['test-jobapi.js'], {
      cwd: JOBAPI_DIR,
      stdio: 'inherit',
      shell: true
    });

    testProcess.on('close', (code) => {
      console.log(`\n🏁 测试完成，退出码: ${code}`);
      
      // 关闭服务器
      console.log('🛑 关闭服务器...');
      serverProcess.kill();
      
      if (code === 0) {
        console.log('🎉 所有测试通过！');
      } else {
        console.log('❌ 测试失败');
      }
      
      process.exit(code);
    });

  } catch (error) {
    console.error('❌ 运行测试失败:', error.message);
    serverProcess.kill();
    process.exit(1);
  }
}

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\n🛑 收到中断信号，正在清理...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到终止信号，正在清理...');
  process.exit(0);
});

if (require.main === module) {
  startJobAPIAndTest().catch(console.error);
}