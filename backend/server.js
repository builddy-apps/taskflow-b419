import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, '..', 'frontend');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(STATIC_DIR));

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/tasks', (req, res) => {
  try {
    const tasks = db.getTasksFiltered(req.query);
    res.json({ success: true, data: tasks });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

app.post('/api/tasks', (req, res) => {
  try {
    const { title, description, priority, category_id, due_date } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    const database = db.getDb();
    const row = database.prepare(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM tasks WHERE category_id IS ?'
    ).get(category_id || null);
    const task = db.create('tasks', {
      title: title.trim(),
      description: description || '',
      priority: priority || 'medium',
      category_id: category_id || null,
      due_date: due_date || null,
      completed: 0,
      sort_order: row.next,
    });
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to create task' });
  }
});

app.put('/api/tasks/:id', (req, res) => {
  try {
    const existing = db.getById('tasks', req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    const { title, description, priority, category_id, due_date, sort_order } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description;
    if (priority !== undefined) updates.priority = priority;
    if (category_id !== undefined) updates.category_id = category_id;
    if (due_date !== undefined) updates.due_date = due_date;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    const task = db.update('tasks', req.params.id, updates);
    res.json({ success: true, data: task });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to update task' });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    const existing = db.getById('tasks', req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    db.deleteById('tasks', req.params.id);
    res.json({ success: true, data: { id: parseInt(req.params.id) } });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

app.patch('/api/tasks/:id/toggle', (req, res) => {
  try {
    const task = db.getById('tasks', req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    const newStatus = task.completed === 1 ? 0 : 1;
    const updated = db.toggleTaskComplete(req.params.id, newStatus);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error toggling task:', err);
    res.status(500).json({ success: false, error: 'Failed to toggle task' });
  }
});

app.put('/api/tasks/reorder', (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Updates array is required' });
    }
    db.reorderTasks(updates);
    res.json({ success: true, data: updates });
  } catch (err) {
    console.error('Error reordering tasks:', err);
    res.status(500).json({ success: false, error: 'Failed to reorder tasks' });
  }
});

app.get('/api/tasks/export', (req, res) => {
  try {
    const tasks = db.getAll('tasks', 'created_at', 'DESC');
    const categories = db.getAll('categories');
    const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    
    const headers = ['ID', 'Title', 'Description', 'Priority', 'Category', 'Due Date', 'Status', 'Completed At', 'Created At'];
    const rows = tasks.map(t => [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.priority,
      categoryMap[t.category_id] || '',
      t.due_date || '',
      t.completed === 1 ? 'Completed' : 'Active',
      t.completed_at || '',
      t.created_at
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tasks-export.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Error exporting tasks:', err);
    res.status(500).json({ success: false, error: 'Failed to export tasks' });
  }
});

app.get('/api/categories', (req, res) => {
  try {
    const categories = db.getAll('categories', 'sort_order', 'ASC');
    const breakdown = db.getCategoryBreakdown();
    const result = categories.map(cat => {
      const stats = breakdown.find(b => b.id === cat.id) || { total_tasks: 0, incomplete_tasks: 0 };
      return { ...cat, total_tasks: stats.total_tasks, incomplete_tasks: stats.incomplete_tasks };
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }
    if (!color || !color.match(/^#[0-9A-Fa-f]{6}$/)) {
      return res.status(400).json({ success: false, error: 'Valid hex color is required' });
    }
    const database = db.getDb();
    const row = database.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM categories').get();
    const category = db.create('categories', {
      name: name.trim(),
      color,
      is_default: 0,
      sort_order: row.next,
    });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    console.error('Error creating category:', err);
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, error: 'Category name already exists' });
    }
    res.status(400).json({ success: false, error: err.message || 'Failed to create category' });
  }
});

app.put('/api/categories/:id', (req, res) => {
  try {
    const existing = db.getById('categories', req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    if (existing.is_default === 1) {
      return res.status(400).json({ success: false, error: 'Cannot modify default category' });
    }
    const { name, color, sort_order } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    const category = db.update('categories', req.params.id, updates);
    res.json({ success: true, data: category });
  } catch (err) {
    console.error('Error updating category:', err);
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, error: 'Category name already exists' });
    }
    res.status(400).json({ success: false, error: err.message || 'Failed to update category' });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const existing = db.getById('categories', req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    if (existing.is_default === 1) {
      return res.status(400).json({ success: false, error: 'Cannot delete default category' });
    }
    const reassignTo = req.query.reassign_to ? parseInt(req.query.reassign_to) : null;
    const database = db.getDb();
    if (reassignTo !== null) {
      const checkReassign = db.getById('categories', reassignTo);
      if (!checkReassign) {
        return res.status(400).json({ success: false, error: 'Target category for reassignment not found' });
      }
      database.prepare('UPDATE tasks SET category_id = ? WHERE category_id = ?').run(reassignTo, req.params.id);
    } else {
      database.prepare('UPDATE tasks SET category_id = NULL WHERE category_id = ?').run(req.params.id);
    }
    db.deleteById('categories', req.params.id);
    res.json({ success: true, data: { id: parseInt(req.params.id) } });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

app.get('/api/stats/dashboard', (req, res) => {
  try {
    const database = db.getDb();
    const today = new Date().toISOString().split('T')[0];
    
    const todayCount = database.prepare(`
      SELECT COUNT(*) AS count FROM tasks 
      WHERE due_date = ? AND completed = 0
    `).get(today).count;
    
    const upcomingCount = database.prepare(`
      SELECT COUNT(*) AS count FROM tasks 
      WHERE due_date > ? AND completed = 0
    `).get(today).count;
    
    const overdueCount = database.prepare(`
      SELECT COUNT(*) AS count FROM tasks 
      WHERE due_date < ? AND due_date IS NOT NULL AND completed = 0
    `).get(today).count;
    
    const totalCompleted = database.prepare(`
      SELECT COUNT(*) AS count FROM tasks WHERE completed = 1
    `).get().count;
    
    const totalActive = database.prepare(`
      SELECT COUNT(*) AS count FROM tasks WHERE completed = 0
    `).get().count;
    
    res.json({
      success: true,
      data: {
        today: todayCount,
        upcoming: upcomingCount,
        overdue: overdueCount,
        totalCompleted,
        totalActive
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
});

app.get('/api/stats/weekly', (req, res) => {
  try {
    const database = db.getDb();
    const weekOffset = parseInt(req.query.week_offset) || 0;
    const days = [];
    const labels = [];
    const completedCounts = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - (i + (weekOffset * 7)));
      const dateStr = date.toISOString().split('T')[0];
      const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      const result = database.prepare(`
        SELECT COUNT(*) AS count FROM tasks 
        WHERE completed_at >= ? AND completed_at < datetime(?, '+1 day')
      `).get(`${dateStr} 00:00:00`, `${dateStr} 00:00:00`);
      
      days.push(dateStr);
      labels.push(dayLabel);
      completedCounts.push(result.count);
    }
    
    res.json({
      success: true,
      data: {
        days,
        labels,
        completedCounts,
        totalCompleted: completedCounts.reduce((a, b) => a + b, 0)
      }
    });
  } catch (err) {
    console.error('Error fetching weekly stats:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch weekly stats' });
  }
});

app.get('/api/stats/category-breakdown', (req, res) => {
  try {
    const breakdown = db.getCategoryBreakdown();
    res.json({ success: true, data: breakdown });
  } catch (err) {
    console.error('Error fetching category breakdown:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch category breakdown' });
  }
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ success: false, error: 'API endpoint not found' });
  } else {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

db.initSchema();

app.listen(PORT, () => {
  console.log(`[server] TaskFlow running on http://localhost:${PORT}`);
});