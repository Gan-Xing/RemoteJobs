import { useState, useEffect } from 'react';

const LocalStorageMonitor = () => {
  const [localJobsCount, setLocalJobsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success', 'error', 'info'
  const [lastChecked, setLastChecked] = useState(null);
  const [apiResponse, setApiResponse] = useState(null);

  // 获取本地存储的职位数量
  const fetchLocalJobsCount = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/task/local-jobs-count');
      const data = await response.json();
      
      // 保存原始API响应用于调试
      setApiResponse(data);
      setLastChecked(new Date().toLocaleTimeString());
      
      if (data.success) {
        setLocalJobsCount(data.count);
        if (data.count > 0) {
          console.log(`[LocalStorageMonitor] 检测到${data.count}个本地未保存的职位数据`);
        }
      } else {
        setMessage(data.message || '获取本地存储数据失败');
        setMessageType('error');
      }
    } catch (error) {
      console.error('获取本地存储数据失败:', error);
      setMessage('获取本地存储数据失败');
      setMessageType('error');
      setApiResponse({error: error.message});
    } finally {
      setIsLoading(false);
    }
  };

  // 保存本地数据到数据库
  const saveLocalJobs = async () => {
    if (localJobsCount === 0) {
      setMessage('没有本地数据需要保存');
      setMessageType('info');
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/task/save-local-data', {
        method: 'POST',
      });
      
      const data = await response.json();
      setApiResponse(data);
      
      if (data.success) {
        setMessage(`保存成功: ${data.message}`);
        setMessageType('success');
        // 刷新本地存储数量
        fetchLocalJobsCount();
      } else {
        setMessage(`保存失败: ${data.message}`);
        setMessageType('error');
      }
    } catch (error) {
      console.error('保存本地数据失败:', error);
      setMessage(`保存失败: ${error.message}`);
      setMessageType('error');
      setApiResponse({error: error.message});
    } finally {
      setIsLoading(false);
    }
  };

  // 手动刷新
  const handleRefresh = () => {
    fetchLocalJobsCount();
  };

  // 组件加载时获取本地存储数量
  useEffect(() => {
    console.log('[LocalStorageMonitor] 组件已加载，正在获取本地存储数据...');
    fetchLocalJobsCount();
    
    // 每30秒自动刷新一次
    const interval = setInterval(fetchLocalJobsCount, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-medium text-gray-900 mb-2">本地数据监控</h3>
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-gray-700">本地未保存职位:</span>
          <span className={`ml-2 font-medium ${localJobsCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {localJobsCount}
          </span>
          {lastChecked && (
            <span className="ml-2 text-xs text-gray-500">
              最后检查: {lastChecked}
            </span>
          )}
          <button 
            onClick={handleRefresh} 
            className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
            disabled={isLoading}
          >
            刷新
          </button>
        </div>
        
        <button
          onClick={saveLocalJobs}
          disabled={isLoading || localJobsCount === 0}
          className={`px-4 py-2 rounded-md text-white ${
            localJobsCount === 0 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              正在保存...
            </span>
          ) : '保存到数据库'}
        </button>
      </div>
      
      {message && (
        <div className={`p-3 rounded-md ${
          messageType === 'success' ? 'bg-green-50 text-green-800' :
          messageType === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          {message}
        </div>
      )}
      
      <div className="mt-3 text-xs text-gray-500">
        <p>* 本地存储是临时的，当服务器重启后数据将丢失</p>
        <p>* 建议定期手动保存数据到数据库</p>
      </div>
      
      {apiResponse && (
        <div className="mt-3 p-2 bg-gray-50 rounded-md text-xs text-gray-600 overflow-auto max-h-24">
          <details>
            <summary className="cursor-pointer">调试信息</summary>
            <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default LocalStorageMonitor; 