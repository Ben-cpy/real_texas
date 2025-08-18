 🎮 项目启动指南

  快速启动步骤：

  1. 安装后端依赖并启动后端服务：
  cd backend
  npm install
  npm run dev
  后端服务将运行在 http://localhost:3001

  2. 安装前端依赖并启动前端服务（新终端窗口）：
  cd frontend
  npm install
  npm run dev
  前端服务将运行在 http://localhost:3000

  3. 访问游戏：
  打开浏览器访问 http://localhost:3000

  🔧 平台兼容性说明：

  Windows 开发环境（当前）：
  - ✅ 使用 npm 包管理器
  - ✅ 使用相对路径避免路径分隔符问题
  - ✅ 环境变量配置文件 .env

  Linux 部署环境（未来）：
  - ✅ Docker 容器化部署支持
  - ✅ PM2 进程管理
  - ✅ Nginx 反向代理配置
  - ✅ 跨平台依赖包选择

  🚀 已完成的功能：

  1. 项目架构：前后端分离架构，Vue3 + Node.js
  2. 用户系统：注册、登录、身份验证
  3. 游戏界面：响应式德州扑克游戏界面
  4. 实时通信：Socket.IO 支持多人在线游戏
  5. 数据持久化：SQLite 数据库，支持用户数据和游戏记录
  6. 完整的 API：RESTful API + WebSocket 事件

  📁 项目文件结构：

  true_texas/
  ├── frontend/          # Vue3 前端应用
  ├── backend/           # Node.js 后端服务
  ├── TODO.md           # 详细开发计划
  ├── README.md         # 完整启动说明
  └── docker-compose.yml # Docker 部署配置

  您现在就可以按照上述步骤启动项目了！游戏包含了完整的用户注册登录系统、游戏大厅、以及功能完整的德州扑克游戏界面。