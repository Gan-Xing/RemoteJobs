import { useState, useEffect } from 'react';
import Head from 'next/head';
import JobList from '../components/JobList';
import JobFilter from '../components/JobFilter';
import Settings from '../components/Settings';
import AdvancedFilters from '../components/AdvancedFilters';
import JobDetail from '../components/JobDetail';

export default function Home() {
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [sortedJobs, setSortedJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [advancedFilters, setAdvancedFilters] = useState({
    f_TPR: '',
    f_WT: [],
    f_JT: [],
    f_E: [],
    f_SB2: ''
  });
  const [settings, setSettings] = useState({
    maxJobs: 20,
    maxJobDetails: 5
  });

  // 处理搜索表单提交
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!keywords || !location) {
      setError('请输入关键词和地点');
      return;
    }

    setError('');
    setLoading(true);
    setJobs([]);
    setSortedJobs([]);
    setFilteredJobs([]);
    setShowFilters(false);

    const requestStartTime = Date.now();
    console.log(`[${new Date().toISOString()}] 开始发送搜索请求`);

    // 构建查询参数
    const queryParams = {
      keywords,
      location,
      maxJobs: settings.maxJobs.toString(),
      fetchDetails: 'true',
      maxJobDetails: settings.maxJobDetails.toString()
    };

    // 添加高级过滤条件
    if (advancedFilters.f_TPR) {
      queryParams.f_TPR = advancedFilters.f_TPR;
    }
    
    if (advancedFilters.f_SB2) {
      queryParams.f_SB2 = advancedFilters.f_SB2;
    }
    
    // 处理多选过滤器
    if (advancedFilters.f_WT.length > 0) {
      queryParams.f_WT = advancedFilters.f_WT.join(',');
    }
    
    if (advancedFilters.f_JT.length > 0) {
      queryParams.f_JT = advancedFilters.f_JT.join(',');
    }
    
    if (advancedFilters.f_E.length > 0) {
      queryParams.f_E = advancedFilters.f_E.join(',');
    }

    try {
      const response = await fetch(`/api/search?${new URLSearchParams(queryParams).toString()}`);

      const requestEndTime = Date.now();
      console.log(`[${new Date().toISOString()}] 收到服务器响应，网络请求耗时: ${requestEndTime - requestStartTime}ms`);

      if (!response.ok) {
        throw new Error('搜索请求失败');
      }

      const data = await response.json();
      const parseEndTime = Date.now();
      console.log(`[${new Date().toISOString()}] 解析响应数据完成，总耗时: ${parseEndTime - requestStartTime}ms`);
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      if (data.jobs) {
        setJobs(data.jobs);
        setSortedJobs(data.jobs);
        setFilteredJobs(data.jobs);
        setShowFilters(true);
        console.log(`[${new Date().toISOString()}] 更新UI完成，总耗时: ${Date.now() - requestStartTime}ms`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 搜索错误:`, error);
      setError(error instanceof Error ? error.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理排序
  const handleSort = (value) => {
    setSortBy(value);
    
    let sorted = [...jobs];
    
    switch(value) {
      case "salary_high":
        sorted = sorted.sort((a, b) => {
          const getSalary = (job) => {
            if (!job.salary_range || job.salary_range === "未找到") return 0;
            const matches = job.salary_range.match(/(\d[\d,.]*)/g);
            if (!matches || matches.length === 0) return 0;
            return Math.max(...matches.map(m => parseFloat(m.replace(/,/g, ''))));
          };
          return getSalary(b) - getSalary(a);
        });
        break;
      
      case "recent":
        sorted = sorted.sort((a, b) => {
          if (a.posted_date_attr && b.posted_date_attr) {
            return new Date(b.posted_date_attr).getTime() - new Date(a.posted_date_attr).getTime();
          }
          return 0;
        });
        break;
        
      case "company":
        sorted = sorted.sort((a, b) => {
          return a.company.localeCompare(b.company);
        });
        break;
      
      default:
        sorted = [...jobs];
    }
    
    setSortedJobs(sorted);
    applyFilters(sorted);
  };
  
  // 处理筛选
  const handleFilterChange = (filters) => {
    applyFilters(sortedJobs, filters);
  };
  
  // 应用筛选条件
  const applyFilters = (jobsToFilter, filters = {}) => {
    // 默认显示所有职位
    let result = [...jobsToFilter];
    
    // 应用远程工作筛选
    if (filters.isRemoteOnly) {
      result = result.filter(job => {
        // 在前端显示时所有职位都视为远程工作
        return true;
      });
    }
    
    // 应用职位级别筛选
    if (filters.seniority && filters.seniority !== 'all') {
      result = result.filter(job => {
        const criteria = job.job_criteria || {};
        return criteria["职位等级"] === filters.seniority || criteria["Seniority level"] === filters.seniority;
      });
    }
    
    // 应用职位类型筛选
    if (filters.employmentType && filters.employmentType !== 'all') {
      result = result.filter(job => {
        const criteria = job.job_criteria || {};
        return criteria["就业类型"] === filters.employmentType || 
               criteria["Employment type"] === filters.employmentType;
      });
    }
    
    setFilteredJobs(result);
  };
  
  // 重置搜索
  const handleReset = () => {
    setKeywords("");
    setLocation("");
    setJobs([]);
    setSortedJobs([]);
    setFilteredJobs([]);
    setShowFilters(false);
    
    // 重置高级过滤器
    setAdvancedFilters({
      f_TPR: '',
      f_WT: [],
      f_JT: [],
      f_E: [],
      f_SB2: ''
    });
  };

  // 打开职位详情
  const openJobDetail = (job) => {
    setSelectedJob(job);
  };

  // 关闭职位详情
  const closeJobDetail = () => {
    setSelectedJob(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      <Head>
        <title>远程工作搜索 | 搜索全球远程工作机会</title>
        <meta name="description" content="搜索全球远程工作机会，按薪资排序，找到最适合你的远程工作" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white shadow-sm py-5">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">远程工作搜索</h1>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex items-center text-gray-600 hover:text-indigo-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            搜索设置
          </button>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-10 px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">搜索全球远程工作机会</h2>
          <p className="text-lg text-gray-600">找到你理想的工作，释放自由工作的潜力</p>
        </div>
        
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden mb-10">
          <div className="p-8">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
                    关键词
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="keywords"
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-3 py-3 border-gray-300 rounded-md text-gray-900 placeholder-gray-400"
                      placeholder="例如：Frontend, React, Python..."
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                    地点
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="location"
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-3 py-3 border-gray-300 rounded-md text-gray-900 placeholder-gray-400"
                      placeholder="例如：Worldwide, Europe, USA..."
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="submit"
                  className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors flex items-center justify-center min-w-[130px]"
                  disabled={!keywords || !location || loading}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      搜索中...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                      搜索工作
                    </div>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-md shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                  </svg>
                  {showAdvancedFilters ? "隐藏高级过滤" : "高级过滤"}
                </button>
                
                {jobs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-md shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    重置
                  </button>
                )}
              </div>
              
              {showAdvancedFilters && (
                <div className="mt-6">
                  <AdvancedFilters 
                    onFilterChange={setAdvancedFilters}
                    initialFilters={advancedFilters}
                  />
                </div>
              )}
            </form>
            
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>
        
        {loading && (
          <div className="flex flex-col items-center justify-center my-16">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">正在搜索匹配的工作机会...</p>
          </div>
        )}
        
        {showFilters && jobs.length > 0 && (
          <div className="mb-8 animate-fadeIn">
            <JobFilter 
              sortBy={sortBy} 
              onSortChange={handleSort} 
              totalJobs={filteredJobs.length}
              onFilterChange={handleFilterChange}
            />
            <JobList jobs={filteredJobs} onJobClick={openJobDetail} />
          </div>
        )}
        
        {!loading && jobs.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-xl text-gray-600 mb-2">开始搜索远程工作机会</p>
            <p className="text-gray-500">
              当前设置：搜索{settings.maxJobs}个职位，获取{settings.maxJobDetails}个职位详情
            </p>
          </div>
        )}
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-500 text-sm">
            <p className="mb-2">本网站使用LinkedIn数据，仅供学习和研究目的</p>
            <p>© {new Date().getFullYear()} 远程工作搜索</p>
          </div>
        </div>
      </footer>
      
      <Settings 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={setSettings}
        defaultSettings={settings}
      />
      
      {selectedJob && (
        <JobDetail job={selectedJob} onClose={closeJobDetail} />
      )}
      
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
} 

