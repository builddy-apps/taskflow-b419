import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'app.db');

let _db = null;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: false });
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    console.log(`[db] SQLite database opened at ${DB_PATH}`);
  }
  return _db;
}

function initSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      due_date TEXT DEFAULT NULL,
      category_id INTEGER DEFAULT NULL,
      completed INTEGER DEFAULT 0,
      completed_at TEXT DEFAULT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );
  `);

  const count = db.prepare('SELECT COUNT(*) AS cnt FROM categories').get().cnt;
  if (count === 0) {
    _seedCategories(db);
  }

  console.log('[db] Schema initialized.');
}

function _seedCategories(db) {
  const categories = [
    { name: 'Work', color: '#3B82F6', is_default: 1 },
    { name: 'Personal', color: '#8B5CF6', is_default: 1 },
    { name: 'Health', color: '#10B981', is_default: 1 },
    { name: 'Learning', color: '#F59E0B', is_default: 1 }
  ];

  const stmt = db.prepare(`
    INSERT INTO categories (name, color, is_default, sort_order)
    VALUES (@name, @color, @is_default, @sort_order)
  `);

  const insertMany = db.transaction((cats) => {
    for (const cat of cats) {
      stmt.run(cat);
    }
  });

  insertMany(categories);
  console.log('[db] Default categories seeded: Work, Personal, Health, Learning');
}

function create(table, data) {
  const db = getDb();
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  
  const stmt = db.prepare(`
    INSERT INTO ${table} (${keys.join(', ')})
    VALUES (${placeholders})
  `);
  
  const info = stmt.run(...values);
  return getById(table, info.lastInsertRowid);
}

function update(table, id, data) {
  const db = getDb();
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  
  const stmt = db.prepare(`
    UPDATE ${table}
    SET ${setClause}, updated_at = datetime('now')
    WHERE id = ?
  `);
  
  stmt.run(...values, id);
  return getById(table, id);
}

function deleteById(table, id) {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
  return stmt.run(id);
}

function getAll(table, orderBy = 'id', orderDir = 'ASC') {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy} ${orderDir}`);
  return stmt.all();
}

function getById(table, id) {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
  return stmt.get(id);
}

function getFiltered(table, filters = {}, orderBy = 'sort_order', orderDir = 'ASC') {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.status === 'active') {
    conditions.push('completed = 0');
  } else if (filters.status === 'completed') {
    conditions.push('completed = 1');
  }

  if (filters.priority && filters.priority !== 'all') {
    conditions.push('priority = ?');
    params.push(filters.priority);
  }

  if (filters.category_id !== undefined && filters.category_id !== null && filters.category_id !== 'all') {
    conditions.push('category_id = ?');
    params.push(filters.category_id);
  }

  if (filters.date_range === 'today') {
    conditions.push('due_date = date("now", "localtime")');
  } else if (filters.date_range === 'upcoming') {
    conditions.push('due_date > date("now", "localtime")');
  } else if (filters.date_range === 'overdue') {
    conditions.push('due_date < date("now", "localtime") AND due_date IS NOT NULL AND completed = 0');
  } else if (filters.date_range === 'this_week') {
    conditions.push('due_date BETWEEN date("now", "localtime", "weekday 0", "-6 days") AND date("now", "localtime", "weekday 0")');
  }

  if (filters.search && filters.search.trim()) {
    conditions.push('(title LIKE ? OR description LIKE ?)');
    const searchTerm = `%${filters.search.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const stmt = db.prepare(`SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} ${orderDir}`);
  
  return stmt.all(...params);
}

function toggleTaskComplete(id, completed) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE tasks
    SET completed = ?, completed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(completed ? 1 : 0, completed ? 1 : 0, id);
  return getById('tasks', id);
}

function reorderTasks(updates) {
  const db = getDb();
  const updateStmt = db.prepare('UPDATE tasks SET sort_order = ?, updated_at = datetime("now") WHERE id = ?');
  
  const reorder = db.transaction((items) => {
    for (const item of items) {
      updateStmt.run(item.sort_order, item.id);
    }
  });
  
  reorder(updates);
  return true;
}

function getCategoryBreakdown() {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT 
      c.id, c.name, c.color, c.is_default,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.completed = 0 THEN 1 ELSE 0 END) as incomplete_tasks
    FROM categories c
    LEFT JOIN tasks t ON c.id = t.category_id
    GROUP BY c.id
    ORDER BY c.sort_order
  `);
  return stmt.all();
}

export default {
  getDb,
  initSchema,
  create,
  update,
  deleteById,
  getAll,
  getById,
  getFiltered,
  getTasksFiltered: (filters) => getFiltered('tasks', filters),
  toggleTaskComplete,
  reorderTasks,
  getCategoryBreakdown
};