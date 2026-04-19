/**
 * Builddy Standard Scaffold — Database Module
 * SQLite setup with WAL mode and generic CRUD helpers.
 *
 * Modification Points:
 *   // {{SCHEMA_INSERTION_POINT}}  — Add CREATE TABLE statements here
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "app.db");

let _db = null;

/**
 * Get or create the singleton database connection.
 * Configures WAL mode for better concurrent read performance.
 */
function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    console.log(`[db] SQLite database opened at ${DB_PATH} (WAL mode)`);
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Schema Initialisation
// ---------------------------------------------------------------------------

function initSchema() {
  const db = getDb();

  // {{SCHEMA_INSERTION_POINT}}

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      color      TEXT    NOT NULL,
      icon       TEXT    DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT    DEFAULT '',
      priority    TEXT    DEFAULT 'medium' CHECK(priority IN ('high','medium','low')),
      category_id INTEGER DEFAULT NULL,
      due_date    TEXT    DEFAULT NULL,
      completed   INTEGER DEFAULT 0,
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now')),
      completed_at TEXT   DEFAULT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );
  `);

  // Seed default categories if empty
  const count = db.prepare("SELECT COUNT(*) AS cnt FROM categories").get().cnt;
  if (count === 0) {
    _seedCategories(db);
  }

  console.log("[db] Schema initialised.");
}

function _seedCategories(db) {
  const stmt = db.prepare(
    "INSERT INTO categories (name, color, icon, sort_order) VALUES (?, ?, ?, ?)"
  );
  const defaults = [
    ["Work", "#3B82F6", "briefcase", 1],
    ["Personal", "#8B5CF6", "user", 2],
    ["Health", "#10B981", "heart", 3],
    ["Learning", "#F59E0B", "book", 4],
  ];
  const insertMany = db.transaction((rows) => {
    for (const r of rows) stmt.run(...r);
  });
  insertMany(defaults);
}

// ---------------------------------------------------------------------------
// Custom Query Functions
// ---------------------------------------------------------------------------

function getTasksFiltered(filters = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.category_id !== undefined && filters.category_id !== null) {
    conditions.push("t.category_id = ?");
    params.push(filters.category_id);
  }
  if (filters.status === "completed") {
    conditions.push("t.completed = 1");
  } else if (filters.status === "pending") {
    conditions.push("t.completed = 0");
  }
  if (filters.priority) {
    conditions.push("t.priority = ?");
    params.push(filters.priority);
  }
  if (filters.date_from) {
    conditions.push("date(t.due_date) >= date(?)");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push("date(t.due_date) <= date(?)");
    params.push(filters.date_to);
  }
  if (filters.overdue_only) {
    conditions.push("date(t.due_date) < date('now') AND t.completed = 0");
  }
  if (filters.today_only) {
    conditions.push("date(t.due_date) = date('now')");
  }
  if (filters.upcoming_only) {
    conditions.push("date(t.due_date) > date('now') AND t.completed = 0");
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const sql = `SELECT t.*, c.name AS category_name, c.color AS category_color
               FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
               ${where} ORDER BY t.sort_order, t.created_at DESC`;
  return db.prepare(sql).all(...params);
}

function getWeeklyStats() {
  const db = getDb();
  const sql = `SELECT date(due_date) AS date,
                  COUNT(*) AS total,
                  SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed
               FROM tasks
               WHERE due_date >= date('now', 'weekday 1', '-7 days')
                 AND due_date < date('now', 'weekday 1')
                 AND due_date IS NOT NULL
               GROUP BY date(due_date)
               ORDER BY date`;
  return db.prepare(sql).all();
}

function getDashboardStats() {
  const db = getDb();
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM tasks WHERE date(due_date) = date('now')) AS today_total,
      (SELECT COUNT(*) FROM tasks WHERE date(due_date) = date('now') AND completed = 1) AS today_completed,
      (SELECT COUNT(*) FROM tasks WHERE date(due_date) < date('now') AND completed = 0) AS overdue_count,
      (SELECT COUNT(*) FROM tasks WHERE date(due_date) > date('now') AND completed = 0) AS upcoming_count,
      (SELECT COUNT(*) FROM tasks) AS total_tasks,
      (SELECT COUNT(*) FROM tasks WHERE completed = 1) AS total_completed
  `).get();
}

function reorderTasks(taskId, newSortOrder, categoryId) {
  const db = getDb();
  const tx = db.transaction(() => {
    const task = db.prepare("SELECT sort_order AS old_order FROM tasks WHERE id = ?").get(taskId);
    if (!task) return;
    if (task.old_order === newSortOrder) return;

    const catFilter = categoryId !== null ? "category_id = ?" : "category_id IS NULL";
    const catParams = categoryId !== null ? [categoryId] : [];

    if (newSortOrder < task.old_order) {
      db.prepare(
        `UPDATE tasks SET sort_order = sort_order + 1
         WHERE ${catFilter} AND sort_order >= ? AND sort_order < ?`
      ).run(...catParams, newSortOrder, task.old_order);
    } else {
      db.prepare(
        `UPDATE tasks SET sort_order = sort_order - 1
         WHERE ${catFilter} AND sort_order > ? AND sort_order <= ?`
      ).run(...catParams, task.old_order, newSortOrder);
    }
    db.prepare("UPDATE tasks SET sort_order = ? WHERE id = ?").run(newSortOrder, taskId);
  });
  tx();
  return getById("tasks", taskId);
}

function resetAndSeedCategories() {
  const db = getDb();
  db.prepare("UPDATE tasks SET category_id = NULL WHERE category_id IS NOT NULL").run();
  db.prepare("DELETE FROM categories").run();
  _seedCategories(db);
  return getAll("categories", "sort_order");
}

// ---------------------------------------------------------------------------
// Generic CRUD Helpers
// ---------------------------------------------------------------------------

function getAll(table, orderCol = "id") {
  const db = getDb();
  const sql = `SELECT * FROM ${table} ORDER BY ${orderCol}`;
  return db.prepare(sql).all();
}

function getById(table, id) {
  const db = getDb();
  const sql = `SELECT * FROM ${table} WHERE id = ?`;
  return db.prepare(sql).get(id);
}

function create(table, data) {
  const db = getDb();
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
  const info = db.prepare(sql).run(...vals);
  return getById(table, info.lastInsertRowid);
}

function update(table, id, data) {
  const db = getDb();
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const setClause = cols.map((c) => `${c} = ?`).join(", ");
  const sql = `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  db.prepare(sql).run(...vals, id);
  return getById(table, id);
}

function deleteRow(table, id) {
  const db = getDb();
  const sql = `DELETE FROM ${table} WHERE id = ?`;
  const info = db.prepare(sql).run(id);
  return info.changes > 0;
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
    console.log("[db] Database connection closed.");
  }
}

process.on("SIGINT", () => {
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  process.exit(0);
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getDb,
  initSchema,
  getAll,
  getById,
  create,
  update,
  deleteRow,
  closeDb,
  getTasksFiltered,
  getWeeklyStats,
  getDashboardStats,
  reorderTasks,
  resetAndSeedCategories,
};