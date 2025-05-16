import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import JobList from '../components/JobList';
import JobFilter from '../components/JobFilter';
import Settings from '../components/Settings';

export default function Home() {
  const router = useRouter();
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [sortedJobs, setSortedJobs] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    maxJobs: 20,
    maxJobDetails: 5
  });
  const [searchId, setSearchId] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventSourceRef = useRef(null);
  
  // 从localStorage加载设置
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('jobSearchSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (err) {
      console.error('读取设置失败:', err);
    }
  }, []);

  // 清理函数
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);
  
  // 保存设置到localStorage
  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('jobSearchSettings', JSON.stringify(newSettings));
    } catch (err) {
      console.error('保存设置失败:', err);
    }
  };

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
    setShowFilters(false);
    setCurrentPage(1);
    setHasMore(true);

    try {
      const response = await fetch(`/api/search?${new URLSearchParams({
        keywords,
        location,
        maxJobs: settings.maxJobs,
        fetchDetails: true,
        maxJobDetails: settings.maxJobDetails
      }).toString()}`);

      if (!response.ok) {
        throw new Error('搜索请求失败');
      }

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      if (data.jobs) {
        setJobs(data.jobs);
        setSortedJobs(data.jobs);
        setShowFilters(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopSearch = async (e) => {
    e.preventDefault(); // 阻止表单提交
    console.log('Stopping search...');
    
    if (eventSourceRef.current) {
      console.log('Closing EventSource...');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setLoading(false);
    
    // 发送停止请求到后端
    try {
      console.log('Sending stop request to backend...');
      const response = await fetch('/api/search', {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('停止搜索请求失败');
      }
      
      console.log('Search stopped successfully');
    } catch (error) {
      console.error('Error stopping search:', error);
      setError('停止搜索时出错');
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
            return new Date(b.posted_date_attr) - new Date(a.posted_date_attr);
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
  };
  
  // 重置搜索
  const handleReset = () => {
    setKeywords("");
    setLocation("");
    setJobs([]);
    setSortedJobs([]);
    setShowFilters(false);
    setIsSearching(false);
  };

  // 停止搜索
  const stopSearch = async () => {
    if (searchId) {
      try {
        await fetch(`/api/search?searchId=${searchId}`, { method: 'DELETE' });
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        setIsSearching(false);
        setLoading(false);
      } catch (err) {
        console.error('停止搜索失败:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Head>
        <title>远程工作搜索 | 搜索全球远程工作机会</title>
        <meta name="description" content="搜索全球远程工作机会，按薪资排序，找到最适合你的远程工作" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex-1 container mx-auto py-8 px-4">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-indigo-600 mb-4">远程工作搜索</h1>
          <p className="text-xl text-gray-600">搜索全球远程工作机会，找到你理想的工作</p>
        </div>
        
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6 mb-10">
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex items-center text-indigo-600 hover:text-indigo-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              搜索设置
            </button>
          </div>
          
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 mb-1">
                  关键词
                </label>
                <input
                  type="text"
                  id="keywords"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="例如：Frontend, React, Python..."
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  地点
                </label>
                <input
                  type="text"
                  id="location"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="例如：Worldwide, Europe, USA..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-center space-x-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center min-w-[120px]"
                disabled={!keywords || !location || loading}
              >
                {loading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    搜索中...
                  </div>
                ) : (
                  "搜索工作"
                )}
              </button>
              
              {jobs.length > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  重置
                </button>
              )}
            </div>
          </form>
          
          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </div>
        
        {loading && (
          <div className="flex justify-center my-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        )}
        
        {showFilters && jobs.length > 0 && (
          <div className="mb-6">
            <JobFilter 
              sortBy={sortBy} 
              onSortChange={handleSort} 
              totalJobs={jobs.length}
            />
            <JobList jobs={sortedJobs} />
          </div>
        )}
        
        {!loading && jobs.length === 0 && !error && (
          <div className="text-center text-gray-500 my-10">
            <p>使用上方的搜索表单开始搜索远程工作</p>
            <p className="mt-2 text-sm">
              当前设置：搜索{settings.maxJobs}个职位，获取{settings.maxJobDetails}个职位详情
            </p>
          </div>
        )}
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>本网站使用LinkedIn数据，仅供学习和研究目的</p>
        </div>
      </footer>
      
      <Settings 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={saveSettings}
        defaultSettings={settings}
      />
    </div>
  );
} 

