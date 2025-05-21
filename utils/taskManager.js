import { PrismaClient } from '@prisma/client';
import { regions } from './regions';
import fs from 'fs';
import path from 'path';

// 本地存储文件路径
const LOCAL_STORAGE_FILE = path.join(process.cwd(), 'data', 'local_jobs.json');

// 添加任务状态持久化文件路径
const TASK_STATE_FILE = path.join(process.cwd(), 'data', 'task_state.json');

// 初始化 Prisma 客户端
const prisma = new PrismaClient();

// 任务状态
let taskState = {
  running: false,
  status: 'stopped',
  geoId: '',
  keyword: '',
  step: 0,
  geoIndex: 0,
  keywordIndex: 0,
  startedAt: null,
  elapsedSec: 0,
  lastBatchCount: 0,
  lastError: null
};

// 本地数据存储 - 当数据库连接失败时将数据存储在这里
let localJobsStorage = [];

// 添加状态更新节流
let lastStateUpdateTime = 0;
const STATE_UPDATE_THROTTLE = 500; // 至少间隔500ms才更新状态
let pendingStateUpdate = false;

// 添加事件订阅系统
const stateSubscribers = new Set();

// 注册状态更新订阅
export const subscribeToState = (callback) => {
  stateSubscribers.add(callback);
  return () => stateSubscribers.delete(callback); // 返回取消订阅函数
};

// 通知所有订阅者状态已更新
const notifySubscribers = (state) => {
  stateSubscribers.forEach(callback => {
    try {
      callback(state);
    } catch (error) {
      console.error('[任务管理器] 通知订阅者失败:', error);
    }
  });
};

// 加载本地存储数据
try {
  // 确保data目录存在
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[任务管理器] 创建数据目录:', dataDir);
  }
  
  // 尝试从文件加载数据
  if (fs.existsSync(LOCAL_STORAGE_FILE)) {
    const data = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf8');
    localJobsStorage = JSON.parse(data);
    console.log(`[任务管理器] 从文件加载了 ${localJobsStorage.length} 个本地存储的职位数据`);
  } else {
    console.log('[任务管理器] 本地存储文件不存在，创建空数组');
    localJobsStorage = [];
  }
} catch (error) {
  console.error('[任务管理器] 加载本地存储数据失败:', error.message);
  localJobsStorage = [];
}

let isDbConnected = true; // 数据库连接状态标志

// 用于更新运行时间的计时器
let elapsedTimer = null;

// 添加全局browser变量
let currentBrowser = null;

// 全局中断标志
let taskInterrupted = false;

// 添加强制中断功能
const forceInterruptTask = () => {
  taskInterrupted = true;
  console.log('[任务管理器] 已设置强制中断标志');
};

// 加载任务状态
const loadTaskState = (forceReset = false) => {
  try {
    // 确保data目录存在
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 检查状态文件是否存在
    if (fs.existsSync(TASK_STATE_FILE)) {
      const data = fs.readFileSync(TASK_STATE_FILE, 'utf8');
      const loadedState = JSON.parse(data);
      console.log('[任务管理器] 已从文件加载任务状态');
      
      // 如果需要强制重置，则使用默认状态
      if (forceReset) {
        console.log('[任务管理器] 强制重置任务状态为默认值');
        taskState = {
          running: false,
          status: 'stopped',
          geoId: '',
          keyword: '',
          step: 0,
          geoIndex: 0,
          keywordIndex: 0,
          startedAt: null,
          elapsedSec: 0,
          lastBatchCount: 0,
          lastError: null
        };
        saveTaskState();
        return true;
      }
      
      // 合并加载的状态和默认状态
      taskState = { ...taskState, ...loadedState };
      
      // 如果状态是running但没有活动进程，设置为stopped
      if (taskState.running) {
        taskState.running = false;
        taskState.status = 'stopped'; 
        
        // 重置相关状态
        taskState.startedAt = null;
        taskState.elapsedSec = 0;
        
        saveTaskState(); // 保存更新后的状态
        console.log('[任务管理器] 检测到任务状态不一致，任务状态已从running更改为stopped');
      }
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('[任务管理器] 加载任务状态失败:', error.message);
    return false;
  }
};

// 保存任务状态
const saveTaskState = () => {
  try {
    // 确保data目录存在
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 保存状态到文件
    fs.writeFileSync(TASK_STATE_FILE, JSON.stringify(taskState, null, 2), 'utf8');
    console.log('[任务管理器] 已保存任务状态到文件');
    return true;
  } catch (error) {
    console.error('[任务管理器] 保存任务状态失败:', error.message);
    return false;
  }
};

// 修改更新任务状态函数，添加持久化
const updateTaskState = (updates) => {
  // 合并更新
  taskState = { ...taskState, ...updates };
  
  // 保存更新后的状态到文件
  saveTaskState();
  
  // 使用节流机制触发状态通知
  const now = Date.now();
  if (now - lastStateUpdateTime >= STATE_UPDATE_THROTTLE) {
    // 立即通知
    lastStateUpdateTime = now;
    notifySubscribers({ ...taskState });
  } else if (!pendingStateUpdate) {
    // 延迟通知
    pendingStateUpdate = true;
    setTimeout(() => {
      pendingStateUpdate = false;
      lastStateUpdateTime = Date.now();
      notifySubscribers({ ...taskState });
    }, STATE_UPDATE_THROTTLE);
  }
};

// 初始化时加载任务状态
loadTaskState();

// 保存本地存储数据到文件
const saveLocalStorageToFile = () => {
  try {
    // 确保data目录存在
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 保存数据到文件
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(localJobsStorage), 'utf8');
    console.log(`[任务管理器] 已将 ${localJobsStorage.length} 个职位数据保存到本地文件`);
    return true;
  } catch (error) {
    console.error('[任务管理器] 保存数据到本地文件失败:', error.message);
    return false;
  }
};

// 任务配置
export const taskConfig = {
  keywords: [
    "nodejs","fullstack","react","web developer",
    "frontend","javascript", "typescript",
    "vue","angular","nextjs","nuxtjs",
    "svelte","ember.js","extjs",
    "html css", "tailwind", "bootstrap"
  ],
  steps: [
    // { f_WT: ['2'] },
    // { f_WT: ['2'], f_SB2: '1' },
    { f_WT: ['2'], f_SB2: '1', f_JT: ['F'] },
    { f_WT: ['2'], f_SB2: '1', f_JT: ['F'], f_TPR: 'r31536000' },
    { f_WT: ['2'], f_SB2: '1', f_JT: ['F'], f_TPR: 'r7776000' },
    { f_WT: ['2'], f_SB2: '1', f_JT: ['F'], f_TPR: 'r2592000' },
    { f_WT: ['2'], f_SB2: '1', f_JT: ['F'], f_TPR: 'r604800' },
    { f_WT: ['2'], f_SB2: '1', f_JT: ['F'], f_TPR: 'r86400' }
  ]
};

