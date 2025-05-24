import { prisma } from '../../../lib/prisma';

export default async function handler(req, res) {
  try {
    // 获取搜索配置
    if (req.method === 'GET') {
      // 从数据库获取配置
      const keywordConfig = await prisma.searchConfig.findFirst({
        where: { configType: 'keywords' },
        orderBy: { updatedAt: 'desc' }
      });

      const countryConfig = await prisma.searchConfig.findFirst({
        where: { configType: 'countries' },
        orderBy: { updatedAt: 'desc' }
      });

      // 默认配置
      const defaultKeywordItems = [
        "javascript", "nodejs", "frontend", "react", "web developer",
        "fullstack", "typescript", "vue", "angular", "nextjs",
        "nuxtjs", "svelte", "ember.js", "extjs", "html css",
        "tailwind", "bootstrap"
      ].map((keyword, index) => ({
        id: `keyword-${index}`,
        keyword,
        enabled: true,
        order: index + 1
      }));

      const defaultCountryItems = [
        { name: '美国', geoId: '103644278', code: 'us' },
        { name: '加拿大', geoId: '101174742', code: 'ca' },
        { name: '英国', geoId: '101165590', code: 'uk' },
        { name: '澳大利亚', geoId: '101452733', code: 'au' }
      ].map((country, index) => ({
        id: `country-${country.geoId}`,
        name: country.name,
        code: country.code,
        geoId: country.geoId,
        enabled: true,
        order: index + 1
      }));

      return res.status(200).json({
        keywordItems: keywordConfig?.configData?.keywordItems || defaultKeywordItems,
        countryItems: countryConfig?.configData?.countryItems || defaultCountryItems
      });
    }
    
    // 保存搜索配置
    if (req.method === 'POST') {
      const { keywordItems, countryItems } = req.body;
      
      // 验证数据
      if (!Array.isArray(keywordItems) || !Array.isArray(countryItems)) {
        return res.status(400).json({
          error: '配置数据格式错误'
        });
      }

      // 保存关键词配置
      await prisma.searchConfig.upsert({
        where: {
          configType: 'keywords'
        },
        update: {
          configData: {
            keywordItems
          },
          updatedAt: new Date()
        },
        create: {
          configType: 'keywords',
          configData: {
            keywordItems
          }
        }
      });

      // 保存国家配置
      await prisma.searchConfig.upsert({
        where: {
          configType: 'countries'
        },
        update: {
          configData: {
            countryItems
          },
          updatedAt: new Date()
        },
        create: {
          configType: 'countries',
          configData: {
            countryItems
          }
        }
      });

      return res.status(200).json({
        success: true,
        message: '搜索配置已保存',
        keywordItems,
        countryItems
      });
    }
    
    // 不支持的方法
    return res.status(405).json({
      error: '不支持的请求方法'
    });
  } catch (error) {
    console.error('搜索配置API错误:', error);
    return res.status(500).json({
      error: error.message || '处理搜索配置请求时出错'
    });
  }
} 