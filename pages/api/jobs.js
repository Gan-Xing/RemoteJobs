import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '方法不允许' });
  }

  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'postedAt', 
      direction = 'desc',
      initial = false,
      isRemote,
      employmentType,
      jobFunction,
      seniority,
      timeRange,
      excludeZeroSalary
    } = req.query;
    
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // 如果是初始加载，获取更多数据
    const actualLimit = initial === 'true' ? 70 : limitNumber;

    console.log('开始查询数据库...');
    console.log('查询参数:', { 
      page: pageNumber, 
      limit: actualLimit, 
      sort, 
      direction,
      initial,
      isRemote,
      employmentType,
      jobFunction,
      seniority,
      timeRange,
      excludeZeroSalary
    });

    // 构建过滤条件
    let where = {};
    
    // 处理远程工作过滤
    if (isRemote !== undefined) {
      where.isRemote = isRemote === 'true';
    }
    
    // 处理雇佣类型过滤
    if (employmentType) {
      where.employmentType = employmentType;
    }
    
    // 处理工作职能过滤
    if (jobFunction) {
      where.jobFunction = jobFunction;
    }
    
    // 处理职位级别过滤
    if (seniority) {
      where.seniority = seniority;
    }
    
    // 处理时间范围过滤
    if (timeRange) {
      const now = new Date();
      let dateFilter;
      
      switch (timeRange) {
        case '1d': // 过去24小时
          dateFilter = new Date(now.setDate(now.getDate() - 1));
          break;
        case '7d': // 过去一周
          dateFilter = new Date(now.setDate(now.getDate() - 7));
          break;
        case '30d': // 过去一个月
          dateFilter = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case '90d': // 过去三个月
          dateFilter = new Date(now.setMonth(now.getMonth() - 3));
          break;
        default:
          dateFilter = null;
      }
      
      if (dateFilter) {
        where.postedAt = { gte: dateFilter };
      }
    }

    // 处理薪资为0的过滤
    if (excludeZeroSalary === 'true' && sort === 'salaryNumeric') {
      where.salaryNumeric = {
        not: null,
        gt: 0
      };
    }

    // 如果是按薪资排序，排除 salaryNumeric 为 null 的记录
    if (sort === 'salaryNumeric') {
      where.salaryNumeric = {
        not: null,
        gt: 0
      };
    }

    // 获取总记录数
    const total = await prisma.job.count({ 
      where: {
        ...where,
        // 如果是按日期排序，排除postedAt为null的记录
        ...(sort === 'postedAt' ? { postedAt: { not: null } } : {})
      }
    });
    console.log('总记录数:', total);

    // 获取分页数据
    const jobs = await prisma.job.findMany({
      where: {
        ...where,
        // 如果是按日期排序，排除postedAt为null的记录
        ...(sort === 'postedAt' ? { postedAt: { not: null } } : {})
      },
      skip,
      take: actualLimit,
      orderBy: {
        [sort === 'salary' ? 'salaryNumeric' : sort]: direction.toLowerCase()
      },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        salary: true,
        salaryNumeric: true,
        postedAt: true,
        seniority: true,
        employmentType: true,
        jobFunction: true,
        industries: true,
        isRemote: true,
        createdAt: true,
        updatedAt: true,
        description: true,
        url: true,
        descriptionFallback: true
      }
    });

    console.log('查询到的职位数量:', jobs.length);

    res.status(200).json({
      jobs,
      total,
      page: pageNumber,
      limit: actualLimit,
      hasMore: skip + jobs.length < total
    });
  } catch (error) {
    console.error('获取职位数据失败:', error);
    
    // 返回更详细的错误信息
    res.status(500).json({ 
      error: '获取职位数据失败',
      details: {
        message: error.message,
        code: error.code,
        meta: error.meta
      }
    });
  } finally {
    await prisma.$disconnect();
  }
} 