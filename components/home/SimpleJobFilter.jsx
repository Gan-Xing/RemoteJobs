import { useState } from 'react';

export default function JobFilter({ sortBy, onSortChange, totalJobs, onFilterChange = () => {} }) {
  const [filters, setFilters] = useState({
    isRemoteOnly: false,
    seniority: 'all'
  });

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-100">
      <div className="flex flex-col space-y-5">
        {/* 头部区域：职位统计和远程工作开关 */}
        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
            <span className="font-medium text-gray-700">
              共找到 <span className="font-bold text-indigo-600">{totalJobs}</span> 个符合条件的职位
            </span>
          </div>
        
          <div className="bg-gray-50 p-1 rounded-md shadow-sm">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only"
                checked={filters.isRemoteOnly}
                onChange={(e) => handleFilterChange('isRemoteOnly', e.target.checked)}
              />
              <span className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${filters.isRemoteOnly ? 'bg-indigo-600 text-white shadow-sm' : 'bg-transparent text-gray-600 hover:bg-gray-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`inline-block h-4 w-4 mr-2 ${filters.isRemoteOnly ? 'text-white' : 'text-gray-500'}`} viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                仅显示远程工作
              </span>
            </label>
          </div>
        </div>
        
        {/* 筛选区域 - 级别和排序 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 职位级别筛选 */}
          <div>
            <label htmlFor="seniority" className="block text-sm font-medium text-gray-700 mb-1">
              职位级别
            </label>
            <div className="relative">
              <select
                id="seniority"
                value={filters.seniority}
                onChange={(e) => handleFilterChange('seniority', e.target.value)}
                className="appearance-none block w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
              >
                <option value="all">所有级别</option>
                <option value="Entry level">初级</option>
                <option value="Associate">助理</option>
                <option value="Mid-Senior level">中高级</option>
                <option value="Director">总监</option>
                <option value="Executive">高管</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* 排序方式 */}
          <div>
            <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-1">
              排序方式
            </label>
            <div className="relative">
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="appearance-none block w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
              >
                <option value="relevance">相关性</option>
                <option value="salary_high">薪资(高到低)</option>
                <option value="recent">最新发布</option>
                <option value="company">公司名称</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* 活跃筛选条件展示 */}
        {(filters.seniority !== 'all' || filters.isRemoteOnly) && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 mt-2">
            <span className="text-sm text-gray-500">已选择:</span>
            
            {filters.isRemoteOnly && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                远程工作
                <button 
                  type="button" 
                  className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-indigo-400 hover:bg-indigo-200 focus:outline-none"
                  onClick={() => handleFilterChange('isRemoteOnly', false)}
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            )}
            
            {filters.seniority !== 'all' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {filters.seniority === 'Entry level' ? '初级' : 
                 filters.seniority === 'Associate' ? '助理' : 
                 filters.seniority === 'Mid-Senior level' ? '中高级' : 
                 filters.seniority === 'Director' ? '总监' : '高管'}
                <button 
                  type="button" 
                  className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-purple-400 hover:bg-purple-200 focus:outline-none"
                  onClick={() => handleFilterChange('seniority', 'all')}
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            )}
            
            {(filters.seniority !== 'all' || filters.isRemoteOnly) && (
              <button 
                type="button" 
                className="text-xs text-gray-500 hover:text-gray-700 underline ml-2"
                onClick={() => {
                  setFilters({
                    isRemoteOnly: false,
                    seniority: 'all'
                  });
                }}
              >
                清除全部
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 