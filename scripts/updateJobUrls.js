const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { JSDOM } = require('jsdom');

const prisma = new PrismaClient();

async function getActualJobUrl(apiUrl) {
  try {
    const response = await axios.get(apiUrl);
    const dom = new JSDOM(response.data);
    const document = dom.window.document;
    
    // 查找职位链接
    const jobLink = document.querySelector('a.topcard__link');
    if (jobLink) {
      return jobLink.href;
    }
    
    return null;
  } catch (error) {
    console.error(`获取职位URL失败: ${apiUrl}`, error.message);
    return null;
  }
}

async function updateJobUrls() {
  try {
    // 查找所有包含 jobs-guest 的 URL
    const jobs = await prisma.job.findMany({
      where: {
        url: {
          contains: 'jobs-guest'
        }
      }
    });

    console.log(`找到 ${jobs.length} 个需要更新的职位`);

    let successCount = 0;
    let errorCount = 0;

    for (const job of jobs) {
      try {
        console.log(`处理职位: ${job.title} (${job.jobId})`);
        
        // 获取实际职位 URL
        const actualUrl = await getActualJobUrl(job.url);
        
        if (actualUrl) {
          // 更新数据库
          await prisma.job.update({
            where: { id: job.id },
            data: { url: actualUrl }
          });
          
          console.log(`更新成功: ${actualUrl}`);
          successCount++;
        } else {
          console.log(`未找到实际URL: ${job.url}`);
          errorCount++;
        }

        // 添加延迟以避免请求过快
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`更新职位失败: ${job.jobId}`, error.message);
        errorCount++;
      }
    }

    console.log('\n更新完成:');
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${errorCount}`);
    console.log(`总计: ${jobs.length}`);

  } catch (error) {
    console.error('更新过程中发生错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行更新脚本
updateJobUrls().catch(console.error); 