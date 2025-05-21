import { getLocalJobs, getTaskStatus } from '../../../utils/taskManager';

export default async function handler(req, res) {
  try {
    // 获取本地存储的职位数据
    const localJobs = getLocalJobs();
    const taskStatus = getTaskStatus();
    
    // 返回结果
    return res.status(200).json({
      success: true,
      count: localJobs.length,
      taskStatus,
      // 如果数据太多，只返回前5条
      sampleData: localJobs.slice(0, 5),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[API] 获取调试信息时出错:`, error);
    return res.status(500).json({
      success: false,
      message: `获取失败: ${error.message}`,
      error: error.stack
    });
  }
} 