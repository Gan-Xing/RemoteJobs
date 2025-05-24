import { prisma } from '../../../utils/prisma';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // 获取关键词配置
      const keywordConfig = await prisma.searchConfig.findFirst({
        where: { configType: 'keywords' },
        orderBy: { updatedAt: 'desc' }
      });

      // 获取国家配置
      const countryConfig = await prisma.searchConfig.findFirst({
        where: { configType: 'countries' },
        orderBy: { updatedAt: 'desc' }
      });

      // 获取搜索参数配置
      const searchParamsConfig = await prisma.searchConfig.findFirst({
        where: { configType: 'searchParams' },
        orderBy: { updatedAt: 'desc' }
      });

      // 返回配置数据
      res.status(200).json({
        keywordItems: keywordConfig?.configData?.keywordItems || [],
        countryItems: countryConfig?.configData?.countryItems || [],
        searchParams: searchParamsConfig?.configData || {
          resultThreshold: 50,
          deduplicateBeforeDetail: true,
          useDeduplicatedCount: true
        }
      });
    } catch (error) {
      console.error('获取配置失败:', error);
      res.status(500).json({ error: '获取配置失败' });
    }
  } else if (req.method === 'POST') {
    try {
      const { keywordItems, countryItems, searchParams } = req.body;

      // 验证数据
      if (!Array.isArray(keywordItems) || !Array.isArray(countryItems)) {
        throw new Error('无效的配置数据');
      }

      // 保存关键词配置
      await prisma.searchConfig.create({
        data: {
          configType: 'keywords',
          configData: { keywordItems }
        }
      });

      // 保存国家配置
      await prisma.searchConfig.create({
        data: {
          configType: 'countries',
          configData: { countryItems }
        }
      });

      // 保存搜索参数配置
      await prisma.searchConfig.create({
        data: {
          configType: 'searchParams',
          configData: searchParams || {
            resultThreshold: 50,
            deduplicateBeforeDetail: true,
            useDeduplicatedCount: true
          }
        }
      });

      res.status(200).json({ message: '配置保存成功' });
    } catch (error) {
      console.error('保存配置失败:', error);
      res.status(500).json({ error: '保存配置失败' });
    }
  } else {
    res.status(405).json({ error: '不支持的请求方法' });
  }
} 