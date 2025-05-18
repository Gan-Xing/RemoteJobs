import { PrismaClient } from '@prisma/client';
import { customAlphabet } from 'nanoid';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // 添加重试配置
  __internal: {
    engine: {
      connectionTimeout: 10000, // 10秒连接超时
      retryAttempts: 3, // 重试3次
      retryDelay: 1000 // 重试间隔1秒
    }
  }
});

// 添加数据库连接检查函数
const checkDatabaseConnection = async () => {
  try {
    await prisma.$connect();
    return true;
  } catch (error) {
    console.error('数据库连接失败:', error);
    return false;
  }
};

// 生成自定义ID：时间戳 + nanoid
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);
export const generateCustomId = () => {
  const timestamp = Date.now().toString(36);
  const random = nanoid();
  return `${timestamp}-${random}`;
};

// 保存或更新职位数据
export const saveJobs = async (jobs) => {
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      // 检查数据库连接
      const isConnected = await checkDatabaseConnection();
      if (!isConnected) {
        throw new Error('数据库连接失败');
      }
      
      const jobsData = jobs.map(job => {
        // 从 job_criteria 提取职位标准信息
        const criteria = job.job_criteria || {};
        
        return {
          jobId: job.job_id,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.job_description,
          descriptionFallback: job.job_description_fallback,
          url: job.link,
          salary: job.salary_range,
          postedAt: job.posted_date_attr ? new Date(job.posted_date_attr) : null,
          postedText: job.posted_text,
          applicantsCount: job.applicants_count,
          seniority: job.seniority || criteria["Seniority level"] || null,
          employmentType: job.employment_type || criteria["Employment type"] || null,
          jobFunction: job.job_function || criteria["Job function"] || null,
          industries: job.industries || criteria["Industries"] || null,
          isRemote: typeof job.is_remote === 'boolean' ? job.is_remote : true,
        };
      });

      // 过滤无效日期
      const validJobsData = jobsData.filter(job => {
        if (job.postedAt && isNaN(job.postedAt.getTime())) {
          job.postedAt = null;
        }
        return true;
      });

      // 使用更小的批量大小
      const batchSize = 10; // 减小批量大小
      const batches = [];
      
      // 将数据分成多个批次
      for (let i = 0; i < validJobsData.length; i += batchSize) {
        batches.push(validJobsData.slice(i, i + batchSize));
      }

      // 串行处理每个批次
      const results = [];
      for (const batch of batches) {
        const batchResult = await prisma.$transaction(async (tx) => {
          const operations = batch.map(job => {
            return tx.job.upsert({
              where: {
                jobId: job.jobId
              },
              update: {
                title: job.title,
                company: job.company,
                location: job.location,
                description: job.description,
                descriptionFallback: job.descriptionFallback,
                salary: job.salary,
                postedAt: job.postedAt,
                postedText: job.postedText,
                applicantsCount: job.applicantsCount,
                seniority: job.seniority,
                employmentType: job.employmentType,
                jobFunction: job.jobFunction,
                industries: job.industries,
                isRemote: job.isRemote,
                searchCount: {
                  increment: 1
                },
                lastSearchedAt: new Date()
              },
              create: {
                ...job,
                id: generateCustomId(),
                searchCount: 1,
                lastSearchedAt: new Date()
              }
            });
          });
          
          return await Promise.all(operations);
        }, {
          timeout: 15000 // 增加事务超时时间到15秒
        });
        
        results.push(batchResult);
      }
      
      return results.flat();
    } catch (error) {
      console.error(`重试 ${retryCount + 1} 失败:`, error);
      retryCount++;
      if (retryCount < maxRetries) {
        // 在重试之前等待一段时间
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }
  
  throw new Error('所有重试失败');
};

// 获取所有职位数据（用于数据分析页面）
export const getAllJobs = async (page = 1, limit = 20, filters = {}) => {
  try {
    const skip = (page - 1) * limit;
    
    // 构建查询条件
    const where = {};
    if (filters.company) {
      where.company = { contains: filters.company, mode: 'insensitive' };
    }
    if (filters.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }
    if (filters.salary) {
      where.salary = { contains: filters.salary, mode: 'insensitive' };
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: {
          lastSearchedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.job.count({ where })
    ]);

    return {
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error('获取职位数据失败:', error);
    throw error;
  }
};

// 获取职位统计数据
export const getJobStats = async () => {
  try {
    const stats = await prisma.job.groupBy({
      by: ['company'],
      _count: {
        company: true
      },
      orderBy: {
        _count: {
          company: 'desc'
        }
      },
      take: 10
    });

    const locationStats = await prisma.job.groupBy({
      by: ['location'],
      _count: {
        location: true
      },
      orderBy: {
        _count: {
          location: 'desc'
        }
      },
      take: 10
    });

    const salaryStats = await prisma.job.groupBy({
      by: ['salary'],
      _count: {
        salary: true
      },
      orderBy: {
        _count: {
          salary: 'desc'
        }
      },
      take: 10
    });

    return {
      topCompanies: stats,
      topLocations: locationStats,
      topSalaries: salaryStats
    };
  } catch (error) {
    console.error('获取职位统计数据失败:', error);
    throw error;
  }
}; 