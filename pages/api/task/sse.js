import { getTaskStatus, subscribeToState } from '../../../utils/taskManager';
import fs from 'fs';
import path from 'path';

// 跟踪活动连接
const activeConnections = new Map();
let connectionCount = 0;
const MAX_CONNECTIONS = 10; // 同时最多允许10个连接
const CONNECTION_TIMEOUT = 5 * 60 * 1000; // 5分钟连接超时
const CLEANUP_INTERVAL = 10000; // 10秒清理一次

// 清理断开的连接和超时连接
const cleanupConnections = () => {
  let closedCount = 0;
  let timeoutCount = 0;
  const now = Date.now();
  
  for (const [id, conn] of activeConnections.entries()) {
    // 清理已标记为关闭的连接
    if (conn.closed) {
      activeConnections.delete(id);
      closedCount++;
      continue;
    }
    
    // 清理超时连接（最后一次ping时间超过CONNECTION_TIMEOUT）
    if (now - conn.lastPing > CONNECTION_TIMEOUT) {
      activeConnections.delete(id);
      timeoutCount++;
      continue;
    }
  }
  
  if (closedCount > 0 || timeoutCount > 0) {
    console.log(`[API:sse] 已清理 ${closedCount} 个断开的连接和 ${timeoutCount} 个超时连接，当前剩余 ${activeConnections.size} 个连接`);
  }
};

// 更频繁地清理连接
const cleanupTimer = setInterval(cleanupConnections, CLEANUP_INTERVAL);

// 在服务重启时清理所有连接
process.on('SIGTERM', () => {
  clearInterval(cleanupTimer);
  console.log('[API:sse] 服务关闭，清理所有SSE连接');
  activeConnections.clear();
});

export default async function handler(req, res) {
  // 每次请求前都先执行一次清理，确保连接数准确
  cleanupConnections();
  
  // 生成唯一的连接ID
  const connectionId = Date.now() + '-' + Math.random().toString(36).substring(2, 15);
  
  console.log(`[API:sse] 收到SSE连接请求 ID: ${connectionId}`);
  
  // 限制同时连接数
  if (activeConnections.size >= MAX_CONNECTIONS) {
    console.log(`[API:sse] 拒绝连接请求，已达最大连接数 ${MAX_CONNECTIONS}`);
    return res.status(503).json({
      error: '服务器连接数已达上限，请稍后再试',
      retry_after: 10 // 建议客户端10秒后重试
    });
  }
  
  // 检查是否来自同一个IP的连接过多
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  let ipConnectionCount = 0;
  
  for (const [_, conn] of activeConnections.entries()) {
    if (conn.ip === clientIp) {
      ipConnectionCount++;
    }
  }
  
  // 每个IP最多允许3个连接
  if (ipConnectionCount >= 3) {
    console.log(`[API:sse] 拒绝连接请求，IP ${clientIp} 已有 ${ipConnectionCount} 个连接`);
    return res.status(429).json({
      error: '您的连接请求过于频繁，请稍后再试',
      retry_after: 30
    });
  }
  
  if (req.method !== 'GET') {
    console.log(`[API:sse] 非GET请求被拒绝: ${req.method} ID: ${connectionId}`);
    return res.status(405).json({ error: '方法不允许' });
  }

  // 设置 SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲
  console.log(`[API:sse] SSE头部已设置 ID: ${connectionId}`);

  // 记录连接信息
  activeConnections.set(connectionId, {
    id: connectionId,
    ip: clientIp,
    startTime: Date.now(),
    lastPing: Date.now(),
    closed: false,
  });
  connectionCount++;
  console.log(`[API:sse] 新连接已建立 ID: ${connectionId}，当前活动连接: ${activeConnections.size}，总连接计数: ${connectionCount}`);

  // 获取初始状态
  const initialStatus = getTaskStatus();
  
  // 发送初始状态
  console.log(`[API:sse] 发送初始状态 ID: ${connectionId}`);
  res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);

  // 发送ping确保连接保持活跃
  const pingInterval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(pingInterval);
      return;
    }
    
    try {
      res.write(`:ping\n\n`);
      
      // 更新连接的最后ping时间
      const conn = activeConnections.get(connectionId);
      if (conn) {
        conn.lastPing = Date.now();
      }
    } catch (err) {
      console.error(`[API:sse] 发送ping时出错 ID: ${connectionId}`, err);
      // 标记连接为关闭状态
      const conn = activeConnections.get(connectionId);
      if (conn) {
        conn.closed = true;
      }
      clearInterval(pingInterval);
    }
  }, 30000);

  // 订阅状态更新
  const unsubscribe = subscribeToState((state) => {
    if (res.writableEnded) {
      return;
    }
    
    try {
      const conn = activeConnections.get(connectionId);
      if (!conn || conn.closed) {
        return;
      }
      
      console.log(`[API:sse] 发送状态更新 ID: ${connectionId}, 状态: ${state.status}, 运行: ${state.running}`);
      
      // 发送状态
      res.write(`data: ${JSON.stringify(state)}\n\n`);
    } catch (err) {
      console.error(`[API:sse] 发送状态更新时出错 ID: ${connectionId}`, err);
      // 标记连接为关闭状态
      const conn = activeConnections.get(connectionId);
      if (conn) {
        conn.closed = true;
      }
    }
  });

  // 当客户端断开连接时清理
  req.on('close', () => {
    // 记录连接关闭
    const conn = activeConnections.get(connectionId);
    if (conn) {
      conn.closed = true;
    }
    
    // 取消订阅状态更新
    unsubscribe();
    
    // 清理资源
    clearInterval(pingInterval);
    console.log(`[API:sse] 客户端断开连接 ID: ${connectionId}，持续时间: ${((Date.now() - (conn?.startTime || Date.now())) / 1000).toFixed(1)}秒`);
    
    // 确保响应已结束
    if (!res.writableEnded) {
      res.end();
    }
    
    // 立即移除此连接
    activeConnections.delete(connectionId);
  });
  
  // 添加连接超时处理
  req.on('timeout', () => {
    console.log(`[API:sse] 连接超时 ID: ${connectionId}`);
    // 取消订阅状态更新
    unsubscribe();
    
    const conn = activeConnections.get(connectionId);
    if (conn) {
      conn.closed = true;
    }
    activeConnections.delete(connectionId);
    clearInterval(pingInterval);
    
    if (!res.writableEnded) {
      res.end();
    }
  });
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}; 