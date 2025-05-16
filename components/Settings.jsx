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
  
  if (!isOpen) return null;
  
  // 计算预计时间（秒）
  const estimatedTime = Math.ceil(maxJobDetails * 10); // 每个详情平均10秒
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
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
        
        <div className="p-6">
          <div className="mb-4">
            <label htmlFor="maxJobs" className="block text-sm font-medium text-gray-700 mb-1">
              最大搜索职位数量
            </label>
            <div className="flex items-center">
              <input
                type="range"
                id="maxJobs"
                min="5"
                max="1000"
                step="5"
                value={maxJobs}
                onChange={(e) => setMaxJobs(Number(e.target.value))}
                className="w-full mr-3"
              />
              <span className="text-gray-700 min-w-[3rem] text-center">{maxJobs}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              搜索时返回的职位总数（建议根据实际需求设置，数量越大加载时间越长）
            </p>
          </div>
          
          <div className="mb-6">
            <label htmlFor="maxJobDetails" className="block text-sm font-medium text-gray-700 mb-1">
              获取详情的职位数量
            </label>
            <div className="flex items-center">
              <input
                type="range"
                id="maxJobDetails"
                min="1"
                max="1000"
                step="1"
                value={maxJobDetails}
                onChange={(e) => setMaxJobDetails(Number(e.target.value))}
                className="w-full mr-3"
              />
              <span className="text-gray-700 min-w-[3rem] text-center">{maxJobDetails}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              将获取详细信息的职位数量（每个详情需要额外请求，预计总用时约{estimatedTime}秒）
            </p>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 