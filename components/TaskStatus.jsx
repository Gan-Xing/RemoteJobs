import { useState, useEffect, useRef, useCallback } from 'react';
import { formatTime } from '../utils/formatters';
import { useSSE } from './SSEProvider';

const TaskStatus = ({ status, onStatusChange }) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [localStatus, setLocalStatus] = useState(status || { status: 'stopped', running: false });
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);
  
  // 使用SSE提供者
  const { connected: sseConnected, taskStatus: sseTaskStatus, error: sseError } = useSSE();
  
  // 初始状态是否已获取
  const initialFetchDoneRef = useRef(false);
  
  // 使用传入的状态或从SSE获取的状态
  // 优先级：props status > SSE status > local status
  const displayStatus = status || sseTaskStatus || localStatus;
  
  // 启动或停止本地计时器
  useEffect(() => {
    // 停止现有计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // 如果任务正在运行，启动本地计时器
    if (displayStatus && displayStatus.running && displayStatus.status === 'running') {
      setTimerRunning(true);
      
      // 使用displayStatus中的elapsedSec作为基准
      if (displayStatus.elapsedSec !== undefined && displayStatus.elapsedSec !== null) {
        setElapsedTime(displayStatus.elapsedSec);
      }
      
      // 启动计时器每秒递增
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setTimerRunning(false);
      
      // 如果任务不在运行，且有elapsedSec，使用它
      if (displayStatus && displayStatus.elapsedSec !== undefined) {
        setElapsedTime(displayStatus.elapsedSec);
      }
    }
    
    // 组件卸载或状态变化时清理计时器
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [displayStatus]);
  
  // 当从SSE获取新状态时更新本地状态
  useEffect(() => {
    if (sseTaskStatus) {
      // 更新本地状态
      setLocalStatus(sseTaskStatus);
      
      // 如果计时器没有运行，或者状态不是running，则更新elapsedTime
      if (!timerRunning || sseTaskStatus.status !== 'running') {
        if (sseTaskStatus.elapsedSec !== undefined && sseTaskStatus.elapsedSec !== null) {
          setElapsedTime(sseTaskStatus.elapsedSec);
        }
      }
      
      // 通知父组件状态变化
      if (onStatusChange) {
        onStatusChange(sseTaskStatus);
      }
      
      initialFetchDoneRef.current = true;
    }
  }, [sseTaskStatus, onStatusChange, timerRunning]);
  
  // 组件挂载时，如果没有SSE数据，则手动获取一次初始状态
  useEffect(() => {
    // 如果没有获取到SSE数据，手动获取一次
    if (!initialFetchDoneRef.current && !sseTaskStatus) {
      fetch('/api/task/status')
        .then(response => {
          if (response.ok) return response.json();
          throw new Error('获取状态失败');
        })
        .then(data => {
          setLocalStatus(data);
          if (data.elapsedSec !== undefined && data.elapsedSec !== null) {
            setElapsedTime(data.elapsedSec);
          }
          if (onStatusChange) {
            onStatusChange(data);
          }
          initialFetchDoneRef.current = true;
        })
        .catch(error => {
          console.error('获取初始任务状态失败:', error);
        });
    }
    
    // 组件卸载时清理资源
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [onStatusChange, sseTaskStatus]);
  
  const getStatusColor = () => {
    switch (displayStatus.status) {
      case 'running':
        return 'text-green-600';
      case 'paused':
        return 'text-yellow-600';
      case 'stopped':
        return 'text-red-600';
      case 'completed':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };
  
  const getStatusText = () => {
    switch (displayStatus.status) {
      case 'running':
        return '运行中';
      case 'paused':
        return '已暂停';
      case 'stopped':
        return '已停止';
      case 'completed':
        return '已完成';
      default:
        return '未知状态';
    }
  };

  return (
    <div>
      <div className="mb-4 p-4 border rounded-lg bg-white shadow-sm">
        <h3 className="text-lg font-medium mb-2 flex items-center">
          <svg className="w-5 h-5 mr-1 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          任务状态
          {sseConnected ? (
            <span className="ml-2 text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">实时更新</span>
          ) : (
            <span className="ml-2 text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded-full">未连接</span>
          )}
        </h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">状态:</span>
              <span className={`font-semibold ${getStatusColor()}`}>{getStatusText()}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">运行时间:</span>
              <span className={`font-mono ${timerRunning ? 'text-green-600' : ''}`}>{formatTime(elapsedTime)}</span>
            </div>
            {displayStatus.keywordIndex !== undefined && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">关键词进度:</span>
                <span className="font-mono">
                  {displayStatus.keywordIndex + 1}/{displayStatus.keywords?.length || '?'}
                </span>
              </div>
            )}
            {displayStatus.keyword !== undefined && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">当前关键词:</span>
                <span className="font-mono truncate max-w-[150px]" title={displayStatus.keyword || '未设置'}>
                  {displayStatus.keyword !== '' ? displayStatus.keyword : <span className="text-gray-400 italic">未设置</span>}
                </span>
              </div>
            )}
          </div>
          
          <div>
            {displayStatus.geoIndex !== undefined && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">地区进度:</span>
                <span className="font-mono">
                  {displayStatus.geoIndex + 1}/{displayStatus.geoTotal || '?'}
                </span>
              </div>
            )}
            {displayStatus.geoId !== undefined && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">当前地区ID:</span>
                <span className="font-mono">
                  {displayStatus.geoId !== '' ? displayStatus.geoId : <span className="text-gray-400 italic">未设置</span>}
                </span>
              </div>
            )}
            {displayStatus.step !== undefined && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">筛选器步骤:</span>
                <span className="font-mono">
                  {displayStatus.step + 1}/{displayStatus.stepTotal || '?'}
                </span>
              </div>
            )}
            {displayStatus.lastBatchCount !== undefined && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">最近批次数量:</span>
                <span className="font-mono">
                  {displayStatus.lastBatchCount}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {displayStatus.lastError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
            <div className="font-semibold mb-1">错误信息:</div>
            <div className="overflow-auto max-h-24">{displayStatus.lastError}</div>
          </div>
        )}
        
        {sseError && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs">
            <div className="font-semibold mb-1">连接状态:</div>
            <div>{sseError}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskStatus; 