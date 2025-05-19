import { useState, useEffect, useRef } from 'react';

// 排序选项
const SORT_OPTIONS = [
  { value: 'postedAt', direction: 'desc', label: '最新发布' },
  { value: 'postedAt', direction: 'asc', label: '最早发布' },
  { value: 'salaryNumeric', direction: 'desc', label: '薪资从高到低' },
  { value: 'salaryNumeric', direction: 'asc', label: '薪资从低到高' },
  { value: 'company', direction: 'asc', label: '公司名称 A-Z' },
  { value: 'company', direction: 'desc', label: '公司名称 Z-A' },
  { value: 'title', direction: 'asc', label: '职位名称 A-Z' },
  { value: 'title', direction: 'desc', label: '职位名称 Z-A' },
];

// 时间范围选项
const TIME_RANGE_OPTIONS = [
  { value: '', label: '不限时间' },
  { value: '1d', label: '过去24小时' },
  { value: '7d', label: '过去一周' },
  { value: '30d', label: '过去一个月' },
  { value: '90d', label: '过去三个月' },
];

// 职位级别选项
const SENIORITY_OPTIONS = [
  { value: '', label: '所有级别' },
  { value: 'Internship', label: '实习' },
  { value: 'Entry level', label: '入门级' },
  { value: 'Associate', label: '助理' },
  { value: 'Mid-Senior level', label: '中高级' },
  { value: 'Director', label: '主管' },
  { value: 'Executive', label: '高管' },
];

// 雇佣类型选项
const EMPLOYMENT_TYPE_OPTIONS = [
  { value: '', label: '所有类型' },
  { value: 'Full-time', label: '全职' },
  { value: 'Part-time', label: '兼职' },
  { value: 'Contract', label: '合同' },
  { value: 'Temporary', label: '临时' },
  { value: 'Volunteer', label: '志愿' },
  { value: 'Internship', label: '实习' },
];

// 远程选项
const REMOTE_OPTIONS = [
  { value: '', label: '所有地点' },
  { value: 'true', label: '远程工作' },
  { value: 'false', label: '现场办公' },
];

