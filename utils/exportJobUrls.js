const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

/**
 * 获取项目根目录的绝对路径
 * @returns {string} 项目根目录的绝对路径
 */
const getProjectRoot = () => {
  // 从当前文件位置向上查找，直到找到包含 package.json 的目录
  let currentDir = __dirname;
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return __dirname; // 如果找不到，返回当前目录
};

/**
 * 确保目录存在，如果不存在则创建
 * @param {string} dirPath - 目录路径
 */
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[导出工具] 创建目录: ${dirPath}`);
  }
};

/**
 * 导出所有职位的jobId和refId到CSV文件
 * @param {string} outputPath - 输出文件路径，默认为 'job_urls.json'
 * @returns {Promise<{success: boolean, message: string, count: number}>}
 */
const exportJobUrls = async (outputPath = 'job_urls.json') => {
  try {
    console.log('[导出工具] 开始导出职位URL数据...');
    
    // 获取项目根目录
    const projectRoot = getProjectRoot();
    
    // 构建完整的输出路径（确保在data目录下）
    const dataDir = path.join(projectRoot, 'data');
    const fullOutputPath = path.join(dataDir, path.basename(outputPath));
    
    // 确保data目录存在
    ensureDirectoryExists(dataDir);
    
    // 根据扩展名决定导出格式（默认 JSON）
    const ext = path.extname(outputPath).toLowerCase();
    
    // 从数据库获取所有职位数据
    const jobs = await prisma.job.findMany({
      select: {
        jobId: true,
        refId: true,
        title: true,
        company: true,
        location: true,
        postedAt: true,
        salary: true,
        url: true,
        applicantsCount: true,
        seniority: true,
        employmentType: true,
        jobFunction: true,
        industries: true,
      }
    });
    
    if (jobs.length === 0) {
      console.log('[导出工具] 数据库中没有找到职位数据');
      return { success: false, message: '没有找到职位数据', count: 0 };
    }
    
    console.log(`[导出工具] 找到 ${jobs.length} 个职位数据`);
    
    let fileContent = '';

    if (ext === '.csv') {
      // ---- CSV 格式 ----
      const csvHeader =
        'jobId,refId,detailUrl,title,company,location,postedAt,salary,url,applicantsCount,seniority,employmentType,jobFunction,industries\n';
    
      const escapeCsv = (str) => {
        if (str === null || str === undefined) return '';
        const s = String(str);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
    
      const csvRows = jobs.map((job) => {
        const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${job.jobId}${
          job.refId ? `?refId=${encodeURIComponent(job.refId.trim())}` : ''
        }`;
    
        return [
          escapeCsv(job.jobId),
          escapeCsv(job.refId || ''),
          escapeCsv(detailUrl),
          escapeCsv(job.title),
          escapeCsv(job.company),
          escapeCsv(job.location || ''),
          escapeCsv(job.postedAt ? job.postedAt.toISOString() : ''),
          escapeCsv(job.salary || ''),
          escapeCsv(job.url || ''),
          escapeCsv(job.applicantsCount || ''),
          escapeCsv(job.seniority || ''),
          escapeCsv(job.employmentType || ''),
          escapeCsv(job.jobFunction || ''),
          escapeCsv(job.industries || '')
        ].join(',');
      });
    
      fileContent = csvHeader + csvRows.join('\n');
    } else {
      // ---- JSON 格式（默认）----
      fileContent = JSON.stringify(
        jobs.map((job) => ({
          jobId: job.jobId,
          refId: job.refId || '',
          detailUrl: `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${job.jobId}${
            job.refId ? `?refId=${encodeURIComponent(job.refId.trim())}` : ''
          }`,
          title: job.title,
          company: job.company,
          location: job.location,
          postedAt: job.postedAt ? job.postedAt.toISOString() : null,
          salary: job.salary,
          url: job.url,
          applicantsCount: job.applicantsCount,
          seniority: job.seniority,
          employmentType: job.employmentType,
          jobFunction: job.jobFunction,
          industries: job.industries
        })),
        null,
        2
      );
    }

    // 写入文件
    fs.writeFileSync(fullOutputPath, fileContent, 'utf8');
    
    console.log(`[导出工具] ✅ 成功导出 ${jobs.length} 个职位URL到文件: ${fullOutputPath}`);
    
    return {
      success: true,
      message: `成功导出 ${jobs.length} 个职位URL`,
      count: jobs.length
    };
  } catch (error) {
    console.error('[导出工具] ❌ 导出失败:', error);
    return {
      success: false,
      message: `导出失败: ${error.message}`,
      count: 0
    };
  } finally {
    // 关闭 Prisma 客户端连接
    await prisma.$disconnect();
  }
};

// 如果直接运行此文件
if (require.main === module) {
  // 获取命令行参数中的输出文件名（如果有）
  const outputFileName = process.argv[2] || 'job_urls.json';
  
  // 执行导出
  exportJobUrls(outputFileName)
    .then(result => {
      if (result.success) {
        console.log(`✅ ${result.message}`);
        process.exit(0);
      } else {
        console.error(`❌ ${result.message}`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ 执行失败:', error);
      process.exit(1);
    });
}

// 导出函数供其他模块使用
module.exports = { exportJobUrls };