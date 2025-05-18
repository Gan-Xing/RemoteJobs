# 使用稳定 node 镜像
FROM node:18-slim

# 安装 Playwright 浏览器依赖
RUN apt-get update && apt-get install -y \
    wget gnupg unzip \
    libnss3 libatk-bridge2.0-0 libxss1 libasound2 libgbm1 \
    libgtk-3-0 libxshmfence1 libxcomposite1 libxdamage1 \
    libxrandr2 libx11-xcb1 libdrm2 libxext6 libxfixes3 \
 && rm -rf /var/lib/apt/lists/*

# 降级 npm 避免 bug（最新版本存在 matches null 错误）
RUN npm install -g npm@9

# 全局安装 playwright 并安装浏览器
RUN npm install -g playwright && npx playwright install --with-deps

# 设置工作目录
WORKDIR /app

# 首先只复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm

# 复制所有项目文件
COPY . .

# 安装项目依赖
RUN pnpm install

# 生成 Prisma Client
RUN npx prisma generate

# 构建 Next.js 项目
RUN pnpm run build

# 开放端口
EXPOSE 3000

# 启动服务
CMD ["pnpm", "start"]