// 获取所有geoId
const getAllGeoIds = () => {
  const geoIds = [];
  Object.values(regions).forEach(region => {
    region.countries.forEach(country => {
      geoIds.push(country.geoId);
    });
  });
  return geoIds;
};

// 获取任务状态
export const getTaskStatus = () => {
  // 如果任务正在运行并且有startedAt，更新elapsedSec
  if (taskState.running && taskState.startedAt) {
    const now = new Date();
    const started = new Date(taskState.startedAt);
    const elapsedSec = Math.floor((now - started) / 1000);
    taskState.elapsedSec = elapsedSec;
  }
  
  return { 
    ...taskState,
    keywords: taskConfig.keywords,
    geoTotal: getAllGeoIds().length,
    stepTotal: taskConfig.steps.length
  };
};

// 获取本地存储的任务数据
export const getLocalJobs = () => {
  return [...localJobsStorage];
};

// 清除本地存储的任务数据
export const clearLocalJobs = () => {
  const count = localJobsStorage.length;
  localJobsStorage = [];
  
  // 清空后同步更新文件
  saveLocalStorageToFile();
  
  return count;
};

// 测试数据库连接并设置连接状态
export const testDbConnection = async () => {
  try {
    // 尝试执行一个简单的数据库查询
    await prisma.$queryRaw`SELECT 1`;
    isDbConnected = true;
    return true;
  } catch (error) {
    console.error('数据库连接测试失败:', error.message);
    isDbConnected = false;
    return false;
  }
};

// 尝试保存本地缓存的任务到数据库
export const saveLocalJobsToDb = async (jobs = null) => {
  try {
    // 如果没有提供jobs参数，则使用内部的localJobsStorage
    const jobsToSave = jobs || [...localJobsStorage];
    
    console.log(`[任务管理器] 开始保存本地职位数据到数据库，总数量: ${jobsToSave.length}`);
    
    if (jobsToSave.length === 0) {
      console.log(`[任务管理器] 没有需要保存的数据`);
      return { success: true, message: '没有需要保存的数据', count: 0 };
    }
    
    // 测试连接
    console.log(`[任务管理器] 测试数据库连接...`);
    const connected = await testDbConnection();
    if (!connected) {
      console.error(`[任务管理器] ❌ 数据库连接失败，无法保存本地数据`);
      return { success: false, message: '数据库连接失败', count: 0 };
    }
    
    console.log(`[任务管理器] 数据库连接成功，开始批量保存 ${jobsToSave.length} 个职位...`);
    
    const { saveJobs } = require('./prisma');
    
    // 分批保存，每批100条数据
    const batchSize = 100;
    const totalBatches = Math.ceil(jobsToSave.length / batchSize);
    let successCount = 0;
    let failureCount = 0;
    let lastBatchSuccessful = true;
    
    // 如果使用内部存储，创建一个副本用于跟踪
    const useInternalStorage = !jobs;
    let remainingJobs = [...jobsToSave];
    
    for (let batch = 0; batch < totalBatches; batch++) {
      try {
        // 验证数据库连接是否仍然有效
        const stillConnected = await testDbConnection();
        if (!stillConnected) {
          console.error(`[任务管理器] ❌ 数据库连接在第 ${batch+1}/${totalBatches} 批次时断开`);
          lastBatchSuccessful = false;
          break;
        }
        
        const startIdx = batch * batchSize;
        const endIdx = Math.min(startIdx + batchSize, jobsToSave.length);
        const currentBatch = jobsToSave.slice(startIdx, endIdx);
        const batchCount = currentBatch.length;
        
        console.log(`[任务管理器] 保存第 ${batch+1}/${totalBatches} 批次，职位索引 ${startIdx} - ${endIdx-1}，数量: ${batchCount}`);
        
        // 保存当前批次
        await saveJobs(currentBatch);
        
        // 保存成功，更新计数
        successCount += batchCount;
        
        // 如果使用内部存储，从待保存列表中移除已保存的项
        if (useInternalStorage) {
          // 从remainingJobs中移除已保存的批次
          remainingJobs = remainingJobs.slice(batchCount);
          
          // 更新localJobsStorage，只保留尚未保存的职位
          localJobsStorage = [...remainingJobs];
          
          // 立即保存更新后的本地存储到文件
          saveLocalStorageToFile();
          
          console.log(`[任务管理器] ✅ 已保存第 ${batch+1}/${totalBatches} 批次 (${batchCount} 个职位)，并从本地存储中移除`);
          console.log(`[任务管理器] 剩余未保存职位: ${localJobsStorage.length} 个`);
        }
        
        lastBatchSuccessful = true;
      } catch (batchError) {
        console.error(`[任务管理器] ❌ 保存第 ${batch+1}/${totalBatches} 批次失败:`, batchError.message);
        failureCount += 1;
        lastBatchSuccessful = false;
        // 批次失败时跳出循环，保留剩余未保存的数据
        break;
      }
    }
    
    // 输出最终结果
    if (successCount > 0) {
      console.log(`[任务管理器] ✅ 总计成功保存 ${successCount}/${jobsToSave.length} 个职位到数据库`);
    }
    
    if (failureCount > 0) {
      console.log(`[任务管理器] ❌ 总计 ${failureCount} 个批次保存失败`);
    }
    
    // 如果全部保存成功且使用内部存储，则确保存储已清空
    if (lastBatchSuccessful && useInternalStorage && localJobsStorage.length === 0) {
      console.log(`[任务管理器] ✅ 所有本地存储数据已成功保存到数据库并清除`);
    }
    
    return { 
      success: successCount > 0, 
      message: successCount > 0 
        ? `成功保存 ${successCount}/${jobsToSave.length} 个职位到数据库` 
        : '保存失败',
      count: successCount,
      remainingCount: useInternalStorage ? localJobsStorage.length : (jobsToSave.length - successCount)
    };
  } catch (error) {
    console.error(`[任务管理器] ❌ 保存本地数据到数据库失败:`, error);
    console.error(`[任务管理器] 错误详情:`, error.stack);
    return { success: false, message: error.message, count: 0 };
  }
};

