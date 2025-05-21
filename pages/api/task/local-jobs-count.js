import { getLocalJobs } from '../../../utils/taskManager';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '只支持GET请求' });
  }

  try {
    // 获取本地存储的职位数据
    const localJobs = getLocalJobs();
    
    // 返回结果
    return res.status(200).json({
      success: true,
      count: localJobs.length
    });
  } catch (error) {
    console.error(`[API] 获取本地存储职位数量时出错:`, error);
    return res.status(500).json({
      success: false,
      message: `获取失败: ${error.message}`,
      count: 0
    });
  }
} 