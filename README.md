🎮 Project Startup Guide

Quick Start Steps:

1. Install backend dependencies and start the backend service:
```bash
cd backend
npm install
npm run dev
```
The backend service will run at http://localhost:3001

2. Install frontend dependencies and start the frontend service (in a new terminal window):
```bash
cd frontend
npm install
npm run dev
```
The frontend service will run at http://localhost:3000

3. Access the game:
- Main entry: http://localhost:3000
- If using proxy tools like V2rayN: http://192.168.1.105:3000 (your local IP)
- Backend API: http://localhost:3001

⚠️ Common Issues:

**Port 3000 in use:**
```bash
# Check port usage
netstat -ano | findstr :3000

# Kill the process occupying the port (replace <PID> with actual process ID)
taskkill //PID <PID> //F
```

🔧 Platform Compatibility:

Windows Development Environment (current):
- ✅ Use npm package manager
- ✅ Use relative paths to avoid path separator issues
- ✅ Environment variable config file: .env

Linux Deployment Environment (future):
- ✅ Docker container deployment supported
- ✅ PM2 process management
- ✅ Nginx reverse proxy configuration
- ✅ Cross-platform dependency selection

🚀 Completed Features:

1. Project architecture: Frontend-backend separation, Vue3 + Node.js
2. User system: Registration, login, authentication
3. Game interface: Responsive Texas Hold'em UI
4. Real-time communication: Socket.IO for multiplayer online gaming
5. Data persistence: SQLite database for user data and game records
6. Complete API: RESTful API + WebSocket events

📁 Project File Structure:

true_texas/
├── frontend/          # Vue3 frontend app
├── backend/           # Node.js backend service
├── TODO.md            # Detailed development plan
├── README.md          # Full startup instructions
└── docker-compose.yml # Docker deployment config

You can now start the project following the steps above! The game includes a complete user registration and login system, game lobby, and a fully functional Texas Hold'em interface.