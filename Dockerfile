FROM mcr.microsoft.com/playwright:v1.40.1-jammy

# 创建工作目录
WORKDIR /app

# 拷贝项目文件
COPY . .

# 安装依赖，但跳过postinstall脚本
RUN npm install --ignore-scripts

# 构建 Next.js 项目
RUN npm run build

# 启动服务
CMD ["npm", "start"]