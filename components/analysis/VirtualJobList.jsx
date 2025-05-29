import { useState, useEffect, useCallback, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useInfiniteQuery } from '@tanstack/react-query';

const ITEM_HEIGHT = 72; // 每行高度
const LOAD_MORE_COUNT = 70; // 每次加载更多时的数量

const JobRow = ({ index, style, data }) => {
  const job = data.jobs[index];
  const { onJobClick } = data;

  if (!job) return null;

  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) return '日期未知';
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  return (
    <div
      style={style}
      className="flex items-center px-6 py-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
      onClick={() => onJobClick(job)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 truncate">{job.title}</h3>
          <span className="text-sm text-gray-500">{job.company}</span>
        </div>
        <div className="mt-1 flex items-center text-sm text-gray-500">
          <span className="truncate">{job.location}</span>
          <span className="mx-2">•</span>
          <span>{job.salary || '薪资未提供'}</span>
          <span className="mx-2">•</span>
          <span>{formatDate(job.postedAt)}</span>
        </div>
      </div>
    </div>
  );
};

export default function VirtualJobList({ onJobClick, sortField = 'postedAt', sortDirection = 'desc', filters = {} }) {
  const [listHeight, setListHeight] = useState(600);
  const listRef = useRef();

  // 获取数据
  const fetchJobs = async ({ pageParam = 1 }) => {
    const limit = LOAD_MORE_COUNT;
    
    // 构建URL参数
    const params = new URLSearchParams({
      page: pageParam,
      limit: limit,
      initial: pageParam === 1 ? 'true' : 'false',
      sort: sortField,
      direction: sortDirection
    });
    
    // 添加筛选条件
    if (filters.isRemote !== null) {
      params.append('isRemote', filters.isRemote);
    }
    
    if (filters.employmentType) {
      params.append('employmentType', filters.employmentType);
    }
    
    if (filters.jobFunction) {
      params.append('jobFunction', filters.jobFunction);
    }
    
    if (filters.seniority) {
      params.append('seniority', filters.seniority);
    }
    
    if (filters.timeRange) {
      params.append('timeRange', filters.timeRange);
    }

    // 如果是按薪资排序，添加excludeZeroSalary参数
    if (sortField === 'salaryNumeric' && filters.excludeZeroSalary) {
      params.append('excludeZeroSalary', 'true');
    }
    
    const response = await fetch(`/api/jobs?${params.toString()}`);
    if (!response.ok) {
      throw new Error('获取数据失败');
    }
    const data = await response.json();
    return data;
  };

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    refetch
  } = useInfiniteQuery({
    queryKey: ['jobs', sortField, sortDirection, filters],
    queryFn: fetchJobs,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) {
        return undefined;
      }
      return allPages.length + 1;
    },
    initialPageParam: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    cacheTime: Infinity
  });

  // 当排序或筛选条件变化时，重置列表滚动位置
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo(0);
    }
  }, [sortField, sortDirection, filters]);

  // 合并所有页面的数据
  const jobs = data?.pages.flatMap(page => page.jobs) ?? [];

  // 基于滚动位置检测是否需要加载更多
  const onScroll = useCallback(({ scrollOffset, scrollDirection }) => {
    // 计算总内容高度
    const totalHeight = jobs.length * ITEM_HEIGHT;
    // 计算可见区域底部位置
    const visibleBottom = scrollOffset + listHeight;
    // 计算距离底部的距离（以像素为单位）
    const distanceToBottom = totalHeight - visibleBottom;
    
    // 当距离底部不足4000px且有更多数据可加载时，加载更多数据
    if (
      !isFetchingNextPage &&
      hasNextPage &&
      distanceToBottom < 4000
    ) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, jobs.length, listHeight]);
  
  // 设置列表高度
  useEffect(() => {
    const updateHeight = () => {
      const height = window.innerHeight - 200; // 减去头部和其他元素的高度
      setListHeight(Math.max(height, 400)); // 最小高度 400px
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // 手动加载更多
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (listRef.current && jobs.length > 0) {
      const totalHeight = jobs.length * ITEM_HEIGHT;
      listRef.current.scrollTo(totalHeight - listHeight);
    }
  }, [jobs.length, listHeight]);

  if (status === 'error') {
    return (
      <div className="p-4 text-red-600">
        加载失败: {error.message}
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 flex justify-between items-center text-sm text-gray-500">
        <div>已加载 {jobs.length} 条职位 {data?.pages[0]?.total ? `(共 ${data.pages[0].total} 条)` : '(还有更多)'}</div>
        <div className="flex space-x-2">
          <button 
            onClick={() => refetch()}
            className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            刷新
          </button>
          <button 
            onClick={scrollToBottom}
            className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            滚动到底部
          </button>
        </div>
      </div>
      
      <List
        ref={listRef}
        height={listHeight}
        itemCount={jobs.length}
        itemSize={ITEM_HEIGHT}
        width="100%"
        onScroll={onScroll}
        itemData={{ jobs, onJobClick }}
      >
        {JobRow}
      </List>
      
      {isFetchingNextPage ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      ) : hasNextPage ? (
        <div className="flex justify-center py-4">
          <button 
            onClick={handleLoadMore}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            加载更多
          </button>
        </div>
      ) : jobs.length > 0 ? (
        <div className="text-center py-4 text-gray-500">
          已加载全部数据
        </div>
      ) : null}
    </div>
  );
} 