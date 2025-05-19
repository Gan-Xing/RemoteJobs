import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import JobFilters from './JobFilters';
import VirtualJobList from './VirtualJobList';

export default function VirtualJobListWithControls({ onJobClick }) {
  const queryClient = useQueryClient();
  const [sortField, setSortField] = useState('postedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filters, setFilters] = useState({
    isRemote: null,
    employmentType: '',
    jobFunction: '',
    seniority: '',
    timeRange: '',
    excludeZeroSalary: false
  });

  // 处理排序变化
  const handleSortChange = useCallback((field, direction, excludeZeroSalary) => {
    setSortField(field);
    setSortDirection(direction);
    
    // 如果是按薪资排序，添加excludeZeroSalary参数
    if (field === 'salary') {
      setFilters(prev => ({
        ...prev,
        excludeZeroSalary
      }));
    }
    
    // 重置缓存并触发重新加载
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  }, [queryClient]);

  // 处理筛选变化
  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
    
    // 重置缓存并触发重新加载
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  }, [queryClient]);

  return (
    <div className="space-y-4">
      <JobFilters 
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        initialSort={`${sortField}_${sortDirection}`}
      />
      
      <VirtualJobList 
        onJobClick={onJobClick}
        sortField={sortField}
        sortDirection={sortDirection}
        filters={filters}
      />
    </div>
  );
} 