/**
 * TaskFlow — Express Server
 * CORS, JSON parsing, static file serving, health check, and error handling.
 *
 * Custom routes for tasks, categories, and stats.
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, "frontend");

// ---------------------------------------------------------------------------
// App Setup
// ---------------------------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(STATIC_DIR));

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ---------------------------------------------------------------------------
// Task Routes
// ---------------------------------------------------------------------------

app.get("/api/tasks", (req, res) => {
  try {
    const tasks = db.getTasksFiltered(req.query);
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/tasks", (req, res) => {
  try {
    const { title, description, priority, category_id, due_date } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: "Title is required" });
    }
    const database = db.getDb();
    const row = database.prepare(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM tasks WHERE category_id IS ?"
    ).get(category_id || null);
    const task = db.create("tasks", {
      title: title.trim(),
      description: description || null,
      priority: priority || "medium",
      category_id: category_id || null,
      due_date: due_date || null,
      completed: 0,
      sort_order: row.next,
    });
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put("/api/tasks/:id", (req, res) => {
  try {
    const existing = db.getById("tasks", req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "Task not found" });
    const updates = { ...req.body };
    if (updates.completed !== undefined) {
      updates.completed_at = (updates.completed == 1 || updates.completed === true)
        ? new Date().toISOString() : null;
    }
    const task = db.update("tasks", req.params.id, updates);
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/tasks/:id", (req, res) => {
  try {
    db.deleteRow("tasks", req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/tasks/:id/reorder", (req, res) => {
  try {
    db.reorderTasks(req.params.id, req.body.sort_order, req.body.category_id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/tasks/batch-delete", (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: "ids must be an array" });
    }
    db.batchDeleteTasks(ids);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Category Routes
// ---------------------------------------------------------------------------

app.get("/api/categories", (_req, res) => {
  try {
    const database = db.getDb();
    const categories = database.prepare(`
      SELECT c.*,
        SUM(CASE WHEN t.completed = 0 THEN 1 ELSE 0 END) AS task_count
      FROM categories c
      LEFT JOIN tasks t ON t.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order
    `).all();
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/categories", (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }
    if (name.trim().length > 30) {
      return res.status(400).json({ success: false, error: "Name must be 30 characters or less" });
    }
    const database = db.getDb();
    const existing = database.prepare("SELECT id FROM categories WHERE name = ?").get(name.trim());
    if (existing) {
      return res.status(400).json({ success: false, error: "Category name must be unique" });
    }
    const category = db.create("categories", { name: name.trim(), color: color || "#3b82f6" });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put("/api/categories/:id", (req, res) => {
  try {
    const category = db.update("categories", req.params.id, req.body);
    if (!category) return res.status(404).json({ success: false, error: "Category not found" });
    res.json({ success: true, data: category });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/categories/:id", (req, res) => {
  try {
    const database = db.getDb();
    const reassignTo = req.query.reassign_to ? parseInt(req.query.reassign_to, 10) : null;
    if (reassignTo) {
      const result = database.prepare(
        "UPDATE tasks SET category_id = ? WHERE category_id = ?"
      ).run(reassignTo, req.params.id);
      db.deleteRow("categories", req.params.id);
      return res.json({ success: true, reassigned_count: result.changes });
    }
    const result = database.prepare(
      "UPDATE tasks SET category_id = NULL WHERE category_id = ?"
    ).run(req.params.id);
    db.deleteRow("categories", req.params.id);
    res.json({ success: true, reassigned_count: result.changes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Stats Routes
// ---------------------------------------------------------------------------

app.get("/api/stats/weekly", (_req, res) => {
  try {
    const data = db.getWeeklyStats();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/stats/dashboard", (_req, res) => {
  try {
    const data = db.getDashboardStats();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/stats/category-breakdown", (_req, res) => {
  try {
    const database = db.getDb();
    const breakdown = database.prepare(`
      SELECT c.id AS category_id, c.name, c.color,
        COUNT(t.id) AS total,
        SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) AS completed,
        CASE WHEN COUNT(t.id) > 0
          THEN ROUND(100.0 * SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) / COUNT(t.id), 1)
          ELSE 0 END AS percentage
      FROM categories c
      LEFT JOIN tasks t ON t.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order
    `).all();
    res.json(breakdown);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Custom Route Insertion Point
// ---------------------------------------------------------------------------

// {{ROUTE_INSERTION_POINT}}
// Add your custom API routes above this comment.

// ---------------------------------------------------------------------------
// SPA Fallback
// ---------------------------------------------------------------------------

app.get("*", (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

// ---------------------------------------------------------------------------
// Global Error Handling Middleware
// ---------------------------------------------------------------------------

app.use((err, _req, res, _next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

function start() {
  db.initSchema();
  app.listen(PORT, () => {
    console.log(`[server] Running on http://localhost:${PORT}`);
    console.log(`[server] Static files served from ${STATIC_DIR}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };