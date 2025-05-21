import { useState } from 'react';

const TaskControls = ({ status, onStart, onPause, onResume, onStop }) => {
  const [error, setError] = useState(null);
  
  const getButtonState = () => {
    switch (status.status) {
      case 'running':
        return {
          showStart: false,
          showPause: true,
          showResume: false,
          showStop: true
        };
      case 'paused':
        return {
          showStart: false,
          showPause: false,
          showResume: true,
          showStop: true
        };
      case 'stopped':
        return {
          showStart: true,
          showPause: false,
          showResume: false,
          showStop: false
        };
      default:
        return {
          showStart: true,
          showPause: false,
          showResume: false,
          showStop: false
        };
    }
  };

  // 处理操作失败
  const handleError = (err) => {
    setError(err.message || '操作失败，请重试');
    setTimeout(() => setError(null), 5000); // 5秒后自动清除错误
  };

  // 包装按钮处理函数
  const handleStart = async () => {
    try {
      setError(null);
      await onStart();
    } catch (err) {
      handleError(err);
    }
  };

  const handlePause = async () => {
    try {
      setError(null);
      await onPause();
    } catch (err) {
      handleError(err);
    }
  };

  const handleResume = async () => {
    try {
      setError(null);
      await onResume();
    } catch (err) {
      handleError(err);
    }
  };

  const handleStop = async () => {
    try {
      setError(null);
      await onStop();
    } catch (err) {
      handleError(err);
    }
  };

  const buttonState = getButtonState();

  return (
    <div>
      {error && (
        <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}
      
      <div className="flex space-x-4 mb-2">
        {buttonState.showStart && (
          <button
            onClick={handleStart}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            开始任务
          </button>
        )}
        
        {buttonState.showPause && (
          <button
            onClick={handlePause}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
          >
            暂停任务
          </button>
        )}
        
        {buttonState.showResume && (
          <button
            onClick={handleResume}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            恢复任务
          </button>
        )}
        
        {buttonState.showStop && (
          <button
            onClick={handleStop}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            停止任务
          </button>
        )}
      </div>
    </div>
  );
};

export default TaskControls; 