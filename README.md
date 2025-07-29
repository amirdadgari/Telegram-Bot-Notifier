# 📱 Telegram Bot Notifier

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-supported-blue.svg)](https://www.docker.com/)

A powerful webhook-to-Telegram notification system with Node.js backend, SQLite database, and a beautiful responsive web UI with dark mode support! Send messages to Telegram chats via REST API endpoints with secure authentication and multi-user management.

## ⭐ Star this Repository

If you find this project useful, please give it a star! It helps others discover the project and motivates continued development.

## 🚀 Features

### 🔧 Core Functionality
- **🌐 Webhook API**: Send messages to Telegram via REST API endpoints
- **👥 Multi-User Support**: Each user has isolated tokens and bot configurations
- **🔑 Access Token Management**: Secure API authentication with UUID tokens
- **🤖 Telegram Bot Configuration**: Support for multiple bots per user
- **⚙️ Admin Panel**: Comprehensive user management and system administration

### 🎨 User Interface
- **📱 Responsive Design**: Beautiful, modern UI that works on all devices
- **🌙 Dark Mode**: Full dark mode support with 3-mode toggle (System/Light/Dark)
- **🎯 Intuitive Navigation**: Clean, user-friendly interface
- **⚡ Real-time Updates**: Instant feedback and smooth transitions

### 🔒 Security & Deployment
- **🔐 Secure Authentication**: Session-based login with password requirements
- **🐳 Docker Support**: Containerized for easy deployment
- **📊 SQLite Database**: Lightweight, embedded database
- **🛡️ User Isolation**: Each user's data is completely isolated

## 📋 Prerequisites

- Node.js 18+ or Docker
- Telegram Bot Token (from @BotFather)
- Chat ID where messages will be sent

## 🐳 Quick Start with Docker

1. **Clone and navigate to the project:**
   ```bash
   git clone <your-repo>
   cd webhook-to-telegram
   ```

2. **Start with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   - Open http://localhost:3000
   - Login with default credentials:
     - Username: `admin`
     - Password: `changeme`
   - You'll be prompted to change the password on first login

## 🛠️ Manual Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the application:**
   ```bash
   npm start
   ```

3. **Access the application:**
   - Open http://localhost:3000

## 📖 Setup Guide

### 1. Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Start a chat and send `/newbot`
3. Follow instructions to create your bot
4. Save the **Bot Token** (e.g., `123456789:ABCdefGhIJKlmNOpqrsTUVwxyZ`)

### 2. Get Chat ID

1. Add your bot to a chat/group/channel
2. Send a test message in the chat
3. Visit: `https://api.telegram.org/bot[BOT_TOKEN]/getUpdates`
4. Find the `"chat":{"id":` value in the response
5. Save the **Chat ID** (e.g., `-1001234567890` or `123456789`)

### 3. Configure the System

1. **Login to the web interface**
2. **Go to "Telegram Bots" page:**
   - Add your Bot Token and Chat ID
   - Give your bot a friendly name
3. **Go to "Access Tokens" page:**
   - Create a new access token
   - Copy the generated token for API use

## 🔗 API Usage

### Send Message Endpoint

**POST** `/api/send`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "message": "Your message here"
}
```

**Example with curl:**
```bash
curl -X POST http://localhost:3000/api/send \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "🚀 Hello from webhook!"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Message sending completed",
  "results": [
    {
      "bot_name": "My Bot",
      "success": true,
      "message_id": 123
    }
  ]
}
```

### Get User Info Endpoint

**GET** `/api/user`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## 🖥️ Web Interface

The system provides a clean, responsive web interface with the following pages:

- **Dashboard**: Overview and quick access to features
- **Access Tokens**: Create and manage API tokens
- **Telegram Bots**: Configure bot tokens and chat IDs
- **Users** (Admin only): Manage system users
- **Change Password**: Update account password

## 👥 User Management

### Default Admin Account
- Username: `admin`
- Password: `changeme` (must be changed on first login)

### Adding New Users (Admin only)
1. Go to the "Users" page
2. Click "Add New User"
3. Enter username and password
4. Optionally grant admin privileges
5. Each user gets their own isolated tokens and bots

## 🔒 Security Features

- **Session-based authentication**
- **Password requirements** (minimum 6 characters)
- **Forced password change** for default admin
- **Access token validation** for API requests
- **User isolation** (users can only see their own data)
- **Admin-only user management**

## 🐳 Docker Configuration

### Environment Variables

- `NODE_ENV`: Set to `production` for production deployment
- `PORT`: Server port (default: 3000)
- `SESSION_SECRET`: Session encryption key (change in production!)

### Volumes

- `./data:/app/data`: Persistent storage for SQLite database

### Health Check

The container includes a health check that verifies the application is responding on the configured port.

## 📁 Project Structure

```
webhook-to-telegram/
├── app.js                 # Main application file
├── package.json           # Dependencies and scripts
├── Dockerfile            # Docker container configuration
├── docker-compose.yml    # Docker Compose setup
├── database.db          # SQLite database (auto-created)
├── views/               # EJS templates
│   ├── login.ejs
│   ├── dashboard.ejs
│   ├── tokens.ejs
│   ├── bots.ejs
│   ├── users.ejs
│   └── change-password.ejs
└── README.md
```

## 🗄️ Database Schema

### Users Table
- `id`: Primary key
- `username`: Unique username
- `password`: Bcrypt hashed password
- `is_admin`: Admin privileges flag
- `password_changed`: First login password change tracking

### Tokens Table
- `id`: Primary key
- `user_id`: Foreign key to users
- `token`: UUID access token
- `name`: Token description
- `is_active`: Active status

### Telegram Bots Table
- `id`: Primary key
- `user_id`: Foreign key to users
- `bot_token`: Telegram bot token
- `chat_id`: Target chat ID
- `bot_name`: Friendly name
- `is_active`: Active status

## 🚨 Troubleshooting

### Common Issues

1. **"Invalid token" error:**
   - Verify the access token is correct
   - Check that the token is active
   - Ensure proper Authorization header format

2. **"No active Telegram bots configured" error:**
   - Add at least one bot configuration
   - Verify bot token and chat ID are correct
   - Test bot manually with Telegram API

3. **Bot not sending messages:**
   - Verify bot token is correct
   - Check that bot is added to the target chat
   - Ensure chat ID is correct (including negative sign for groups)

4. **Permission denied errors:**
   - Check if bot has necessary permissions in the chat
   - For groups/channels, bot should be an admin

## 📊 Monitoring

The application logs important events to the console:
- Server startup
- Admin user creation
- Database errors
- API request results

## 🔧 Development

### Running in Development Mode

```bash
npm install
npm run dev  # Uses nodemon for auto-reload
```

### Adding New Features

The application is structured with clear separation:
- Database operations in `app.js`
- Routes and middleware in `app.js`
- Frontend templates in `views/`
- Styling embedded in templates (can be extracted)

## 📝 License

MIT License - feel free to use this project for your own needs!

## 🤝 Contributing

1. Fork the project
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📸 Screenshots

### Login Page
![Login](https://via.placeholder.com/600x400/667eea/ffffff?text=Login+Page)

### Dashboard
![Dashboard](https://via.placeholder.com/600x400/667eea/ffffff?text=Dashboard)

### Dark Mode
![Dark Mode](https://via.placeholder.com/600x400/2d2d2d/ffffff?text=Dark+Mode)

## 🌟 Why Choose This Project?

- **Production Ready**: Fully tested and production-ready codebase
- **Well Documented**: Comprehensive documentation and setup guides
- **Active Development**: Regular updates and improvements
- **Community Driven**: Open source with community contributions welcome
- **Easy Setup**: Get running in minutes with Docker or Node.js

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **🍴 Fork the repository**
2. **🌿 Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **💾 Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **📤 Push to the branch** (`git push origin feature/amazing-feature`)
5. **🎯 Open a Pull Request**

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/webhook-to-telegram.git
cd webhook-to-telegram

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📝 Changelog

### v1.0.0 (Latest)
- ✨ Initial release with full feature set
- 🌙 Dark mode support with theme toggle
- 🔒 Secure authentication system
- 🐳 Docker containerization
- 📱 Responsive web interface

## 💡 Feature Requests & Bug Reports

Have an idea for improvement or found a bug?

- **🐛 Bug Reports**: [Open an issue](https://github.com/your-username/webhook-to-telegram/issues/new?template=bug_report.md)
- **💡 Feature Requests**: [Request a feature](https://github.com/your-username/webhook-to-telegram/issues/new?template=feature_request.md)
- **💬 Discussions**: [Join the discussion](https://github.com/your-username/webhook-to-telegram/discussions)

## 📞 Support

Need help? Here are your options:

1. **📖 Check the documentation** - Most questions are answered here
2. **🔍 Search existing issues** - Your question might already be answered
3. **❓ Open a new issue** - We're here to help!
4. **💬 Join discussions** - Connect with other users

## ⚡ Performance

- **Fast**: Lightweight Node.js backend
- **Scalable**: SQLite for small to medium deployments
- **Efficient**: Minimal resource usage
- **Responsive**: Quick API response times

## 🔐 Security

Security is a top priority:

- ✅ Session-based authentication
- ✅ Password hashing with bcrypt
- ✅ User data isolation
- ✅ Secure token generation
- ✅ Input validation and sanitization

## 🌍 Community

- **⭐ GitHub Stars**: Star this repo if you find it useful
- **🐛 Issues**: Report bugs and request features
- **💬 Discussions**: Ask questions and share ideas
- **🤝 Pull Requests**: Contribute code improvements

**Need help?** Check the troubleshooting section above or open an issue on the [project repository](https://github.com/your-username/webhook-to-telegram/issues).
