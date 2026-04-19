# TaskFlow

A comprehensive task manager with color-coded categories, smart due date management, priority levels, drag-and-drop reordering, weekly progress tracking, and a clean dashboard view.

Built with [Builddy](https://builddy.dev) — AI-powered app builder using GLM 5.1.

## Features

- Full CRUD for tasks with title, description, priority, due date, and category
- Color-coded categories with custom color picker and category management
- Smart filtering by category, priority, date range, and completion status
- Weekly progress dashboard with completion stats and visual charts
- Drag-and-drop task reordering within categories
- Overdue task highlighting with urgency color indicators
- Quick-add task modal with keyboard shortcuts (Ctrl+N)
- Dark mode toggle with smooth theme transitions
- CSV export of tasks and completion history
- Today's tasks, upcoming, and overdue dashboard widgets

## Quick Start

### Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Docker

```bash
docker compose up
```

### Deploy to Railway/Render

1. Push this directory to a GitHub repo
2. Connect to Railway or Render
3. It auto-detects the Dockerfile
4. Done!

## Tech Stack

- **Frontend**: HTML/CSS/JS + Tailwind CSS
- **Backend**: Express.js
- **Database**: SQLite
- **Deployment**: Docker