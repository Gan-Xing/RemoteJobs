import { useState, useEffect } from 'react';
import KeywordConfigManager from './KeywordConfigManager';
import CountryConfigManager from './CountryConfigManager';

const SearchConfigModal = ({ 
  isOpen, 
  onClose, 
  keywordItems = [], 
  countryItems = [], 
  onSave 
}) => {
  const [activeTab, setActiveTab] = useState('keywords');
  const [localKeywordItems, setLocalKeywordItems] = useState(keywordItems);
  const [localCountryItems, setLocalCountryItems] = useState(countryItems);
  const [isSaving, setIsSaving] = useState(false);

  // 当弹窗打开时，重置本地状态
  useEffect(() => {
    if (isOpen) {
      setLocalKeywordItems([...keywordItems]);
      setLocalCountryItems([...countryItems]);
    }
  }, [isOpen, keywordItems, countryItems]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        keywordItems: localKeywordItems,
        countryItems: localCountryItems
      });
      onClose();
    } catch (error) {
      console.error('保存配置失败:', error);
      alert('保存配置失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">搜索配置</h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 标签页 */}
        <div className="px-6 py-2 border-b border-gray-200">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('keywords')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'keywords'
                  ? 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              关键词配置
            </button>
            <button
              onClick={() => setActiveTab('countries')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'countries'
                  ? 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              国家配置
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {activeTab === 'keywords' && (
            <KeywordConfigManager
              keywordItems={localKeywordItems}
              onUpdate={setLocalKeywordItems}
            />
          )}
          
          {activeTab === 'countries' && (
            <CountryConfigManager
              countryItems={localCountryItems}
              onUpdate={setLocalCountryItems}
            />
          )}
        </div>

        {/* 底部操作区 */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? '保存中...' : '确定'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchConfigModal; 