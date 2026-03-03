# Sofenzo Assistant

Beauty Procedure Tracker & Planner with AI Assistant and Telegram Integration.

## ✨ Features

- 🗓 **Beauty Calendar**: Plan and track your procedures.
- 💬 **AI Assistant**: Get personalized advice and automatic scheduling (GPT-4 powered).
- 🔔 **Telegram Notifications**: Reminders about upcoming sessions.
- 📦 **Directus Backend**: Secure storage for user data and history.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- [Directus](https://directus.io/) instance
- Telegram Bot Token ([BotFather](https://t.me/botfather))
- OpenAI API Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/thebtcbox-svg/sofenzo.git
   cd sofenzo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your keys
   ```

4. Build and Run:
   ```bash
   npm run build
   npm run start
   ```

## 🛠 Deployment

The project is ready for deployment on **Railway** or **Heroku**.

### Railway Deployment

1. Connect your GitHub repository to Railway.
2. Add the following Variables in Railway dashboard:
   - `OPENAI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `VITE_DIRECTUS_URL`
   - `VITE_DIRECTUS_TOKEN`
3. Railway will automatically use `railway.json` and `npm run build` / `npm run start`.

## 📜 License

ISC
