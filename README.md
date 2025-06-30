# RemoteJobs - 远程工作智能搜索与采集平台

一个基于 Next.js 构建的全栈应用，集成了智能批量采集和实时搜索功能，帮助用户发现全球远程工作机会。

## 🚀 功能特点

### 📊 智能批量采集系统
- **自动化任务管理**: 配置关键词和地区，自动批量采集LinkedIn职位数据
- **实时状态监控**: 通过SSE实时展示采集进度和状态
- **智能去重机制**: 避免重复采集，提高数据质量
- **灵活抓取配置**: 三种抓取速度模式（快速/正常/安全）
- **数据持久化**: 支持PostgreSQL数据库存储和本地缓存
- **任务状态管理**: 支持启动、暂停、恢复、停止操作

### 🔍 实时职位搜索
- **实时搜索**: 按关键词和地区搜索LinkedIn职位
- **智能排序**: 按薪资、发布日期、公司名称等维度排序
- **高级筛选**: 支持职位类型、经验等级、发布时间等多维度筛选
- **详情查看**: 点击查看完整职位描述、薪资、申请人数等详细信息
- **响应式设计**: 适配桌面和移动设备

### 📈 数据分析与清洗
- **职位数据标准化**: 统一薪资格式、地理位置信息
- **技能标签提取**: 自动识别技术栈和技能要求
- **薪资转换**: 多币种薪资自动转换为美元年薪
- **数据质量控制**: 重复数据检测和清理

## 🛠 技术栈

### 前端技术
- **框架**: React 18 + Next.js 13
- **样式**: Tailwind CSS + PostCSS
- **状态管理**: React Hooks + Context API
- **UI组件**: 自定义组件库，支持拖拽排序 (@dnd-kit)
- **数据获取**: Axios + React Query
- **实时通信**: Server-Sent Events (SSE)

### 后端技术
- **API**: Next.js API Routes
- **数据库**: PostgreSQL + Prisma ORM
- **网络爬虫**: Playwright (Chromium)
- **任务管理**: 分布式任务队列系统
- **数据处理**: 流式JSON处理 (stream-json)

### 数据与存储
- **主数据库**: PostgreSQL (支持复杂查询和事务)
- **缓存系统**: 本地JSON文件缓存
- **数据迁移**: Prisma migrations
- **备份策略**: 本地存储 + 数据库双重保障

## 🚀 快速开始

### 📋 环境要求

- **Node.js**: 16.0.0 或更高版本
- **包管理器**: npm, yarn 或 pnpm (推荐使用 pnpm)
- **数据库**: PostgreSQL 12+ (可选，不配置时使用本地存储)

### 📦 安装步骤

1. **克隆仓库**
   ```bash
   git clone <your-repo-url>
   cd RemoteJobs
   ```

2. **安装依赖**
   ```bash
   # 推荐使用 pnpm（更快、更省空间）
   pnpm install
   
   # 或使用其他包管理器
   npm install
   # yarn install
   ```

3. **安装 Playwright 浏览器** （必需步骤）
   ```bash
   # 使用 pnpm
   pnpm exec playwright install
   
   # 使用 npm
   npx playwright install
   
   # 使用 yarn
   yarn playwright install
   ```
   
   ⚠️ **重要**: 此步骤必不可少，否则爬虫功能无法工作

4. **配置环境变量**（可选）
   ```bash
   # 复制环境变量模板
   cp .env.example .env.local
   
   # 编辑环境变量文件，配置数据库连接
   # DATABASE_URL="postgresql://username:password@localhost:5432/remotejobs"
   # DIRECT_URL="postgresql://username:password@localhost:5432/remotejobs"
   ```

5. **初始化数据库**（如果配置了数据库）
   ```bash
   # 生成 Prisma 客户端
   pnpm prisma:generate
   
   # 运行数据库迁移
   pnpm prisma:migrate
   
   # 可选：初始化种子数据
   pnpm prisma:seed
   ```

6. **启动开发服务器**
   ```bash
   pnpm dev
   ```

7. **访问应用**
   - 主页（实时搜索）: http://localhost:3000
   - 任务控制台（批量采集）: http://localhost:3000/task-control
   - 数据分析页面: http://localhost:3000/analysis

## 📖 使用指南

### 🔍 实时搜索功能
1. 在主页输入职位关键词（如 "Frontend", "React", "Python"）
2. 选择地区或输入自定义地点
3. 配置高级筛选条件（可选）
4. 点击"搜索工作"按钮
5. 查看搜索结果，支持多种排序和筛选方式
6. 点击职位卡片查看详细信息

