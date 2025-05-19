const { PrismaClient } = require('@prisma/client');
const { convertSalaryToUSD } = require('../utils/salaryConverter');

const prisma = new PrismaClient();

async function updateSalaryNumeric() {
  console.log('开始更新薪资数据...');
  
  try {
    // 获取所有需要更新的记录
    const jobs = await prisma.job.findMany({
      where: {
        OR: [
          { salaryNumeric: null },
          { salary: { not: null } }
        ]
      },
      select: {
        id: true,
        salary: true,
        salaryNumeric: true
      }
    });

    console.log(`找到 ${jobs.length} 条需要更新的记录`);

    // 批量处理，每批100条
    const batchSize = 100;
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      console.log(`处理第 ${i + 1} 到 ${Math.min(i + batchSize, jobs.length)} 条记录`);

      // 并行处理每一批数据
      await Promise.all(
        batch.map(async (job) => {
          try {
            if (job.salary && job.salary !== '0' && job.salary !== '未找到') {
              const numericSalary = await convertSalaryToUSD(job.salary);
              
              if (numericSalary !== null) {
                await prisma.job.update({
                  where: { id: job.id },
                  data: { salaryNumeric: numericSalary }
                });
                console.log(`✅ 更新成功: ID=${job.id}, 原薪资=${job.salary}, 转换后=${numericSalary}`);
              } else {
                console.log(`⚠️ 无法转换薪资: ID=${job.id}, 薪资=${job.salary}`);
              }
            } else {
              console.log(`ℹ️ 跳过无效薪资: ID=${job.id}, 薪资=${job.salary}`);
            }
          } catch (error) {
            console.error(`❌ 更新失败: ID=${job.id}, 错误=${error.message}`);
          }
        })
      );

      // 每批处理完后暂停一下，避免请求过于频繁
      if (i + batchSize < jobs.length) {
        console.log('等待3秒后继续下一批...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('所有数据更新完成！');
  } catch (error) {
    console.error('更新过程中发生错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行更新
updateSalaryNumeric().catch(console.error); 