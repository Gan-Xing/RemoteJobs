import { useState, useEffect } from 'react';

export default function Settings({ isOpen, onClose, onSave, defaultSettings }) {
  const [maxJobs, setMaxJobs] = useState(defaultSettings?.maxJobs || 20);
  const [maxJobDetails, setMaxJobDetails] = useState(defaultSettings?.maxJobDetails || 5);
  
  useEffect(() => {
    if (defaultSettings) {
      setMaxJobs(defaultSettings.maxJobs || 20);
      setMaxJobDetails(defaultSettings.maxJobDetails || 5);
    }
  }, [defaultSettings]);
  
  const handleSave = () => {
    onSave({ maxJobs, maxJobDetails });
    onClose();
  };

  const handleMaxJobsChange = (value) => {
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      setMaxJobs(Math.min(Math.max(numValue, 10), 400));
    }
  };

  const handleMaxJobDetailsChange = (value) => {
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      setMaxJobDetails(Math.min(Math.max(numValue, 1), 400));
    }
  };
  
  if (!isOpen) return null;
  
  // 计算预计时间（秒）
  const estimatedTime = Math.ceil(maxJobDetails * 10); // 每个详情平均10秒
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">搜索设置</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                搜索职位数量
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="10"
                  max="400"
                  value={maxJobs}
                  onChange={(e) => handleMaxJobsChange(e.target.value)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <input
                  type="range"
                  min="10"
                  max="400"
                  step="5"
                  value={maxJobs}
                  onChange={(e) => handleMaxJobsChange(e.target.value)}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                设置搜索返回的职位总数 (10-400)
              </p>
            </div>
            
            <div className="border-b border-gray-200 pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                职位详情数量
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="1"
                  max="400"
                  value={maxJobDetails}
                  onChange={(e) => handleMaxJobDetailsChange(e.target.value)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <input
                  type="range"
                  min="1"
                  max="400"
                  step="1"
                  value={maxJobDetails}
                  onChange={(e) => handleMaxJobDetailsChange(e.target.value)}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                设置需要获取详细信息的职位数量 (1-400)
              </p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 