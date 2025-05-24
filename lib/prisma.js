import { PrismaClient } from '@prisma/client';

// 创建全局 Prisma 客户端实例
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { prisma }; 