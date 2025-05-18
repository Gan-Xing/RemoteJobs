import { useState } from 'react';
import JobDetail from './JobDetail';

export default function JobList({ jobs, onJobClick }) {
  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        没有找到符合条件的职位
      </div>
    );
  }

  const formatSalary = (salary) => {
    if (!salary || salary === "未找到") return "薪资未公布";
    return salary;
  };

  return (
    <div className="mt-6">
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
        {jobs.map((job) => (
          <div 
            key={job.job_id} 
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => onJobClick(job)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-indigo-600 mb-2">{job.title}</h2>
                <div className="text-lg font-medium text-gray-800 mb-1">{job.company}</div>
                <div className="text-gray-600 mb-2">{job.location}</div>
                
                <div className="flex flex-wrap gap-2 mt-3">
                  {job.job_criteria && job.job_criteria['就业类型'] && (
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm rounded-full">
                      {job.job_criteria['就业类型']}
                    </span>
                  )}
                  
                  {job.job_criteria && job.job_criteria['职位等级'] && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                      {job.job_criteria['职位等级']}
                    </span>
                  )}
                  
                  {job.job_criteria && job.job_criteria['经验'] && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                      {job.job_criteria['经验']}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                {job.salary_range && job.salary_range !== "未找到" ? (
                  <div className="text-lg font-semibold text-green-600">
                    {formatSalary(job.salary_range)}
                  </div>
                ) : null}
                
                <div className="text-sm text-gray-500 mt-1">{job.posted_text}</div>
                
                {job.applicants_count && job.applicants_count !== "未找到" && (
                  <div className="text-xs text-gray-500 mt-1">
                    {job.applicants_count}
                  </div>
                )}
              </div>
            </div>
            
            {job.job_description && job.job_description !== "未找到" && (
              <div className="mt-4">
                <div className="text-gray-700 line-clamp-3 text-sm">
                  {job.job_description.substring(0, 200)}...
                </div>
                <div className="mt-2 text-indigo-600 text-sm font-medium">
                  点击查看详情
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 