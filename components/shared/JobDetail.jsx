export default function JobDetail({ job, onClose }) {
  if (!job) return null;

  // 防止滚动传播和背景滚动
  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      onClick={onClose}
      style={{ backdropFilter: 'blur(2px)' }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative"
        onClick={stopPropagation}
      >
        {/* 头部 */}
        <div className="bg-indigo-600 text-white p-4 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-xl font-semibold truncate pr-8">{job.title}</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 focus:outline-none absolute right-4 top-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* 内容 */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* 公司和地点 */}
          <div className="mb-6">
            <div className="text-xl font-medium text-gray-800 mb-1">{job.company}</div>
            <div className="text-gray-600">{job.location}</div>
            
            {job.posted_text && (
              <div className="text-sm text-gray-500 mt-2">
                发布于: {job.posted_text}
              </div>
            )}
            
            {job.applicants_count && job.applicants_count !== "未找到" && (
              <div className="text-sm text-gray-500 mt-1">
                申请人数: {job.applicants_count}
              </div>
            )}
          </div>
          
          {/* 薪资信息 */}
          {job.salary_range && job.salary_range !== "未找到" && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">薪资范围</h3>
              <div className="text-green-600 font-medium">{job.salary_range}</div>
            </div>
          )}
          
          {/* 职位标准 */}
          {job.job_criteria && Object.keys(job.job_criteria).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">职位要求</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(job.job_criteria).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 p-3 rounded-md">
                    <div className="text-sm text-gray-500">{key}</div>
                    <div className="font-medium text-gray-800">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 职位描述 */}
          {job.job_description && job.job_description !== "未找到" && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">职位描述</h3>
              <div className="text-gray-700 whitespace-pre-line">
                {job.job_description}
              </div>
            </div>
          )}
          
          {/* 如果没有职位描述但有备用描述 */}
          {(!job.job_description || job.job_description === "未找到") && job.job_description_fallback && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">职位描述</h3>
              <div className="text-gray-700 whitespace-pre-line">
                {job.job_description_fallback}
              </div>
            </div>
          )}
          
          {/* 申请链接 */}
          {job.link && job.link !== "N/A" && (
            <div className="mt-8 bg-white pt-4 pb-2">
              <a
                href={job.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-3 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                在LinkedIn上申请
              </a>
              <div className="text-center text-sm text-gray-500 mt-2">
                将在新标签页中打开LinkedIn职位页面
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 