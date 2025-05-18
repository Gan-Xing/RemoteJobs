import { useState, useEffect } from 'react';

const AdvancedFilters = ({ onFilterChange, initialFilters = {} }) => {
  const [filters, setFilters] = useState({
    f_TPR: '', // 发布日期过滤器
    f_WT: [], // 工作方式过滤器，多选
    f_JT: [], // 职位类型过滤器，多选
    f_E: [],  // 经验级别过滤器，多选
    f_SB2: '', // 薪资过滤器，单选
    ...initialFilters
  });

  // 当过滤器变化时触发父组件回调
  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  // 处理多选过滤器变化
  const handleMultiSelectChange = (e, filterName) => {
    const value = e.target.value;
    const isChecked = e.target.checked;
    
    setFilters(prev => ({
      ...prev,
      [filterName]: isChecked 
        ? [...prev[filterName], value] 
        : prev[filterName].filter(item => item !== value)
    }));
  };

  // 处理单选过滤器变化
  const handleSingleSelectChange = (e, filterName) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: e.target.value
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-5 mb-4 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-800 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
          高级过滤选项
        </h3>
        <button
          type="button"
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center transition-colors"
          onClick={() => setFilters({
            f_TPR: '',
            f_WT: [],
            f_JT: [],
            f_E: [],
            f_SB2: ''
          })}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          重置所有过滤器
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 发布日期过滤器 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">发布日期</label>
          <div className="relative">
            <select 
              className="appearance-none block w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-700"
              value={filters.f_TPR}
              onChange={(e) => handleSingleSelectChange(e, 'f_TPR')}
            >
              <option value="">不限时间</option>
              <option value="r86400">过去24小时</option>
              <option value="r604800">过去一周</option>
              <option value="r2592000">过去一个月</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* 薪资过滤器 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">薪资范围</label>
          <div className="relative">
            <select 
              className="appearance-none block w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-700"
              value={filters.f_SB2}
              onChange={(e) => handleSingleSelectChange(e, 'f_SB2')}
            >
              <option value="">不限薪资</option>
              <option value="1">40K+</option>
              <option value="2">60K+</option>
              <option value="3">80K+</option>
              <option value="4">100K+</option>
              <option value="5">120K+</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-8">
          {/* 工作方式过滤器 */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              工作方式
            </h4>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  id="workmode-1"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  value="1"
                  checked={filters.f_WT.includes('1')}
                  onChange={(e) => handleMultiSelectChange(e, 'f_WT')}
                />
                <label htmlFor="workmode-1" className="ml-2 text-sm text-gray-700">现场办公</label>
              </div>
              <div className="flex items-center">
                <input
                  id="workmode-2"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  value="2"
                  checked={filters.f_WT.includes('2')}
                  onChange={(e) => handleMultiSelectChange(e, 'f_WT')}
                />
                <label htmlFor="workmode-2" className="ml-2 text-sm text-gray-700">远程工作</label>
              </div>
              <div className="flex items-center">
                <input
                  id="workmode-3"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  value="3"
                  checked={filters.f_WT.includes('3')}
                  onChange={(e) => handleMultiSelectChange(e, 'f_WT')}
                />
                <label htmlFor="workmode-3" className="ml-2 text-sm text-gray-700">混合办公</label>
              </div>
            </div>
          </div>
          
          {/* 职位类型过滤器 */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
              </svg>
              职位类型
            </h4>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  id="jobtype-F"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  value="F"
                  checked={filters.f_JT.includes('F')}
                  onChange={(e) => handleMultiSelectChange(e, 'f_JT')}
                />
                <label htmlFor="jobtype-F" className="ml-2 text-sm text-gray-700">全职</label>
              </div>
              <div className="flex items-center">
                <input
                  id="jobtype-P"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  value="P"
                  checked={filters.f_JT.includes('P')}
                  onChange={(e) => handleMultiSelectChange(e, 'f_JT')}
                />
                <label htmlFor="jobtype-P" className="ml-2 text-sm text-gray-700">兼职</label>
              </div>
              <div className="flex items-center">
                <input
                  id="jobtype-C"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  value="C"
                  checked={filters.f_JT.includes('C')}
                  onChange={(e) => handleMultiSelectChange(e, 'f_JT')}
                />
                <label htmlFor="jobtype-C" className="ml-2 text-sm text-gray-700">合同</label>
              </div>
              <div className="flex items-center">
                <input
                  id="jobtype-I"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  value="I"
                  checked={filters.f_JT.includes('I')}
                  onChange={(e) => handleMultiSelectChange(e, 'f_JT')}
                />
                <label htmlFor="jobtype-I" className="ml-2 text-sm text-gray-700">实习</label>
              </div>
            </div>
          </div>
          
          {/* 经验级别过滤器 */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>
              经验级别
            </h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                <div className="flex items-center">
                  <input
                    id="exp-1"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    value="1"
                    checked={filters.f_E.includes('1')}
                    onChange={(e) => handleMultiSelectChange(e, 'f_E')}
                  />
                  <label htmlFor="exp-1" className="ml-2 text-sm text-gray-700">实习</label>
                </div>
                <div className="flex items-center">
                  <input
                    id="exp-2"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    value="2"
                    checked={filters.f_E.includes('2')}
                    onChange={(e) => handleMultiSelectChange(e, 'f_E')}
                  />
                  <label htmlFor="exp-2" className="ml-2 text-sm text-gray-700">入门级</label>
                </div>
                <div className="flex items-center">
                  <input
                    id="exp-3"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    value="3"
                    checked={filters.f_E.includes('3')}
                    onChange={(e) => handleMultiSelectChange(e, 'f_E')}
                  />
                  <label htmlFor="exp-3" className="ml-2 text-sm text-gray-700">助理</label>
                </div>
                <div className="flex items-center">
                  <input
                    id="exp-4"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    value="4"
                    checked={filters.f_E.includes('4')}
                    onChange={(e) => handleMultiSelectChange(e, 'f_E')}
                  />
                  <label htmlFor="exp-4" className="ml-2 text-sm text-gray-700">中高级</label>
                </div>
                <div className="flex items-center">
                  <input
                    id="exp-5"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    value="5"
                    checked={filters.f_E.includes('5')}
                    onChange={(e) => handleMultiSelectChange(e, 'f_E')}
                  />
                  <label htmlFor="exp-5" className="ml-2 text-sm text-gray-700">主管</label>
                </div>
                <div className="flex items-center">
                  <input
                    id="exp-6"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    value="6"
                    checked={filters.f_E.includes('6')}
                    onChange={(e) => handleMultiSelectChange(e, 'f_E')}
                  />
                  <label htmlFor="exp-6" className="ml-2 text-sm text-gray-700">高管</label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 已选择的过滤器 */}
      {(filters.f_TPR || filters.f_SB2 || filters.f_WT.length > 0 || filters.f_JT.length > 0 || filters.f_E.length > 0) && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            已选择的过滤条件
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.f_TPR && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-indigo-100 text-indigo-800">
                {filters.f_TPR === 'r86400' ? '24小时内' : 
                 filters.f_TPR === 'r604800' ? '一周内' : '一个月内'}
                <button 
                  type="button" 
                  onClick={() => setFilters(prev => ({ ...prev, f_TPR: '' }))}
                  className="ml-1.5 h-4 w-4 flex items-center justify-center rounded-full text-indigo-400 hover:text-indigo-600 focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            )}
            
            {filters.f_SB2 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
                薪资 {
                  filters.f_SB2 === '1' ? '40K+' : 
                  filters.f_SB2 === '2' ? '60K+' : 
                  filters.f_SB2 === '3' ? '80K+' : 
                  filters.f_SB2 === '4' ? '100K+' : '120K+'
                }
                <button 
                  type="button" 
                  onClick={() => setFilters(prev => ({ ...prev, f_SB2: '' }))}
                  className="ml-1.5 h-4 w-4 flex items-center justify-center rounded-full text-green-400 hover:text-green-600 focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            )}
            
            {filters.f_WT.map(wt => {
              const label = 
                wt === '1' ? '现场办公' : 
                wt === '2' ? '远程工作' : '混合办公';
              return (
                <span key={`wt-${wt}`} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                  {label}
                  <button 
                    type="button" 
                    onClick={() => handleMultiSelectChange({ target: { value: wt, checked: false } }, 'f_WT')}
                    className="ml-1.5 h-4 w-4 flex items-center justify-center rounded-full text-blue-400 hover:text-blue-600 focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </span>
              );
            })}
            
            {filters.f_JT.map(jt => {
              const label = 
                jt === 'F' ? '全职' : 
                jt === 'P' ? '兼职' : 
                jt === 'C' ? '合同' : '实习';
              return (
                <span key={`jt-${jt}`} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-yellow-100 text-yellow-800">
                  {label}
                  <button 
                    type="button" 
                    onClick={() => handleMultiSelectChange({ target: { value: jt, checked: false } }, 'f_JT')}
                    className="ml-1.5 h-4 w-4 flex items-center justify-center rounded-full text-yellow-400 hover:text-yellow-600 focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </span>
              );
            })}
            
            {filters.f_E.map(e => {
              const label = 
                e === '1' ? '实习' : 
                e === '2' ? '入门级' : 
                e === '3' ? '助理' : 
                e === '4' ? '中高级' : 
                e === '5' ? '主管' : '高管';
              return (
                <span key={`e-${e}`} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-purple-100 text-purple-800">
                  {label}
                  <button 
                    type="button" 
                    onClick={() => handleMultiSelectChange({ target: { value: e, checked: false } }, 'f_E')}
                    className="ml-1.5 h-4 w-4 flex items-center justify-center rounded-full text-purple-400 hover:text-purple-600 focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters; 