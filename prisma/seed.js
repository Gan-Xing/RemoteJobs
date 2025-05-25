const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const defaultUserId = 'ganxing'; // 默认用户ID

  // 初始化关键词配置
  await prisma.searchConfig.upsert({
    where: {
      userId_configType: {
        userId: defaultUserId,
        configType: 'keywords'
      }
    },
    update: {},
    create: {
      userId: defaultUserId,
      configType: 'keywords',
      configData: {
        keywordItems: [
          { id: '1', keyword: 'frontend', enabled: true, order: 1 },
          { id: '2', keyword: 'web developer', enabled: true, order: 2 },
          { id: '3', keyword: 'javascript', enabled: true, order: 3 },
          { id: '4', keyword: 'typescript', enabled: true, order: 4 },
          { id: '5', keyword: 'react developer', enabled: true, order: 5 },
          { id: '6', keyword: 'vuejs', enabled: true, order: 6 },
          { id: '7', keyword: 'nextjs', enabled: true, order: 7 },
          { id: '8', keyword: 'nuxtjs', enabled: true, order: 8 },
          { id: '9', keyword: 'svelte', enabled: true, order: 9 },
          { id: '10', keyword: 'html', enabled: true, order: 10 },
          { id: '11', keyword: 'css', enabled: true, order: 11 },
          { id: '12', keyword: 'Tailwind CSS', enabled: true, order: 12 },
          { id: '13', keyword: 'Bootstrap', enabled: true, order: 13 },
          { id: '14', keyword: 'Angular', enabled: true, order: 14 },
          { id: '15', keyword: 'Front-end Engineer', enabled: true, order: 15 }
        ]
      }
    }
  });

  // 初始化国家配置
  await prisma.searchConfig.upsert({
    where: {
      userId_configType: {
        userId: defaultUserId,
        configType: 'countries'
      }
    },
    update: {},
    create: {
      userId: defaultUserId,
      configType: 'countries',
      configData: {
        countryItems: [
          { id: '1', name: 'United States', code: 'US', geoId: '103644278', enabled: true, order: 1 },
          { id: '2', name: 'United Kingdom', code: 'GB', geoId: '101165590', enabled: true, order: 2 },
          { id: '3', name: 'Canada', code: 'CA', geoId: '101174742', enabled: true, order: 3 }
        ]
      }
    }
  });

  // 初始化搜索参数配置
  await prisma.searchConfig.upsert({
    where: {
      userId_configType: {
        userId: defaultUserId,
        configType: 'searchParams'
      }
    },
    update: {},
    create: {
      userId: defaultUserId,
      configType: 'searchParams',
      configData: {
        resultThreshold: 50,
        deduplicateBeforeDetail: true,
        useDeduplicatedCount: true
      }
    }
  });

  console.log('数据库初始化完成');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 