export default function JobFilters({ onFilterChange, onSortChange, initialSort = 'postedAt_desc' }) {
  // 从initialSort提取排序字段和方向
  const getInitialSortState = () => {
    const [field, direction] = initialSort.split('_');
    return { field, direction };
  };

  const initialSortState = getInitialSortState();

  const [filters, setFilters] = useState({
    sort: initialSortState.field,
    direction: initialSortState.direction,
    timeRange: '',
    seniority: '',
    employmentType: '',
    isRemote: '',
    activeDropdown: null,
    excludeZeroSalary: initialSortState.field === 'salary'
  });

  // 添加ref用于检测点击是否在下拉框外部
  const dropdownRef = useRef(null);

  // 处理点击事件
  const handleClick = (event) => {
    // 检查点击的元素是否是下拉按钮或下拉菜单项
    const isDropdownButton = event.target.closest('button[data-dropdown]');
    const isDropdownItem = event.target.closest('[data-dropdown-item]');
    
    // 如果既不是下拉按钮也不是下拉菜单项，则关闭所有下拉框
    if (!isDropdownButton && !isDropdownItem) {
      setFilters(prev => ({
        ...prev,
        activeDropdown: null
      }));
    }
  };

  // 添加点击事件监听器
  useEffect(() => {
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  // 当排序变化时通知父组件
  useEffect(() => {
    if (onSortChange) {
      onSortChange(filters.sort, filters.direction, filters.excludeZeroSalary);
    }
  }, [filters.sort, filters.direction, filters.excludeZeroSalary, onSortChange]);

  // 当过滤器变化时通知父组件
  useEffect(() => {
    if (onFilterChange) {
      // 转换为VirtualJobListWithControls期望的格式
      const apiFilters = {
        isRemote: filters.isRemote === '' ? null : filters.isRemote === 'true',
        employmentType: filters.employmentType,
        jobFunction: '',
        seniority: filters.seniority,
        timeRange: filters.timeRange
      };
      onFilterChange(apiFilters);
    }
  }, [filters.isRemote, filters.employmentType, filters.seniority, filters.timeRange, onFilterChange]);

  // 处理排序变化
  const handleSortChange = (value, direction) => {
    setFilters(prev => ({
      ...prev,
      sort: value,
      direction: direction,
      activeDropdown: null,
      excludeZeroSalary: value === 'salary'
    }));
  };

  // 处理过滤器变化
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value,
      activeDropdown: null
    }));
  };

  // 切换下拉菜单
  const toggleDropdown = (dropdown) => {
    setFilters(prev => ({
      ...prev,
      activeDropdown: prev.activeDropdown === dropdown ? null : dropdown
    }));
  };

  // 重置所有过滤器
  const resetFilters = () => {
    setFilters({
      sort: 'postedAt',
      direction: 'desc',
      timeRange: '',
      seniority: '',
      employmentType: '',
      isRemote: '',
      activeDropdown: null,
      excludeZeroSalary: 'salary' === 'salary'
    });
  };

  // 获取当前排序选项的标签
  const getCurrentSortLabel = () => {
    const option = SORT_OPTIONS.find(
      opt => opt.value === filters.sort && opt.direction === filters.direction
    );
    return option ? option.label : '默认排序';
  };

  // 获取时间范围标签
  const getTimeRangeLabel = () => {
    if (!filters.timeRange) return '不限时间';
    const option = TIME_RANGE_OPTIONS.find(opt => opt.value === filters.timeRange);
    return option ? option.label : '不限时间';
  };

  // 获取职位级别标签
  const getSeniorityLabel = () => {
    if (!filters.seniority) return '所有级别';
    const option = SENIORITY_OPTIONS.find(opt => opt.value === filters.seniority);
    return option ? option.label : '所有级别';
  };

  // 获取雇佣类型标签
  const getEmploymentTypeLabel = () => {
    if (!filters.employmentType) return '所有类型';
    const option = EMPLOYMENT_TYPE_OPTIONS.find(opt => opt.value === filters.employmentType);
    return option ? option.label : '所有类型';
  };

  // 获取远程选项标签
  const getRemoteLabel = () => {
    if (filters.isRemote === '') return '所有地点';
    return filters.isRemote === 'true' ? '远程工作' : '现场办公';
  };

  return (
    <div className="bg-white rounded-lg shadow mb-4" ref={dropdownRef}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-800">排序和筛选</h3>
          <button
            onClick={resetFilters}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            重置所有过滤器
          </button>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* 排序下拉菜单 */}
          <div className="relative">
            <button
              data-dropdown="sort"
              onClick={() => toggleDropdown('sort')}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
            >
              <svg className="mr-2 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              排序: {getCurrentSortLabel()}
              <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {filters.activeDropdown === 'sort' && (
              <div className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={`${option.value}-${option.direction}`}
                      data-dropdown-item
                      onClick={() => handleSortChange(option.value, option.direction)}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        filters.sort === option.value && filters.direction === option.direction
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 时间范围过滤器 */}
          <div className="relative">
            <button
              data-dropdown="timeRange"
              onClick={() => toggleDropdown('timeRange')}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
            >
              <svg className="mr-2 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              发布时间: {getTimeRangeLabel()}
              <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {filters.activeDropdown === 'timeRange' && (
              <div className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      data-dropdown-item
                      onClick={() => handleFilterChange('timeRange', option.value)}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        filters.timeRange === option.value
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 职位级别过滤器 */}
          <div className="relative">
            <button
              data-dropdown="seniority"
              onClick={() => toggleDropdown('seniority')}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
            >
              <svg className="mr-2 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              职位级别: {getSeniorityLabel()}
              <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {filters.activeDropdown === 'seniority' && (
              <div className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  {SENIORITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      data-dropdown-item
                      onClick={() => handleFilterChange('seniority', option.value)}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        filters.seniority === option.value
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 雇佣类型过滤器 */}
          <div className="relative">
            <button
              data-dropdown="employmentType"
              onClick={() => toggleDropdown('employmentType')}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
            >
              <svg className="mr-2 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              雇佣类型: {getEmploymentTypeLabel()}
              <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {filters.activeDropdown === 'employmentType' && (
              <div className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      data-dropdown-item
                      onClick={() => handleFilterChange('employmentType', option.value)}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        filters.employmentType === option.value
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 远程选项过滤器 */}
          <div className="relative">
            <button
              data-dropdown="isRemote"
              onClick={() => toggleDropdown('isRemote')}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
            >
              <svg className="mr-2 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              工作地点: {getRemoteLabel()}
              <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {filters.activeDropdown === 'isRemote' && (
              <div className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  {REMOTE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      data-dropdown-item
                      onClick={() => handleFilterChange('isRemote', option.value)}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        filters.isRemote === option.value
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 已选择的筛选条件显示 */}
        {(filters.timeRange || filters.seniority || filters.employmentType || filters.isRemote !== '') && (
          <div className="mt-4 flex flex-wrap gap-2">
            {filters.timeRange && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                {getTimeRangeLabel()}
                <button
                  onClick={() => handleFilterChange('timeRange', '')}
                  className="ml-1.5 h-4 w-4 flex items-center justify-center rounded-full text-blue-400 hover:text-blue-600"
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            )}
            {filters.seniority && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-purple-100 text-purple-800">
                {getSeniorityLabel()}
                <button
                  onClick={() => handleFilterChange('seniority', '')}
                  className="ml-1.5 h-4 w-4 flex items-center justify-center rounded-full text-purple-400 hover:text-purple-600"
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            )}
            {filters.employmentType && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-yellow-100 text-yellow-800">
                {getEmploymentTypeLabel()}
                <button
                  onClick={() => handleFilterChange('employmentType', '')}
                  className="ml-1.5 h-4 w-4 flex items-center justify-center rounded-full text-yellow-400 hover:text-yellow-600"
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            )}
            {filters.isRemote !== '' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
                {getRemoteLabel()}
                <button
                  onClick={() => handleFilterChange('isRemote', '')}
                  className="ml-1.5 h-4 w-4 flex items-center justify-center rounded-full text-green-400 hover:text-green-600"
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 