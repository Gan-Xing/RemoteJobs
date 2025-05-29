import { useState } from 'react';

const SearchParamsConfigManager = ({ searchParams = {}, onUpdate }) => {
  const [localParams, setLocalParams] = useState({
    resultThreshold: searchParams.resultThreshold || 50,
    deduplicateBeforeDetail: searchParams.deduplicateBeforeDetail ?? true,
    useDeduplicatedCount: searchParams.useDeduplicatedCount ?? true
  });

  const handleResultThresholdChange = (value) => {
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      setLocalParams(prev => ({
        ...prev,
        resultThreshold: Math.min(Math.max(numValue, 0), 200)
      }));
    }
  };

  const handleToggleDeduplicate = () => {
    setLocalParams(prev => ({
      ...prev,
      deduplicateBeforeDetail: !prev.deduplicateBeforeDetail
    }));
  };

  const handleToggleCountReference = () => {
    setLocalParams(prev => ({
      ...prev,
      useDeduplicatedCount: !prev.useDeduplicatedCount
    }));
  };

  const handleSave = () => {
    onUpdate(localParams);
  };

  return (
    <div className="space-y-6">
      {/* 结果数量阈值设置 */}
      <div className="border-b border-gray-200 pb-4">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          结果数量阈值
        </label>
        <div className="flex items-center space-x-3">
          <input
            type="number"
            min="0"
            max="200"
            value={localParams.resultThreshold}
            onChange={(e) => handleResultThresholdChange(e.target.value)}
            className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          <input
            type="range"
            min="0"
            max="200"
            step="1"
            value={localParams.resultThreshold}
            onChange={(e) => handleResultThresholdChange(e.target.value)}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          设置每个搜索步骤需要达到的最小结果数量 (1-200)
        </p>
      </div>

      {/* 去重设置 */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              在获取详情前进行去重
            </label>
            <p className="text-xs text-gray-500 mt-1">
              启用后将在获取职位详情前先进行去重，可以减少不必要的API调用
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleDeduplicate}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              localParams.deduplicateBeforeDetail ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                localParams.deduplicateBeforeDetail ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 计数参考设置 */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              使用去重后的数量作为参考
            </label>
            <p className="text-xs text-gray-500 mt-1">
              启用后将使用去重后的职位数量与阈值比较，否则使用原始数量
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleCountReference}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              localParams.useDeduplicatedCount ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                localParams.useDeduplicatedCount ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
        >
          保存设置
        </button>
      </div>
    </div>
  );
};

export default SearchParamsConfigManager; 