// 保存任务进度到数据库
const saveTaskProgress = async (geoIndex, keywordIndex, step) => {
  try {
    // 先检查数据库连接
    const connected = await testDbConnection();
    if (!connected) {
      console.log(`[任务管理器] 数据库连接失败，无法保存进度 (geoIndex=${geoIndex}, keywordIndex=${keywordIndex}, step=${step})`);
      return false;
    }
    
    await prisma.taskProgress.upsert({
      where: { id: 'current' },
      update: {
        geoIndex,
        keywordIndex,
        step,
        updatedAt: new Date()
      },
      create: {
        id: 'current',
        geoIndex,
        keywordIndex,
        step,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    console.log(`[任务管理器] 保存进度: geoIndex=${geoIndex}, keywordIndex=${keywordIndex}, step=${step}`);
    return true;
  } catch (error) {
    console.error('[任务管理器] 保存任务进度失败:', error.message);
    // 不抛出异常，避免中断任务执行
    return false;
  }
};

// 获取保存的任务进度
const getTaskProgress = async () => {
  try {
    // 先检查数据库连接
    const connected = await testDbConnection();
    if (!connected) {
      console.log(`[任务管理器] 数据库连接失败，无法获取进度`);
      return null;
    }
    
    const progress = await prisma.taskProgress.findUnique({
      where: { id: 'current' }
    });
    if (progress) {
      console.log(`[任务管理器] 获取到保存的进度: geoIndex=${progress.geoIndex}, keywordIndex=${progress.keywordIndex}, step=${progress.step}`);
    }
    return progress;
  } catch (error) {
    console.error('[任务管理器] 获取任务进度失败:', error.message);
    return null; // 返回null，让调用方继续处理
  }
};

// 更新运行时间
const startElapsedTimer = () => {
  // 清除已有计时器
  if (elapsedTimer) {
    clearInterval(elapsedTimer);
  }
  
  // 启动新计时器，每秒更新一次
  elapsedTimer = setInterval(() => {
    if (taskState.running && taskState.startedAt) {
      const now = new Date();
      const started = new Date(taskState.startedAt);
      const elapsedSec = Math.floor((now - started) / 1000);
      
      // 只更新运行时间，不触发其他变化
      taskState.elapsedSec = elapsedSec;
    }
  }, 1000);
};

// 停止运行时间计时器
const stopElapsedTimer = () => {
  if (elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
};

// 开始任务
export const startTask = async () => {
  try {
    // 获取初始关键词和地区ID
    const allKeywords = taskConfig.keywords;
    const allGeoIds = getAllGeoIds();
    
    if (!allKeywords || allKeywords.length === 0) {
      throw new Error('关键词列表为空，请先添加关键词');
    }
    
    if (!allGeoIds || allGeoIds.length === 0) {
      throw new Error('地区ID列表为空，请检查regions.js配置');
    }
    
    // 获取初始关键词和地区ID
    const initialKeyword = allKeywords[0]; 
    const initialGeoId = allGeoIds[0];
    
    // 获取地区名称用于日志
    const geoIdToCountry = new Map();
    Object.values(regions).forEach(region => {
      region.countries.forEach(country => {
        geoIdToCountry.set(country.geoId, `${region.name}-${country.name}`);
      });
    });
    const countryInfo = geoIdToCountry.get(initialGeoId) || '未知国家';
    
    console.log(`[任务管理器] 开始任务: 初始关键词="${initialKeyword}", 初始地区ID=${initialGeoId} (${countryInfo})`);
    
    // 重置任务状态，设置初始关键词和地区ID
    updateTaskState({
      running: true,
      status: 'running',
      geoId: initialGeoId,
      keyword: initialKeyword,
      step: 0,
      geoIndex: 0,
      keywordIndex: 0,
      startedAt: new Date().toISOString(),
      elapsedSec: 0,
      lastBatchCount: 0,
      lastError: null
    });
    
    // 持久化状态
    saveTaskState();
    
    // 启动运行时间计时器
    startElapsedTimer();

    // 测试数据库连接
    await testDbConnection();

    // 尝试清除数据库中的进度，但如果失败也继续执行
    if (isDbConnected) {
      try {
        await prisma.taskProgress.deleteMany({
          where: { id: 'current' }
        });
        console.log('[任务管理器] 成功清除历史进度');
      } catch (dbError) {
        console.error('[任务管理器] 清除历史进度失败（可能是首次运行）:', dbError.message);
        // 继续执行，不中断流程
      }
    }

    // 开始执行任务
    await executeTask();
    return { success: true };
  } catch (error) {
    console.error('启动任务失败:', error);
    updateTaskState({
      running: false,
      status: 'stopped',
      lastError: error.message
    });
    
    // 持久化状态
    saveTaskState();
    
    return { success: false, message: error.message };
  }
};

// 暂停任务
export const pauseTask = () => {
  updateTaskState({
    running: false,
    status: 'paused'
  });
  
  // 持久化状态
  saveTaskState();
  
  // 停止运行时间计时器
  stopElapsedTimer();
  
  return { success: true };
};

// 恢复任务
export const resumeTask = async () => {
  try {
    // 尝试获取保存的进度
    let progress = null;
    let geoIndex = 0;
    let keywordIndex = 0;
    let step = 0;
    
    if (isDbConnected) {
      try {
        progress = await getTaskProgress();
        // 如果有保存的进度，则从保存的进度继续
        if (progress) {
          geoIndex = progress.geoIndex;
          keywordIndex = progress.keywordIndex;
          step = progress.step;
        }
      } catch (dbError) {
        console.error('[任务管理器] 恢复任务时获取进度失败:', dbError.message);
        // 继续执行，使用默认值
      }
    }

    // 获取关键词和地区ID
    const allKeywords = taskConfig.keywords;
    const allGeoIds = getAllGeoIds();
    
    if (!allKeywords || allKeywords.length === 0) {
      throw new Error('关键词列表为空，请先添加关键词');
    }
    
    if (!allGeoIds || allGeoIds.length === 0) {
      throw new Error('地区ID列表为空，请检查regions.js配置');
    }
    
    // 确保索引在有效范围内
    keywordIndex = Math.min(keywordIndex, allKeywords.length - 1);
    geoIndex = Math.min(geoIndex, allGeoIds.length - 1);
    
    // 获取当前关键词和地区ID
    const currentKeyword = allKeywords[keywordIndex];
    const currentGeoId = allGeoIds[geoIndex];
    
    // 获取地区名称用于日志
    const geoIdToCountry = new Map();
    Object.values(regions).forEach(region => {
      region.countries.forEach(country => {
        geoIdToCountry.set(country.geoId, `${region.name}-${country.name}`);
      });
    });
    const countryInfo = geoIdToCountry.get(currentGeoId) || '未知国家';
    
    console.log(`[任务管理器] 恢复任务: 当前关键词="${currentKeyword}", 当前地区ID=${currentGeoId} (${countryInfo})`);

    // 更新任务状态
    updateTaskState({
      running: true,
      status: 'running',
      startedAt: new Date().toISOString(),
      // 如果有保存的进度则使用，否则使用默认值
      geoIndex: geoIndex,
      keywordIndex: keywordIndex,
      step: step,
      // 设置当前关键词和地区ID
      keyword: currentKeyword,
      geoId: currentGeoId
    });

    console.log(`[任务管理器] 恢复任务: geoIndex=${geoIndex}, keywordIndex=${keywordIndex}, step=${step}`);
    
    // 启动运行时间计时器
    startElapsedTimer();
    
    // 持久化状态
    saveTaskState();
    
    // 开始执行任务
    await executeTask();
    return { success: true };
  } catch (error) {
    console.error('[任务管理器] 恢复任务失败:', error.message);
    updateTaskState({
      running: false,
      status: 'stopped',
      lastError: `恢复任务失败: ${error.message}`
    });
    
    // 持久化状态
    saveTaskState();
    
    return { success: false, message: error.message };
  }
};

// 停止任务
export const stopTask = async () => {
  try {
    console.log('[任务管理器] 开始停止任务...');
    
    // 设置中断标志
    taskInterrupted = true;
    
    // 先更新状态为停止中，防止executeTask中的finally提前关闭浏览器
    updateTaskState({
      running: false,
      status: 'stopping'
    });
    
    // 停止运行时间计时器
    stopElapsedTimer();
    
    // 使用系统命令强制关闭Chrome/Chromium进程
    try {
      const { exec } = require('child_process');
      
      console.log('[任务管理器] 尝试通过系统命令强制关闭浏览器进程...');
      
      // 根据不同操作系统执行不同的命令
      let killCommand;
      if (process.platform === 'win32') {
        // Windows
        killCommand = 'taskkill /F /IM chrome.exe /IM chromium.exe /T';
      } else {
        // macOS/Linux
        killCommand = "pkill -f 'chrome|chromium'";
      }
      
      exec(killCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`[任务管理器] 强制关闭浏览器进程出错: ${error.message}`);
          return;
        }
        console.log(`[任务管理器] 浏览器进程关闭输出: ${stdout}`);
      });
      
      // 确保currentBrowser设为null
      currentBrowser = null;
      console.log('[任务管理器] 已尝试通过系统命令关闭所有浏览器进程');
    } catch (killError) {
      console.error('[任务管理器] 强制关闭浏览器进程失败:', killError.message);
    }
    
    // 原有的浏览器关闭逻辑 (作为备份)
    if (currentBrowser) {
      try {
        console.log('[任务管理器] 尝试关闭当前浏览器实例...');
        await currentBrowser.close().catch(e => console.error('[任务管理器] 浏览器关闭出错:', e.message));
        currentBrowser = null;
        console.log('[任务管理器] 浏览器已关闭');
      } catch (closeError) {
        console.error('[任务管理器] 关闭浏览器失败:', closeError.message);
        // 即使关闭失败也置为null，避免后续再使用已损坏的实例
        currentBrowser = null;
      }
    } else {
      console.log('[任务管理器] 未找到活动的浏览器实例变量');
    }
    
    // 等待一小段时间确保资源释放
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // 如果数据库连接正常，尝试清除数据库中的进度
    if (isDbConnected) {
      try {
        await prisma.taskProgress.deleteMany({
          where: { id: 'current' }
        });
        console.log('[任务管理器] 停止任务: 成功清除进度');
      } catch (dbError) {
        console.error('[任务管理器] 停止任务: 清除进度失败:', dbError.message);
      }
    }

    // 更新任务状态 - 完全重置所有状态，但保留keyword和geoId显示
    updateTaskState({
      running: false,
      status: 'stopped',
      // 保留当前的geoId和keyword，方便用户查看上次任务状态
      // geoId: '',
      // keyword: '',
      step: 0,
      geoIndex: 0,
      keywordIndex: 0,
      startedAt: null,
      elapsedSec: 0,
      lastBatchCount: 0,
      lastError: null
    });
    
    // 持久化状态
    saveTaskState();
    
    console.log('[任务管理器] 任务已停止');
    return { success: true };
  } catch (error) {
    console.error('[任务管理器] 停止任务失败:', error.message);
    
    try {
      // 即使出错也尝试重置状态
      updateTaskState({
        running: false,
        status: 'stopped',
        // 保留当前的geoId和keyword，方便用户查看上次任务状态
        // geoId: '',
        // keyword: '',
        step: 0,
        geoIndex: 0,
        keywordIndex: 0,
        startedAt: null,
        elapsedSec: 0,
        lastBatchCount: 0,
        lastError: `停止任务时出错: ${error.message}`
      });
      
      // 持久化状态
      saveTaskState();
    } catch (e) {
      console.error('[任务管理器] 重置状态失败:', e);
    }
    
    return { success: false, message: error.message };
  }
};

// 更新关键词列表
export const updateKeywords = (newKeywords) => {
  taskConfig.keywords = newKeywords;
};

// 添加一个函数来处理已爬取的数据
const saveCollectedData = async (jobsWithDetails) => {
  if (!jobsWithDetails || jobsWithDetails.length === 0) {
    console.log('[任务管理器] 没有需要保存的数据');
    return;
  }

  console.log(`[任务管理器] 开始保存已收集的 ${jobsWithDetails.length} 个职位数据...`);

  try {
    // 测试数据库连接
    const dbConnected = await testDbConnection();
    
    if (dbConnected) {
      console.log('[任务管理器] 数据库连接成功，开始保存到数据库...');
      try {
        const { saveJobs } = require('./prisma');
        await saveJobs(jobsWithDetails);
        console.log(`[任务管理器] ✅ 成功保存 ${jobsWithDetails.length} 个职位到数据库`);
      } catch (saveDbError) {
        console.error(`[任务管理器] ❌ 保存到数据库失败:`, saveDbError);
        // 保存到本地存储
        console.log('[任务管理器] 尝试保存到本地存储...');
        localJobsStorage.push(...jobsWithDetails);
        saveLocalStorageToFile();
        console.log(`[任务管理器] ℹ️ 已将 ${jobsWithDetails.length} 个职位保存到本地存储`);
      }
    } else {
      // 数据库连接失败，保存到本地存储
      console.log('[任务管理器] ❌ 数据库连接失败，保存到本地存储');
      localJobsStorage.push(...jobsWithDetails);
      saveLocalStorageToFile();
      console.log(`[任务管理器] ℹ️ 已将 ${jobsWithDetails.length} 个职位保存到本地存储`);
    }
  } catch (error) {
    console.error('[任务管理器] 保存数据时出错:', error);
    // 出错时也保存到本地存储
    localJobsStorage.push(...jobsWithDetails);
    saveLocalStorageToFile();
    console.log(`[任务管理器] ℹ️ 已将 ${jobsWithDetails.length} 个职位保存到本地存储`);
  }
};

// 执行任务
async function executeTask() {
  let jobsWithDetails = []; // 移到外部，确保在任务停止时能访问到
  
  // 重置中断标志
  taskInterrupted = false;
  
  try {
    // 添加中断检查函数
    const checkInterruption = async () => {
      if (taskInterrupted || !taskState.running || taskState.status === 'stopping' || taskState.status === 'stopped') {
        console.log('[任务管理器] 检测到任务中断标志，停止执行');
        
        // 保存已收集的数据
        if (jobsWithDetails && jobsWithDetails.length > 0) {
          console.log(`[任务管理器] 中断前保存 ${jobsWithDetails.length} 个已收集的职位数据...`);
          await saveCollectedData(jobsWithDetails);
        }
        
        // 关闭浏览器（如果存在）
        if (currentBrowser) {
          try {
            console.log('[任务管理器] 尝试关闭浏览器实例...');
            await currentBrowser.close().catch(e => {
              console.error('[任务管理器] 中断时关闭浏览器出错:', e.message);
            });
            currentBrowser = null;
          } catch (e) {
            console.error('[任务管理器] 中断时关闭浏览器失败:', e.message);
          }
        }
        
        throw new Error('任务已被中断');
      }
    };
    
    const geoIds = getAllGeoIds();
    
    // 添加调试日志，显示所有可用的geoIds
    console.log(`[任务管理器] 获取到 ${geoIds.length} 个地区ID:`);
    // 获取每个geoId对应的国家名称并打印
    const geoIdToCountry = new Map();
    Object.values(regions).forEach(region => {
      region.countries.forEach(country => {
        geoIdToCountry.set(country.geoId, `${region.name}-${country.name}`);
      });
    });
    
    geoIds.forEach((geoId, index) => {
      console.log(`  - [${index}] ${geoId} (${geoIdToCountry.get(geoId) || '未知国家'})`);
    });
    
    // 获取保存的进度（如果有）
    let progress = null;
    let geoIndex = 0;
    let keywordIndex = 0;
    let step = 0;
    
    if (isDbConnected) {
      try {
        progress = await getTaskProgress();
        // 如果有保存的进度，则从保存的进度继续
        if (progress) {
          geoIndex = progress.geoIndex;
          keywordIndex = progress.keywordIndex;
          step = progress.step;
        }
      } catch (dbError) {
        console.error('[任务管理器] 获取任务进度失败，将从头开始:', dbError.message);
        // 使用默认值从头开始
      }
    }
    
    // 更新任务状态
    updateTaskState({
      geoIndex,
      keywordIndex,
      step
    });
    
    console.log(`[任务管理器] 开始执行任务: 从geoIndex=${geoIndex}, keywordIndex=${keywordIndex}, step=${step}开始`);
    
    // 验证数据
    if (!Array.isArray(geoIds) || geoIds.length === 0) {
      throw new Error('无法获取geoIds列表，请检查regions.js文件');
    }
    
    if (!Array.isArray(taskConfig.keywords) || taskConfig.keywords.length === 0) {
      throw new Error('关键词列表为空，请先添加关键词');
    }
    
    // 导入必要的库
    const { chromium } = require('playwright');
    
    // 遍历地区、关键词和步骤
    for (; keywordIndex < taskConfig.keywords.length; keywordIndex++) {
      // 检查任务状态
      await checkInterruption();
  
      const keyword = taskConfig.keywords[keywordIndex];
      console.log(`[任务管理器] 开始处理关键词 "${keyword}" (${keywordIndex+1}/${taskConfig.keywords.length})`);
      updateTaskState({ keyword });
      
      for (; geoIndex < geoIds.length; geoIndex++) {
        // 检查任务状态
        await checkInterruption();
        
        const geoId = geoIds[geoIndex];
        // 添加日志，显示当前处理的地区信息
        const countryInfo = geoIdToCountry.get(geoId) || '未知国家';
        console.log(`[任务管理器] 开始处理地区 [${geoIndex+1}/${geoIds.length}]: ${geoId} (${countryInfo})`);
        
        updateTaskState({ geoId });
        
        // 内层步骤循环
        for (; step < taskConfig.steps.length; step++) {
          // 检查任务状态
          await checkInterruption();
          
          updateTaskState({ step });
          const currentStep = taskConfig.steps[step];
          
          // 创建浏览器实例
          console.log(`[任务管理器] 启动浏览器...`);
          
          try {
            currentBrowser = await chromium.launch({
              headless: true,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1200,800',
              ],
              slowMo: 20,
            });
            
            const context = await currentBrowser.newContext({
              viewport: { width: 1200, height: 800 },
              locale: 'en-US',
              geolocation: { longitude: -122.4194, latitude: 37.7749 },
              permissions: ["geolocation"],
              userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
              extraHTTPHeaders: {
                "accept-language": "en-US,en;q=0.9",
                "cache-control": "max-age=0",
                "sec-ch-ua": '"Chromium";v="118", "Google Chrome";v="118"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "macOS",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "sec-fetch-user": "?1",
              }
            });
            
            const page = await context.newPage();
            
            // 添加页面错误处理
            page.on('error', error => {
              console.error(`[任务管理器] 页面错误:`, error);
              if (!taskState.running) {
                console.log('[任务管理器] 任务已停止，不再处理页面错误');
                return;
              }
            });
            
            // 添加页面关闭处理
            page.on('close', () => {
              console.log('[任务管理器] 页面已关闭');
              if (!taskState.running) {
                console.log('[任务管理器] 任务已停止，不再处理页面关闭事件');
                return;
              }
            });
            
            page.setDefaultTimeout(60000);
            page.setDefaultNavigationTimeout(60000);
            
            // 构建API URL
            const apiUrl = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
            
            // 构建查询参数
            const queryParams = new URLSearchParams();
            queryParams.append('keywords', keyword);
            
            // 重要修复：确保使用当前geoIndex对应的geoId
            queryParams.append('geoId', geoId);
            console.log(`[任务管理器] 使用geoIndex=${geoIndex}的geoId=${geoId} (${countryInfo})`);
            
            // 添加当前步骤的所有过滤条件
            Object.entries(currentStep).forEach(([key, value]) => {
              if (Array.isArray(value)) {
                queryParams.append(key, value.join(','));
              } else {
                queryParams.append(key, value);
              }
            });
            
            // 分页处理变量
            let start = 0;
            let hasMorePages = true;
            let currentPage = 0;
            let retryCount = 0;
            let consecutiveEmptyPages = 0;
            let jobInfos = []; // 新增：在外部定义jobInfos数组，确保数据在多页中累积
            const maxPages = 40; // 最多爬取10页，每页约10个职位
            
            // 爬取多页结果
            while (hasMorePages && currentPage < maxPages && retryCount < 3) {
              // 构建带分页参数的URL
              const paginatedParams = new URLSearchParams(queryParams);
              paginatedParams.append('start', start.toString());
              const fullUrl = `${apiUrl}?${paginatedParams.toString()}`;
              
              console.log(`[任务管理器] 执行搜索页 ${currentPage+1}: ${fullUrl}`);
              
              // 爬取数据
              await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
              await page.waitForTimeout(1000);
              
              // 获取职位卡片
              const jobCards = await page.$$("li");
              
              if (jobCards.length === 0) {
                console.log(`[任务管理器] 第 ${currentPage+1} 页未找到职位数据`);
                
                // 检查是否被限制访问
                const pageText = await page.evaluate(() => document.body.textContent);
                if (pageText.includes("无法访问") || pageText.includes("rate limit") || pageText.includes("blocked")) {
                  console.log(`[任务管理器] LinkedIn可能限制了请求，暂停爬取`);
                  hasMorePages = false;
                  break;
                }
                
                // 增加重试或空页计数
                retryCount++;
                
                if (retryCount <= 2) {
                  console.log(`[任务管理器] 尝试重试当前页... (第${retryCount}次)`);
                  await page.waitForTimeout(2000);
                  continue; // 不增加start，重试当前页
                } else {
                  consecutiveEmptyPages++;
                  retryCount = 0;
                  
                  if (consecutiveEmptyPages >= 2) {
                    console.log(`[任务管理器] 连续 ${consecutiveEmptyPages} 页无数据，可能达到列表末尾`);
                    hasMorePages = false;
                    break;
                  }
                  
                  // 尝试下一页
                  start += 25;
                  currentPage++;
                  continue;
                }
              }
              
              // 成功获取到数据，重置计数器
              retryCount = 0;
              consecutiveEmptyPages = 0;
              
              console.log(`[任务管理器] 在第 ${currentPage+1} 页找到 ${jobCards.length} 个职位卡片`);
              
              // 修改：直接从当前页面提取职位信息，而不是保存元素引用
              // 这样避免导航到其他页面后元素引用失效的问题
              for (const card of jobCards) {
                try {
                  // 提取所有需要的信息
                  const cardDiv = await card.$("div.base-card");
                  if (!cardDiv) continue;
                  
                  const entityUrn = await cardDiv.getAttribute("data-entity-urn");
                  const refId = await cardDiv.getAttribute("data-reference-id");
                  
                  if (!entityUrn) continue;
                  
                  const jobId = entityUrn.split(":").pop();
                  
                  // 获取职位详情链接
                  const detailLinkEl = await card.$("a.base-card__full-link");
                  const userLink = detailLinkEl ? await detailLinkEl.getAttribute("href") : null;
                  
                  // 构建API URL用于获取数据
                  const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}${refId ? `?refId=${encodeURIComponent(refId.trim())}` : ''}`;
                  
                  // 提取基本信息
                  const titleEl = await card.$(".base-search-card__title");
                  const title = titleEl ? (await titleEl.evaluate(el => el.textContent.trim())) : "未知职位";
                  
                  const companyEl = await card.$(".base-search-card__subtitle a");
                  const company = companyEl ? (await companyEl.evaluate(el => el.textContent.trim())) : "未知公司";
                  
                  const locationEl = await card.$(".job-search-card__location");
                  const location = locationEl ? (await locationEl.evaluate(el => el.textContent.trim())) : "未知地点";
                  
                  const postedEl = await card.$("time.job-search-card__listdate");
                  const postedDate = postedEl ? (await postedEl.getAttribute("datetime")) : null;
                  const postedText = postedEl ? (await postedEl.evaluate(el => el.textContent.trim())) : "未知日期";
                  
                  // 直接添加到jobInfos数组
                  jobInfos.push({
                    job_id: jobId,
                    title,
                    company,
                    location,
                    posted_date_attr: postedDate,
                    posted_text: postedText,
                    link: userLink || `https://www.linkedin.com/jobs/view/${jobId}`,
                    detail_url: detailUrl,
                    ref_id: refId ? refId.trim() : '',
                  });
                } catch (cardError) {
                  console.error(`[任务管理器] 提取职位卡片信息失败:`, cardError.message);
                }
              }
              
              // 准备获取下一页
              start += 25;
              currentPage++;
              
              // 随机延迟一下再请求下一页
              await page.waitForTimeout(Math.random() * 1000 + 500);
            }
            
            console.log(`[任务管理器] 总共提取了 ${jobInfos.length} 个职位的基本信息`);
            updateTaskState({ lastBatchCount: jobInfos.length });
            
            if (jobInfos.length === 0) {
              console.log(`[任务管理器] 未找到职位数据，跳到下一个参数`);
              
              // 判断是否应该继续搜索
              if (step < taskConfig.steps.length - 1) {
                // 结果为0，切换到下一个过滤条件
                continue;
              } else {
                // 最后一步也没有结果，切换到下一个关键词
                break;
              }
            }
            
            // 保存进度
            try {
              await saveTaskProgress(geoIndex, keywordIndex, step);
            } catch (dbError) {
              console.error(`[任务管理器] 保存进度失败:`, dbError.message);
            }
            
            // 获取每个职位的详细信息
            jobsWithDetails = [];
            // 移除单批次上限，对所有职位进行处理
            console.log(`[任务管理器] 将获取 ${jobInfos.length}/${jobInfos.length} 个职位的详细信息`);
            
            // 分批处理，每批次处理50个，避免一次性请求过多导致LinkedIn限制
            const batchSize = 50;
            const totalBatches = Math.ceil(jobInfos.length / batchSize);
            
            for (let batch = 0; batch < totalBatches; batch++) {
              // 在批次开始时检查任务状态
              await checkInterruption();
              
              const startIdx = batch * batchSize;
              const endIdx = Math.min(startIdx + batchSize, jobInfos.length);
              console.log(`[任务管理器] 处理第 ${batch + 1}/${totalBatches} 批次，职位索引 ${startIdx} - ${endIdx - 1}`);
              
              // 处理当前批次的职位
              for (let i = startIdx; i < endIdx; i++) {
                // 在处理每个职位前检查任务状态
                await checkInterruption();
                
                try {
                  const job = jobInfos[i];
                  console.log(`[任务管理器] 获取第 ${i+1}/${jobInfos.length} 个职位详情: ${job.title}`);
                  
                  // 访问详情页
                  try {
                    // 再次检查任务状态，避免在导航前被忽略
                    await checkInterruption();
                    
                    // 设置较短的导航超时
                    await page.goto(job.detail_url, { 
                      waitUntil: "domcontentloaded", 
                      timeout: 15000 // 减少超时时间，以便更快响应停止命令
                    });
                  } catch (navError) {
                    console.error(`[任务管理器] 导航到职位详情页失败:`, navError.message);
                    continue; // 跳过此职位，继续处理下一个
                  }
                  
                  // 在获取详情后立即检查任务状态
                  await checkInterruption();
                  
                  await page.waitForTimeout(1000);
                  
                  // 再次检查任务状态，确保即使在处理过程中收到停止命令也能及时响应
                  await checkInterruption();
                  
                  // 提取职位描述
                  let description = "未找到描述";
                  const descriptionSelectors = [
                    ".show-more-less-html__markup",
                    ".description__text",
                    ".jobs-description-content__text",
                    ".jobs-description__content",
                    ".jobs-box__html-content",
                    ".job-description"
                  ];
                  
                  for (const selector of descriptionSelectors) {
                    try {
                      const descEl = await page.$(selector);
                      if (descEl) {
                        description = await descEl.evaluate(el => el.textContent.trim());
                        break;
                      }
                    } catch (e) {}
                  }
                  
                  // 提取申请人数 - 参考search.js的实现
                  let applicantsCount = "未找到";
                  const applicantSelectors = [
                    "span.num-applicants__caption",
                    ".jobs-unified-top-card__applicant-count",
                    ".jobs-company-hiring__applicant-count",
                    ".job-analytics__applicant-count",
                    ".applicant-count"
                  ];
                  
                  for (const selector of applicantSelectors) {
                    try {
                      const applicantEl = await page.$(selector);
                      if (applicantEl) {
                        applicantsCount = await applicantEl.evaluate(el => {
                          // 移除任何HTML特殊元素
                          const clone = el.cloneNode(true);
                          // 移除所有子元素，只保留直接文本
                          while (clone.firstChild && clone.firstChild.nodeType !== Node.TEXT_NODE) {
                            clone.removeChild(clone.firstChild);
                          }
                          return clone.textContent.trim();
                        });
                        
                        // 只保留数字、逗号和小数点
                        applicantsCount = applicantsCount.replace(/[^\d,.]+/g, '');
                        break;
                      }
                    } catch (e) {}
                  }
                  
                  // 提取薪资信息
                  let salary = "未找到";
                  const salarySelectors = [
                    ".compensation__salary",
                    ".jobs-unified-top-card__salary-details",
                    ".job-details-jobs-unified-top-card__job-insight",
                    ".salary-range",
                    ".job-salary"
                  ];
                  
                  for (const selector of salarySelectors) {
                    try {
                      const salaryEl = await page.$(selector);
                      if (salaryEl) {
                        const salaryText = await salaryEl.evaluate(el => {
                          // 过滤出薪资相关文本
                          const fullText = el.textContent.trim();
                          // 匹配薪资相关格式
                          const salaryMatch = fullText.match(/[\$¥€£₹]\s*[\d,.]+([\s\-]+[\$¥€£₹]?[\d,.]+)?(\s*\/\s*[a-zA-Z]+)?/);
                          return salaryMatch ? salaryMatch[0].trim() : fullText;
                        });
                        
                        if (salaryText && (
                            salaryText.includes("$") || salaryText.includes("¥") || 
                            salaryText.includes("€") || salaryText.includes("£") || 
                            salaryText.includes("₹") || salaryText.includes("元") || 
                            salaryText.includes("万") ||
                            /\d+[Kk]/.test(salaryText) || // 匹配50K这样的格式
                            /\d+.*\d+/.test(salaryText)   // 匹配有数字区间的格式
                          )) {
                          salary = salaryText;
                          break;
                        }
                      }
                    } catch (e) {}
                  }
                  
                  // 提取职位标准信息 (job_criteria) - 参考search.js的实现
                  const jobCriteria = {};
                  let seniority = null;
                  let employmentType = null;
                  let jobFunction = null;
                  let industries = null;
                  
                  const criteriaSelectors = [
                    ".description__job-criteria-item",
                    ".jobs-description-details__list-item",
                    ".jobs-unified-top-card__job-insight",
                    ".job-criteria-item"
                  ];
                  
                  for (const selector of criteriaSelectors) {
                    try {
                      const items = await page.$$(selector);
                      if (items.length > 0) {
                        for (const item of items) {
                          // 尝试不同的标题/值选择器组合
                          const headerSelectors = [".description__job-criteria-subheader", "h3", ".job-criteria-subheader", ".job-insight-label"];
                          const valueSelectors = [".description__job-criteria-text", "span:not(h3)", ".job-criteria-text", ".job-insight-value"];
                          
                          let headerText = null;
                          let valueText = null;
                          
                          // 尝试每一个标题选择器
                          for (const headerSelector of headerSelectors) {
                            try {
                              const headerEl = await item.$(headerSelector);
                              if (headerEl) {
                                headerText = await headerEl.evaluate(el => el.textContent.trim());
                                break;
                              }
                            } catch (e) {}
                          }
                          
                          // 尝试每一个值选择器
                          for (const valueSelector of valueSelectors) {
                            try {
                              const valueEl = await item.$(valueSelector);
                              if (valueEl) {
                                valueText = await valueEl.evaluate(el => el.textContent.trim());
                                break;
                              }
                            } catch (e) {}
                          }
                          
                          if (headerText && valueText) {
                            jobCriteria[headerText.trim()] = valueText.trim();
                            
                            // 解析关键字段
                            const headerLower = headerText.toLowerCase();
                            if (headerLower.includes('seniority') || headerLower.includes('级别')) {
                              seniority = valueText.trim();
                            } else if (headerLower.includes('employment') || headerLower.includes('雇佣') || headerLower.includes('类型')) {
                              employmentType = valueText.trim();
                            } else if (headerLower.includes('function') || headerLower.includes('职能')) {
                              jobFunction = valueText.trim();
                            } else if (headerLower.includes('industries') || headerLower.includes('行业')) {
                              industries = valueText.trim();
                            }
                          }
                        }
                      }
                    } catch (e) {}
                  }
                  
                  // 获取是否远程工作
                  let isRemote = false;
                  try {
                    // 从各种可能的位置检测
                    const remoteSelectors = [
                      ".jobs-unified-top-card__workplace-type",
                      ".jobs-unified-top-card__subtitle-primary .jobs-unified-top-card__bullet",
                      ".job-details-jobs-unified-top-card__workplace-type",
                      ".workplace-type",
                      ".job-type-info"
                    ];
                    
                    let locationText = "";
                    for (const selector of remoteSelectors) {
                      try {
                        const text = await page.$eval(selector, el => el.textContent.toLowerCase());
                        if (text) {
                          locationText += " " + text;
                        }
                      } catch (e) {}
                    }
                    
                    // 扩展远程关键词检查
                    if (locationText.includes('remote') || 
                       locationText.includes('在家工作') || 
                       locationText.includes('远程') || 
                       locationText.includes('remoto') || 
                       locationText.includes('télétravail') ||
                       locationText.includes('homeoffice')) {
                      isRemote = true;
                    } else {
                      // 从职位描述检测
                      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
                      const remoteKeywords = [
                        'fully remote', '100% remote', 'work from home', 'remote position', 
                        'remoto', 'trabajo remoto', '远程工作', '在家工作', 'working remotely', 
                        'remote work', 'remote opportunity', 'home office', 'work from anywhere',
                        '远程办公', '居家办公', '全远程', '可远程'
                      ];
                      for (const keyword of remoteKeywords) {
                        if (pageText.includes(keyword.toLowerCase())) {
                          isRemote = true;
                          break;
                        }
                      }
                    }
                  } catch (e) {}
                  
                  // 合并信息
                  const jobWithDetails = {
                    ...job,
                    job_description: description,
                    applicants_count: applicantsCount,
                    salary_range: salary,
                    is_remote: isRemote,
                    job_criteria: jobCriteria,
                    seniority: seniority,
                    employment_type: employmentType,
                    job_function: jobFunction,
                    industries: industries
                  };
                  
                  jobsWithDetails.push(jobWithDetails);
                  
                  // 避免请求过快
                  await page.waitForTimeout(Math.random() * 1000 + 500);
                  
                  // 每个职位处理完成后再检查一次任务状态
                  await checkInterruption();
                } catch (detailError) {
                  console.error(`[任务管理器] 获取职位详情失败:`, detailError.message);
                }
              }
              
              // 每完成一个批次就保存数据
              if (jobsWithDetails.length > 0) {
                await saveCollectedData(jobsWithDetails);
                jobsWithDetails = []; // 清空数组，准备下一批次
              }
            }
            
            console.log(`[任务管理器] 所有批次处理完成，共获取 ${jobsWithDetails.length} 个职位的详细信息`);

            // 如果还有未保存的数据，进行最终保存
            if (jobsWithDetails.length > 0) {
              await saveCollectedData(jobsWithDetails);
            }
            
            // 判断是否需要调整搜索策略
            if (jobInfos.length >= 50) {
              // 结果数量足够，继续下一步
              console.log(`[任务管理器] 结果数量足够 (${jobInfos.length} >= 50)，继续下一步`);
              // 这里不需要额外操作，自然会进入下一个step
            } else {
              // 结果数量过少，切换到下一个地区
              console.log(`[任务管理器] 结果数量过少 (${jobInfos.length} < 50)，切换地区`);
              step = 0; // 重置步骤
              
              // 修复：改为直接更新geoIndex并跳到下一个地区，无需break
              // 由于for循环中的geoIndex++会在下一次迭代再次增加，这里我们直接设置好确切的值
              const nextGeoIndex = geoIndex + 1; // 直接计算下一个地区索引
              
              // 添加边界检查，防止geoIndex超出范围
              if (nextGeoIndex >= geoIds.length) {
                console.log(`[任务管理器] 当前关键词"${keyword}"已遍历所有${geoIds.length}个地区，准备处理下一个关键词`);
                
                // 所有地区都处理完毕，重置geoIndex，增加keywordIndex
                geoIndex = -1; // 设为-1因为循环会再+1变成0
                keywordIndex++; // 增加关键词索引
                step = 0;
                
                // 如果所有关键词都处理完毕，结束任务
                if (keywordIndex >= taskConfig.keywords.length) {
                  console.log(`[任务管理器] 已完成所有${taskConfig.keywords.length}个关键词在所有地区的抓取任务，任务将结束`);
                  
                  // 任务完成
                  updateTaskState({
                    running: false,
                    status: 'completed',
                    geoId: '',
                    keyword: '',
                    step: 0,
                    geoIndex: 0,
                    keywordIndex: 0,
                    lastError: '已完成所有关键词和地区的抓取任务'
                  });
                  
                  return; // 结束整个任务
                }
                
                // 更新状态
                updateTaskState({ 
                  geoIndex: 0, 
                  keywordIndex, 
                  keyword: taskConfig.keywords[keywordIndex],
                  geoId: ''  
                });
                
                console.log(`[任务管理器] 开始处理下一个关键词"${taskConfig.keywords[keywordIndex]}"（${keywordIndex+1}/${taskConfig.keywords.length}）`);
                
                // 保存进度
                try {
                  await saveTaskProgress(0, keywordIndex, 0);
                } catch (dbError) {
                  console.error(`[任务管理器] 保存切换关键词后的进度失败:`, dbError.message);
                }
              } else {
                // 正常切换到下一个地区
                geoIndex = nextGeoIndex - 1; // 减1是因为循环会自动加1
                
                // 获取新的geoId
                const newGeoId = geoIds[nextGeoIndex];
                const newCountryInfo = geoIdToCountry.get(newGeoId) || '未知国家';
                console.log(`[任务管理器] 切换到下一个地区，新的geoIndex=${nextGeoIndex}/${geoIds.length}: ${newGeoId} (${newCountryInfo})`);
                
                // 更新任务状态 - 同时更新geoId
                updateTaskState({ 
                  geoIndex: nextGeoIndex, 
                  keywordIndex, 
                  geoId: newGeoId  
                });
                
                // 保存进度
                try {
                  await saveTaskProgress(nextGeoIndex, keywordIndex, 0);
                } catch (dbError) {
                  console.error(`[任务管理器] 保存切换地区后的进度失败:`, dbError.message);
                }
              }
              
              break; // 跳出步骤循环，但不会重复增加geoIndex
            }
            
          } catch (error) {
            console.error(`[任务管理器] 创建浏览器实例失败:`, error);
            throw error;
          } finally {
            // 只有当任务状态不是运行中时才关闭浏览器
            // 如果任务状态是运行中，让stopTask函数来关闭浏览器
            if (!taskState.running && currentBrowser) {
              try {
                await currentBrowser.close();
                currentBrowser = null;
                console.log(`[任务管理器] 浏览器已关闭`);
              } catch (e) {
                console.error(`[任务管理器] 关闭浏览器失败:`, e.message);
              }
            }
          }
        }
        
        // 重置步骤计数器
        step = 0;
      }
      
      // 一个关键词处理完所有地区后重置geoIndex
      geoIndex = 0;
      // 重置步骤计数器
      step = 0;
    }
    
    // 任务完成
    console.log(`[任务管理器] 任务完成，已处理所有关键词和地区`);
    updateTaskState({
      running: false,
      status: 'completed',
      geoId: '',
      keyword: '',
      step: 0,
      geoIndex: 0,
      keywordIndex: 0,
      lastError: null
    });
    
  } catch (error) {
    console.error(`[任务管理器] 任务执行错误:`, error);
    
    // 检查是否是因为中断而抛出的错误
    if (error.message === '任务已被中断') {
      console.log('[任务管理器] 任务被正常中断');
      
      // 任务正常中断不作为错误处理
      updateTaskState({
        running: false,
        status: 'stopped',
        lastError: null
      });
    } else {
      // 其他错误正常处理
      updateTaskState({
        running: false,
        status: 'stopped',
        lastError: error.message
      });
    }
    
    // 持久化状态
    saveTaskState();
    
    // 确保浏览器实例被关闭
    if (currentBrowser) {
      try {
        console.log('[任务管理器] 错误处理中关闭浏览器...');
        await currentBrowser.close().catch(e => {});
        currentBrowser = null;
      } catch (closeError) {}
    }
  }
} 