# 远程工作搜索平台

这是一个基于Next.js构建的全栈应用，用于搜索和浏览远程工作机会。

## 功能特点

- 搜索LinkedIn上的远程工作机会
- 按薪资、发布日期和公司名称排序
- 查看详细的职位信息和要求
- 自定义搜索设置（职位数量和详情获取数量）
- 响应式设计，适配各种设备

## 技术栈

- **前端**: React, Next.js, Tailwind CSS
- **后端**: Next.js API Routes
- **网络爬虫**: Playwright
- **部署**: 可部署在Vercel等平台

## 开始使用

### 环境要求

- Node.js 14.x 或更高版本
- npm, yarn 或 pnpm

### 安装

1. 克隆仓库
   ```
   git clone https://github.com/yourusername/remote-job-finder.git
   cd remote-job-finder
   ```

2. 安装依赖

   使用 npm:
   ```
   npm install
   ```
   
   使用 yarn:
   ```
   yarn install
   ```
   
   使用 pnpm:
   ```
   pnpm install
   ```

3. 安装Playwright浏览器（必须步骤）

   这一步是必须的，否则应用将无法正常运行。根据你使用的包管理器，运行以下命令：

   使用 npm:
   ```
   npx playwright install
   ```
   
   使用 yarn:
   ```
   yarn playwright install
   ```
   
   使用 pnpm:
   ```
   pnpm exec playwright install
   ```

   ⚠️ 重要说明：仅安装依赖（`npm install`/`yarn install`/`pnpm install`）是不够的，必须执行上述命令来安装Playwright所需的浏览器。特别是对于pnpm用户，必须使用`pnpm exec playwright install`命令，而不是`pnpm install playwright`。

4. 启动开发服务器

   使用 npm:
   ```
   npm run dev
   ```
   
   使用 yarn:
   ```
   yarn dev
   ```
   
   使用 pnpm:
   ```
   pnpm run dev
   ```

5. 在浏览器中访问 http://localhost:3000

## 使用说明

1. 在主页搜索表单中输入职位关键词（如"Frontend", "React", "Python"）
2. 输入地点（如"Worldwide", "Europe", "USA"）
3. 点击齿轮图标可以自定义设置：
   - 搜索职位数量（5-50）
   - 获取详情的职位数量（1-10）
4. 点击"搜索工作"按钮
5. 浏览结果，可以根据薪资、发布日期或公司名称排序
6. 点击任意职位卡片查看详细信息

## 常见问题

### 如果遇到"Executable doesn't exist"错误
这表示Playwright的浏览器未正确安装。请运行上述的Playwright安装命令。

### 如果遇到其他Playwright相关错误
可能是由于Playwright版本更新导致。尝试更新项目依赖：
```
npm update playwright playwright-core
# 或
yarn upgrade playwright playwright-core
# 或
pnpm update playwright playwright-core
```
然后重新安装浏览器。

## 注意事项

- 本项目仅供学习和研究目的
- 请遵守LinkedIn的使用条款
- 不要频繁发送大量请求，以避免IP被封 