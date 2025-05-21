import { getLocalJobs, saveLocalJobsToDb, clearLocalJobs } from '../../../utils/taskManager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持POST请求' });
  }

  try {
    // 获取本地存储的职位数据
    const localJobs = getLocalJobs();
    console.log(`[API] 获取到本地存储的职位数据，数量: ${localJobs.length}`);

    if (localJobs.length === 0) {
      return res.status(200).json({
        success: true,
        message: '没有需要保存的本地数据',
        count: 0
      });
    }

    // 尝试保存到数据库
    console.log(`[API] 开始将 ${localJobs.length} 个职位保存到数据库...`);
    const result = await saveLocalJobsToDb();
    console.log(`[API] 本地数据保存结果:`, result);

    // 返回结果
    return res.status(200).json({
      success: result.success,
      message: result.message,
      count: result.count
    });
  } catch (error) {
    console.error(`[API] 保存本地数据时出错:`, error);
    return res.status(500).json({
      success: false,
      message: `保存失败: ${error.message}`,
      error: error.stack
    });
  }
} 