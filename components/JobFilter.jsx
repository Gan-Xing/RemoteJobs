export default function JobFilter({ sortBy, onSortChange, totalJobs }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <div className="text-gray-700 mb-3 sm:mb-0">
          共找到 <span className="font-semibold text-indigo-600">{totalJobs}</span> 个职位
        </div>
        
        <div className="flex items-center">
          <label htmlFor="sort" className="text-gray-700 mr-2 whitespace-nowrap">
            排序方式:
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="relevance">相关性</option>
            <option value="salary_high">薪资(高到低)</option>
            <option value="recent">最新发布</option>
            <option value="company">公司名称</option>
          </select>
        </div>
      </div>
    </div>
  );
} 