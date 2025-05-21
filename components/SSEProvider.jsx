import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

// 创建上下文
const SSEContext = createContext(null);

// 自定义Hook，用于获取SSE状态和最新任务数据
export const useSSE = () => {
  const context = useContext(SSEContext);
  if (!context) {
    throw new Error('useSSE必须在SSEProvider内使用');
  }
  return context;
};

// SSE提供者组件
export const SSEProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [taskStatus, setTaskStatus] = useState(null);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectCountRef = useRef(0);
  const isComponentMountedRef = useRef(true);
  
  const MAX_RECONNECT_COUNT = 5;
  const BASE_RECONNECT_DELAY = 2000;
  const MAX_RECONNECT_DELAY = 60000;
  
  // 清理连接
  const cleanup = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      console.log('[SSEProvider] 关闭SSE连接');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setConnected(false);
  };
  
  // 初始化SSE连接
  const initSSE = () => {
    if (!isComponentMountedRef.current) return;
    
    // 如果已有连接，先清理
    if (eventSourceRef.current) {
      cleanup();
    }
    
    try {
      console.log('[SSEProvider] 创建SSE连接');
      eventSourceRef.current = new EventSource(`/api/task/sse?t=${Date.now()}`);
      
      eventSourceRef.current.onopen = () => {
        if (!isComponentMountedRef.current) return;
        
        console.log('[SSEProvider] SSE连接已打开');
        setConnected(true);
        setError(null);
        reconnectCountRef.current = 0;
      };
      
      eventSourceRef.current.onerror = (err) => {
        if (!isComponentMountedRef.current) return;
        
        console.error('[SSEProvider] SSE连接错误:', err);
        setConnected(false);
        
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        
        // 重连逻辑
        if (reconnectCountRef.current < MAX_RECONNECT_COUNT) {
          reconnectCountRef.current++;
          
          const exponentialDelay = Math.min(
            MAX_RECONNECT_DELAY,
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectCountRef.current - 1)
          );
          
          console.log(`[SSEProvider] 将在${exponentialDelay/1000}秒后尝试重连 (${reconnectCountRef.current}/${MAX_RECONNECT_COUNT})`);
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isComponentMountedRef.current) {
              initSSE();
            }
          }, exponentialDelay);
        } else {
          setError('SSE连接失败，请刷新页面重试');
        }
      };
      
      eventSourceRef.current.onmessage = (event) => {
        if (!isComponentMountedRef.current) return;
        
        try {
          const data = JSON.parse(event.data);
          console.log('[SSEProvider] 收到SSE消息');
          setTaskStatus(data);
        } catch (err) {
          console.error('[SSEProvider] 解析SSE消息失败:', err);
        }
      };
    } catch (err) {
      console.error('[SSEProvider] 创建SSE连接失败:', err);
      setError('创建SSE连接失败');
      eventSourceRef.current = null;
    }
  };
  
  // 处理页面可见性变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !eventSourceRef.current && isComponentMountedRef.current) {
        console.log('[SSEProvider] 页面变为可见状态，重新连接SSE');
        initSSE();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  // 组件挂载时初始化SSE
  useEffect(() => {
    isComponentMountedRef.current = true;
    
    // 延迟1秒初始化，避免多个组件同时初始化
    const timeoutId = setTimeout(() => {
      initSSE();
    }, 1000);
    
    // 组件卸载时清理
    return () => {
      isComponentMountedRef.current = false;
      clearTimeout(timeoutId);
      cleanup();
    };
  }, []);
  
  // 提供的上下文值
  const contextValue = {
    connected,
    taskStatus,
    error,
    refreshConnection: initSSE
  };
  
  return (
    <SSEContext.Provider value={contextValue}>
      {children}
    </SSEContext.Provider>
  );
};

export default SSEProvider; 