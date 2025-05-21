import { startTask } from '../../../utils/taskManager';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: '方法不允许' });
    }

    console.log('[API] 收到任务启动请求, 方法:', req.method);
    
    console.log('[API] 调用startTask()开始任务...');
    
    // 调用启动任务函数，并接收结果
    const result = await startTask();
    
    if (result && !result.success) {
      console.log(`[API] 任务启动失败: ${result.message}`);
      return res.status(409).json({ 
        error: result.message || '任务启动失败',
        success: false 
      });
    }
    
    console.log('[API] 任务已成功启动');
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[API] 启动任务出错:', error);
    return res.status(500).json({ 
      error: error.message,
      success: false
    });
  }
} 