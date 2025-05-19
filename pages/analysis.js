import { useState } from 'react';
import Head from 'next/head';
import VirtualJobListWithControls from '../components/VirtualJobListWithControls';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JobDetail from '../components/JobDetail';

// 创建 QueryClient 实例
const queryClient = new QueryClient();

export default function Analysis() {
  const [selectedJob, setSelectedJob] = useState(null);

  const handleJobClick = (job) => {
    // 转换数据格式以匹配JobDetail组件的期望
    const formattedJob = {
      ...job,
      // 确保所有JobDetail需要的字段都存在
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      salary_range: job.salary || '未找到',
      posted_text: job.postedAt ? new Date(job.postedAt).toLocaleDateString('zh-CN') : '未找到',
      job_criteria: {
        '职位等级': job.seniority || '未找到',
        '就业类型': job.employmentType || '未找到',
        '工作职能': job.jobFunction || '未找到',
        '行业': job.industries || '未找到',
        '工作地点': job.isRemote ? '远程工作' : '现场办公'
      },
      job_description: job.description || '未找到',
      job_description_fallback: job.descriptionFallback || job.description || '未找到',  // 使用descriptionFallback作为备选
      link: job.url || 'N/A'  // 将url映射到link
    };
    setSelectedJob(formattedJob);
  };

  const handleCloseDetail = () => {
    setSelectedJob(null);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <Head>
          <title>职位数据分析 | 远程工作搜索</title>
          <meta name="description" content="远程工作数据分析平台" />
        </Head>

        <header className="bg-white shadow-sm py-5">
          <div className="container mx-auto px-4">
            <h1 className="text-2xl font-bold text-indigo-600">职位数据分析</h1>
          </div>
        </header>

        <main className="container mx-auto py-10 px-4">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6">
              <VirtualJobListWithControls onJobClick={handleJobClick} />
            </div>
          </div>
        </main>

        {/* 职位详情弹窗 */}
        {selectedJob && (
          <JobDetail job={selectedJob} onClose={handleCloseDetail} />
        )}
      </div>
    </QueryClientProvider>
  );
} 