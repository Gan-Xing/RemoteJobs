import { updateKeywords } from '../../../utils/taskManager';

export default async function handler(req, res) {
  try {
    // 获取关键词
    if (req.method === 'GET') {
      const { taskConfig } = require('../../../utils/taskManager');
      
      return res.status(200).json({
        keywords: taskConfig.keywords
      });
    }
    
    // 更新关键词
    if (req.method === 'POST') {
      const { keywords } = req.body;
      
      if (!Array.isArray(keywords)) {
        return res.status(400).json({
          error: '关键词必须是数组格式'
        });
      }
      
      // 调用更新函数
      updateKeywords(keywords);
      
      return res.status(200).json({
        success: true,
        message: '关键词已更新',
        keywords
      });
    }
    
    // 不支持的方法
    return res.status(405).json({
      error: '不支持的请求方法'
    });
  } catch (error) {
    console.error('关键词API错误:', error);
    return res.status(500).json({
      error: error.message || '处理关键词请求时出错'
    });
  }
} 