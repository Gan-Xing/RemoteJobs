// pages/api/config/search.js
const { Pool } = require('pg');

// === 数据库连接池 ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
  // 若 Supabase / Render 需要 SSL：
  // ssl: { rejectUnauthorized: false }
});

const TABLE  = '"SearchConfig"';  // 若不区分大小写可写成 searchconfig
const userId = 'ganxing-dev';     // 默认用户 ID

async function handler(req, res) {
  /* ---------------------  GET  --------------------- */
  if (req.method === 'GET') {
    try {
      const client = await pool.connect();

      const keywordSQL = `
        SELECT "configData"
        FROM ${TABLE}
        WHERE "userId" = $1 AND "configType" = 'keywords'
        ORDER BY "updatedAt" DESC
        LIMIT 1;
      `;
      const countrySQL = `
        SELECT "configData"
        FROM ${TABLE}
        WHERE "userId" = $1 AND "configType" = 'countries'
        ORDER BY "updatedAt" DESC
        LIMIT 1;
      `;
      const searchParamsSQL = `
        SELECT "configData"
        FROM ${TABLE}
        WHERE "userId" = $1 AND "configType" = 'searchParams'
        ORDER BY "updatedAt" DESC
        LIMIT 1;
      `;

      const [keywordRes, countryRes, searchParamsRes] = await Promise.all([
        client.query(keywordSQL, [userId]),
        client.query(countrySQL, [userId]),
        client.query(searchParamsSQL, [userId])
      ]);
      client.release();

      res.status(200).json({
        keywordItems  : keywordRes.rows[0]?.configData?.keywordItems  ?? [],
        countryItems  : countryRes.rows[0]?.configData?.countryItems  ?? [],
        searchParams  : searchParamsRes.rows[0]?.configData ?? {
          resultThreshold        : 50,
          deduplicateBeforeDetail: true,
          useDeduplicatedCount   : true
        }
      });
    } catch (err) {
      console.error('获取配置失败:', err);
      res.status(500).json({ error: '获取配置失败' });
    }
    return;
  }

  /* ---------------------  POST  -------------------- */
  if (req.method === 'POST') {
    try {
      const { keywordItems, countryItems, searchParams } = req.body || {};

      if (!Array.isArray(keywordItems) || !Array.isArray(countryItems)) {
        return res.status(400).json({ error: '无效的配置数据' });
      }

      const client = await pool.connect();
      await client.query('BEGIN'); // 三条一起成功/失败

      // —— UPSERT 关键词配置 ——
      const upsertKeyword = `
        INSERT INTO ${TABLE} ("id", "userId", "configType", "configData", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, 'keywords', $2::jsonb, NOW(), NOW())
        ON CONFLICT ("userId", "configType")
        DO UPDATE SET "configData" = EXCLUDED."configData", "updatedAt" = NOW();
      `;
      await client.query(upsertKeyword, [userId, JSON.stringify({ keywordItems })]);

      // —— UPSERT 国家配置 ——
      const upsertCountry = `
        INSERT INTO ${TABLE} ("id", "userId", "configType", "configData", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, 'countries', $2::jsonb, NOW(), NOW())
        ON CONFLICT ("userId", "configType")
        DO UPDATE SET "configData" = EXCLUDED."configData", "updatedAt" = NOW();
      `;
      await client.query(upsertCountry, [userId, JSON.stringify({ countryItems })]);

      // —— UPSERT 搜索参数配置 ——
      const defaultSearchParams = {
        resultThreshold        : 50,
        deduplicateBeforeDetail: true,
        useDeduplicatedCount   : true
      };
      const upsertSearchParams = `
        INSERT INTO ${TABLE} ("id", "userId", "configType", "configData", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, 'searchParams', $2::jsonb, NOW(), NOW())
        ON CONFLICT ("userId", "configType")
        DO UPDATE SET "configData" = EXCLUDED."configData", "updatedAt" = NOW();
      `;
      await client.query(upsertSearchParams, [
        userId,
        JSON.stringify(searchParams ?? defaultSearchParams)
      ]);

      await client.query('COMMIT');
      client.release();

      res.status(200).json({ message: '配置保存成功' });
    } catch (err) {
      console.error('保存配置失败:', err);
      res.status(500).json({ error: '保存配置失败' });
    }
    return;
  }

  /* -------------------  其他方法  ------------------- */
  res.status(405).json({ error: '不支持的请求方法' });
}

module.exports = handler;   // ⬅️ 关键：确保默认导出
// Ensure Next.js can find a default export
module.exports.default = handler;