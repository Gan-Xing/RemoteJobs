import { getTaskStatus, stopTask } from '../../../utils/taskManager';
import fs from 'fs';
import path from 'path';

// 状态缓存
let statusCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 500; // 缓存有效期500ms

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // 使用缓存减少状态更新频率
      const now = Date.now();
      if (statusCache && now - lastCacheTime < CACHE_TTL) {
        console.log('[API:status] 使用缓存的任务状态');
        return res.status(200).json(statusCache);
      }
      
      console.log('[API:status] 获取并返回最新任务状态');
      const status = getTaskStatus();
      statusCache = status;
      lastCacheTime = now;
      
      return res.status(200).json(status);
    } else if (req.method === 'POST') {
      // 处理重置任务状态请求
      if (req.body && req.body.action === 'reset') {
        console.log('[API:status] 收到重置任务状态请求');
        
        // 检查任务是否正在运行，如果是，先停止任务
        const currentStatus = getTaskStatus();
        if (currentStatus.running) {
          console.log('[API:status] 任务正在运行中，先尝试停止');
          await stopTask();
        }
        
        // 重置状态文件
        const stateFile = path.join(process.cwd(), 'data', 'task_state.json');
        if (fs.existsSync(stateFile)) {
          try {
            // 使用默认的停止状态
            const defaultState = {
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
            
            fs.writeFileSync(stateFile, JSON.stringify(defaultState, null, 2), 'utf8');
            console.log('[API:status] 已重置任务状态文件');
            
            // 更新缓存
            statusCache = defaultState;
            lastCacheTime = Date.now();
            
            return res.status(200).json({ 
              success: true, 
              message: '任务状态已重置',
              status: defaultState
            });
          } catch (e) {
            console.error('[API:status] 重置状态文件失败:', e);
            return res.status(500).json({ 
              success: false, 
              error: '重置状态文件失败: ' + e.message 
            });
          }
        } else {
          console.log('[API:status] 状态文件不存在，无需重置');
          return res.status(200).json({ 
            success: true, 
            message: '状态文件不存在，无需重置'
          });
        }
      }
      
      return res.status(400).json({ error: '不支持的操作' });
    } else {
      return res.status(405).json({ error: '方法不允许' });
    }
  } catch (error) {
    console.error('[API:status] 处理状态请求时出错:', error);
    return res.status(500).json({ error: error.message });
  }
} 