### 📊 批量采集功能
1. 访问 `/task-control` 页面
2. 点击"配置搜索参数"按钮
3. 配置关键词列表和目标国家/地区
4. 设置搜索参数（结果阈值、去重选项等）
5. 选择抓取速度模式
6. 点击"开始任务"启动批量采集
7. 通过实时状态监控查看采集进度

### 📈 数据分析功能
1. 访问 `/analysis` 页面
2. 查看已采集的职位数据统计
3. 使用虚拟化列表浏览大量数据
4. 应用筛选条件分析特定数据子集

## 🏗 项目结构

```
RemoteJobs/
├── components/          # React 组件
│   ├── analysis/       # 数据分析相关组件
│   ├── home/           # 主页搜索组件
│   ├── shared/         # 共享组件
│   └── task/           # 任务管理组件
├── pages/              # Next.js 页面
│   ├── api/            # API 路由
│   ├── index.js        # 主页（实时搜索）
│   ├── task-control.js # 任务控制页面
│   └── analysis.js     # 数据分析页面
├── utils/              # 工具函数
│   ├── cleanjob/       # 数据清洗工具
│   ├── taskManager.js  # 任务管理核心
│   ├── salaryConverter.js # 薪资转换
│   └── regions.js      # 地区配置
├── prisma/             # 数据库相关
│   ├── schema.prisma   # 数据库模式
│   └── migrations/     # 数据库迁移
├── scripts/            # 辅助脚本
└── data/               # 本地数据缓存
```

## 🐛 常见问题与解决方案

### Playwright 相关问题

**问题**: `Executable doesn't exist` 错误
**解决方案**: 
```bash
# 重新安装 Playwright 浏览器
pnpm exec playwright install
# 或
npx playwright install
```

**问题**: Playwright 版本兼容性问题
**解决方案**:
```bash
# 更新相关依赖
pnpm update playwright playwright-core
# 重新安装浏览器
pnpm exec playwright install
```

### 数据库连接问题

**问题**: 数据库连接失败
**解决方案**: 
1. 确保 PostgreSQL 服务正在运行
2. 检查 `.env.local` 中的数据库连接字符串
3. 如果不想使用数据库，可以不配置环境变量，系统会自动使用本地存储

**问题**: Prisma 客户端生成失败
**解决方案**:
```bash
# 清理并重新生成
rm -rf node_modules/.prisma
pnpm prisma:generate
```

### 抓取相关问题

**问题**: 频繁被 LinkedIn 限制
**解决方案**:
1. 调整抓取速度为"安全模式"
2. 减少并发请求数量
3. 增加请求间隔时间
4. 考虑使用代理IP

**问题**: 内存占用过高
**解决方案**:
1. 适当减少批量处理的数据量
2. 定期清理本地缓存数据
3. 监控系统资源使用情况

## 🚀 部署指南

### 使用 Docker 部署

1. **构建镜像**
   ```bash
   docker build -t remotejobs .
   ```

2. **运行容器**
   ```bash
   docker run -p 3000:3000 --env-file .env.local remotejobs
   ```

### 使用 Docker Compose

```bash
# 启动应用和数据库
docker-compose up -d

# 运行数据库迁移
docker-compose exec app pnpm prisma:migrate
```

### 部署到云平台

支持部署到以下平台：
- **Render**: 使用 `render.yaml` 配置文件
- **Fly.io**: 使用 `fly.toml` 配置文件
- **Vercel**: 需要配置环境变量和数据库

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📊 数据模型

项目包含以下主要数据模型：

- **Job**: 基础职位信息
- **JobClean**: 清洗后的标准化职位数据
- **TaskProgress**: 任务进度跟踪
- **SearchConfig**: 搜索配置管理
- **ExchangeRate**: 汇率数据

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## ⚠️ 重要声明

- 本项目仅供学习和研究目的使用
- 请遵守 LinkedIn 的服务条款和 robots.txt 规则
- 建议合理控制请求频率，避免对目标网站造成过大负担
- 用户需自行承担使用本项目可能产生的风险和责任

## 🙏 致谢

感谢以下开源项目：
- [Next.js](https://nextjs.org/) - React 全栈框架
- [Playwright](https://playwright.dev/) - 浏览器自动化工具
- [Prisma](https://www.prisma.io/) - 数据库ORM
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架 