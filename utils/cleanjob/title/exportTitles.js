// scripts/exportTitles.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

(async () => {
  const jobs = await prisma.job.findMany({
    select: { id: true, title: true }
  });
  fs.writeFileSync('titles.json', JSON.stringify(jobs, null, 2), 'utf-8');
  console.log(`导出 ${jobs.length} 条 title`);
})();