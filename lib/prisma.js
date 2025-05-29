import { PrismaClient } from '@prisma/client';

// 创建全局 Prisma 客户端实例
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
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
  },

});


if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

