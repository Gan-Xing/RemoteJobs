// scripts/normalizeCompany.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function normalizeCompanies() {
  const result = await prisma.$queryRaw`
    WITH ranked_companies AS (
      SELECT
        "companyUrl",
        company,
        COUNT(*) AS cnt,
        ROW_NUMBER() OVER (PARTITION BY "companyUrl" ORDER BY COUNT(*) DESC) AS rn
      FROM "Job"
      WHERE "companyUrl" IS NOT NULL
      GROUP BY "companyUrl", company
    )
    SELECT "companyUrl", company AS "normName"
    FROM ranked_companies
    WHERE rn = 1
  `;

  for (const { companyUrl, normName } of result) {
    await prisma.job.updateMany({
      where: { companyUrl },
      data: { company: normName }
    });
    console.log(`已归一化：${companyUrl} => ${normName}`);
  }
  await prisma.$disconnect();
}

normalizeCompanies().catch(e => {
  console.error(e);
  process.exit(1);
});