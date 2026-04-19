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

const db = new Database(DB_PATH, { readonly: false });
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Check if data already exists
const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
if (taskCount.count > 0) {
  console.log('Data already seeded, skipping...');
  db.close();
  process.exit(0);
}

// Ensure categories table has default data
const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (catCount.count === 0) {
  const insertCategory = db.prepare(`
    INSERT INTO categories (name, color, is_default, sort_order)
    VALUES (?, ?, ?, ?)
  `);
  
  const seedDefaults = db.transaction(() => {
    insertCategory.run('Work', '#3B82F6', 1, 0);
    insertCategory.run('Personal', '#8B5CF6', 1, 1);
    insertCategory.run('Health', '#10B981', 1, 2);
    insertCategory.run('Learning', '#F59E0B', 1, 3);
  });
  seedDefaults();
}

// Add additional categories
const insertCategory = db.prepare(`
  INSERT OR IGNORE INTO categories (name, color, is_default, sort_order)
  VALUES (?, ?, ?, ?)
`);

const addCategories = db.transaction(() => {
  insertCategory.run('Finance', '#EF4444', 0, 4);
  insertCategory.run('Home', '#6366F1', 0, 5);
  insertCategory.run('Side Project', '#EC4899', 0, 6);
});

addCategories();

// Get category IDs for task references
const categories = db.prepare('SELECT id, name FROM categories').all();
const catMap = {};
categories.forEach(c => catMap[c.name] = c.id);

// Date helpers
function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
}

function daysFromNow(n) {
  return new Date(Date.now() + n * 86400000).toISOString().split('T')[0];
}

function timestampDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().replace('T', ' ').substring(0, 19);
}

// Task data
const tasks = [
  // Overdue tasks
  {
    title: 'Prepare Q4 budget presentation',
    description: 'Finalize revenue projections and expense forecasts for the board meeting. Include comparison with Q3 actuals and variance analysis.',
    priority: 'high',
    due_date: daysAgo(3),
    category_id: catMap['Work'],
    completed: 0,
    completed_at: null,
    sort_order: 1,
    created_at: timestampDaysAgo(8),
    updated_at: timestampDaysAgo(2)
  },
  {
    title: 'Review authentication module PR',
    description: 'Check the OAuth2 implementation for security best practices. Verify token refresh logic and session management.',
    priority: 'medium',
    due_date: daysAgo(1),
    category_id: catMap['Work'],
    completed: 0,
    completed_at: null,
    sort_order: 2,
    created_at: timestampDaysAgo(5),
    updated_at: timestampDaysAgo(1)
  },
  {
    title: 'Submit expense report',
    description: 'Compile all receipts from the Chicago conference. Submit through Concur system with proper coding.',
    priority: 'medium',
    due_date: daysAgo(5),
    category_id: catMap['Finance'],
    completed: 0,
    completed_at: null,
    sort_order: 3,
    created_at: timestampDaysAgo(10),
    updated_at: timestampDaysAgo(4)
  },
  {
    title: 'Fix CSS layout issues on mobile',
    description: 'The dashboard cards are overflowing on screens smaller than 375px. Test on iOS Safari and Chrome Android.',
    priority: 'high',
    due_date: daysAgo(2),
    category_id: catMap['Side Project'],
    completed: 0,
    completed_at: null,
    sort_order: 4,
    created_at: timestampDaysAgo(6),
    updated_at: timestampDaysAgo(3)
  },
  
  // Today's tasks
  {
    title: 'Team standup meeting notes',
    description: 'Document action items from today\'s standup. Follow up with design team on updated wireframes for the dashboard.',
    priority: 'medium',
    due_date: daysAgo(0),
    category_id: catMap['Work'],
    completed: 0,
    completed_at: null,
    sort_order: 5,
    created_at: timestampDaysAgo(1),
    updated_at: timestampDaysAgo(0)
  },
  {
    title: 'Schedule dentist appointment',
    description: 'Call Dr. Martinez\'s office for a routine cleaning. Prefer Tuesday or Thursday after 3pm.',
    priority: 'low',
    due_date: daysAgo(0),
    category_id: catMap['Health'],
    completed: 0,
    completed_at: null,
    sort_order: 6,
    created_at: timestampDaysAgo(3),
    updated_at: timestampDaysAgo(0)
  },
  {
    title: 'Pay electricity bill',
    description: 'Due amount is $142.50. Set up autopay to avoid late fees in the future.',
    priority: 'high',
    due_date: daysAgo(0),
    category_id: catMap['Finance'],
    completed: 0,
    completed_at: null,
    sort_order: 7,
    created_at: timestampDaysAgo(4),
    updated_at: timestampDaysAgo(1)
  },
  {
    title: 'Review project Phoenix launch plan',
    description: 'Go through the deployment checklist with the team. Ensure all rollback procedures are documented.',
    priority: 'high',
    due_date: daysAgo(0),
    category_id: catMap['Work'],
    completed: 0,
    completed_at: null,
    sort_order: 8,
    created_at: timestampDaysAgo(3),
    updated_at: timestampDaysAgo(0)
  },
  
  // Upcoming tasks (next 7 days)
  {
    title: 'Update API documentation',
    description: 'Add new endpoints for user preferences and notification settings. Include request/response examples and error codes.',
    priority: 'medium',
    due_date: daysFromNow(2),
    category_id: catMap['Work'],
    completed: 0,
    completed_at: null,
    sort_order: 9,
    created_at: timestampDaysAgo(4),
    updated_at: timestampDaysAgo(1)
  },
  {
    title: 'Meal prep for the week',
    description: 'Prepare lunches for Mon-Fri: chicken stir-fry, quinoa bowls, and Mediterranean wraps. Buy groceries Sunday evening.',
    priority: 'medium',
    due_date: daysFromNow(1),
    category_id: catMap['Health'],
    completed: 0,
    completed_at: null,
    sort_order: 10,
    created_at: timestampDaysAgo(2),
    updated_at: timestampDaysAgo(0)
  },
  {
    title: 'Schedule annual physical exam',
    description: 'Book appointment with Dr. Chen for comprehensive checkup. Bring lab results from last visit and list of current medications.',
    priority: 'high',
    due_date: daysFromNow(3),
    category_id: catMap['Health'],
    completed: 0,
    completed_at: null,
    sort_order: 11,
    created_at: timestampDaysAgo(5),
    updated_at: timestampDaysAgo(1)
  },
  {
    title: 'Client presentation rehearsal',
    description: 'Practice the product demo flow with Sarah. Ensure staging environment is stable and all demo data is fresh.',
    priority: 'high',
    due_date: daysFromNow(3),
    category_id: catMap['Work'],
    completed: 0,
    completed_at: null,
    sort_order: 12,
    created_at: timestampDaysAgo(2),
    updated_at: timestampDaysAgo(0)
  },
  {
    title: 'Complete React hooks tutorial',
    description: 'Finish sections on useEffect cleanup and custom hooks. Build the practice project for portfolio.',
    priority: 'low',
    due_date: daysFromNow(4),
    category_id: catMap['Learning'],
    completed: 0,
    completed_at: null,
    sort_order: 13,
    created_at: timestampDaysAgo(7),
    updated_at: timestampDaysAgo(1)
  },
  {
    title: 'Organize home office desk',
    description: 'Sort through papers, organize cables with ties, and set up the new monitor arm. Take before/after photos.',
    priority: 'low',
    due_date: daysFromNow(5),
    category_id: catMap['Home'],
    completed: 0,
    completed_at: null,
    sort_order: 14,
    created_at: timestampDaysAgo(6),
    updated_at: timestampDaysAgo(2)
  },
  {
    title: 'Complete TypeScript fundamentals course',
    description: 'Finish modules on generics, utility types, and conditional types. Complete all coding exercises in the sandbox.',
    priority: 'medium',
    due_date: daysFromNow(6),
    category_id: catMap['Learning'],
    completed: 0,
    completed_at: null,
    sort_order: 15,
    created_at: timestampDaysAgo(12),
    updated_at: timestampDaysAgo(1)
  },
  {
    title: 'Research summer vacation destinations',
    description: 'Compare flights and accommodations for Portugal vs. Greece. Budget around $3000 for two weeks in July.',
    priority: 'low',
    due_date: daysFromNow(7),
    category_id: catMap['Personal'],
    completed: 0,
    completed_at: null,
    sort_order: 16,
    created_at: timestampDaysAgo(8),
    updated_at: timestampDaysAgo(3)
  },
  {
    title: 'Deploy portfolio website v2',
    description: 'Push the redesigned portfolio to production. Update DNS records and verify SSL certificate renewal.',
    priority: 'medium',
    due_date: daysFromNow(5),
    category_id: catMap['Side Project'],
    completed: 0,
    completed_at: null,
    sort_order: 17,
    created_at: timestampDaysAgo(9),
    updated_at: timestampDaysAgo(2)
  },
  {
    title: 'Fix leaky bathroom faucet',
    description: 'Watch tutorial video first. Might just need a new washer. Hardware store run if parts are needed.',
    priority: 'medium',
    due_date: daysFromNow(4),
    category_id: catMap['Home'],
    completed: 0,
    completed_at: null,
    sort_order: 18,
    created_at: timestampDaysAgo(7),
    updated_at: timestampDaysAgo(1)
  },
  
  // Tasks with no due date
  {
    title: 'Renew passport application',
    description: 'Check expiration date - might need renewal before summer trip. Gather required documents and photos.',
    priority: 'low',
    due_date: null,
    category_id: catMap['Personal'],
    completed: 0,
    completed_at: null,
    sort_order: 19,
    created_at: timestampDaysAgo(10),
    updated_at: timestampDaysAgo(5)
  },
  {
    title: 'Read "Atomic Habits" by James Clear',
    description: 'Started chapter 3. Take notes on habit stacking and implementation intentions strategies.',
    priority: 'low',
    due_date: null,
    category_id: catMap['Learning'],
    completed: 0,
    completed_at: null,
    sort_order: 20,
    created_at: timestampDaysAgo(14),
    updated_at: timestampDaysAgo(4)
  },
  {
    title: 'Set up automated savings transfer',
    description: 'Configure bi-weekly transfer of $250 to high-yield savings account. Align with pay schedule.',
    priority: 'medium',
    due_date: null,
    category_id: catMap['Finance'],
    completed: 0,
    completed_at: null,
    sort_order: 21,
    created_at: timestampDaysAgo(8),
    updated_at: timestampDaysAgo(3)
  },
  
  // Completed tasks
  {
    title: 'Set up CI/CD pipeline',
    description: 'Configure GitHub Actions for automated testing and deployment to staging environment.',
    priority: 'high',
    due_date: daysAgo(2),
    category_id: catMap['Work'],
    completed: 1,
    completed_at: timestampDaysAgo(1),
    sort_order: 22,
    created_at: timestampDaysAgo(10),
    updated_at: timestampDaysAgo(1)
  },
  {
    title: '30-minute morning run',
    description: 'Completed 5K route through the park. Personal best time of 26:45!',
    priority: 'low',
    due_date: daysAgo(1),
    category_id: catMap['Health'],
    completed: 1,
    completed_at: timestampDaysAgo(0),
    sort_order: 23,
    created_at: timestampDaysAgo(2),
    updated_at: timestampDaysAgo(0)
  },
  {
    title: 'Read chapter 5 of Designing Data-Intensive Applications',
    description: 'Covered replication and partitioning concepts. Took detailed notes for the book club discussion on Thursday.',
    priority: 'medium',
    due_date: daysAgo(4),
    category_id: catMap['Learning'],
    completed: 1,
    completed_at: timestampDaysAgo(2),
    sort_order: 24,
    created_at: timestampDaysAgo(12),
    updated_at: timestampDaysAgo(2)
  },
  {
    title: 'Update LinkedIn profile',
    description: 'Added new role description, updated skills section, and requested recommendations from 3 colleagues.',
    priority: 'low',
    due_date: daysAgo(6),
    category_id: catMap['Personal'],
    completed: 1,
    completed_at: timestampDaysAgo(4),
    sort_order: 25,
    created_at: timestampDaysAgo(14),
    updated_at: timestampDaysAgo(4)
  },
  {
    title: 'Complete quarterly tax estimates',
    description: 'Calculated Q4 estimated payments for both federal and state. Scheduled payments for January 15th deadline.',
    priority: 'high',
    due_date: daysAgo(7),
    category_id: catMap['Finance'],
    completed: 1,
    completed_at: timestampDaysAgo(5),
    sort_order: 26,
    created_at: timestampDaysAgo(15),
    updated_at: timestampDaysAgo(5)
  },
  {
    title: 'Clean out garage',
    description: 'Donated old furniture to Goodwill. Organized tools on pegboard. Swept and mopped the floor.',
    priority: 'medium',
    due_date: daysAgo(3),
    category_id: catMap['Home'],
    completed: 1,
    completed_at: timestampDaysAgo(2),
    sort_order: 27,
    created_at: timestampDaysAgo(8),
    updated_at: timestampDaysAgo(2)
  },
  {
    title: 'Refactor user authentication module',
    description: 'Migrated from session-based auth to JWT tokens. Updated all protected routes and middleware.',
    priority: 'high',
    due_date: daysAgo(4),
    category_id: catMap['Side Project'],
    completed: 1,
    completed_at: timestampDaysAgo(3),
    sort_order: 28,
    created_at: timestampDaysAgo(11),
    updated_at: timestampDaysAgo(3)
  },
  {
    title: 'Complete Kubernetes basics course',
    description: 'Finished all modules on pods, services, and deployments. Earned the certificate of completion.',
    priority: 'medium',
    due_date: daysAgo(5),
    category_id: catMap['Learning'],
    completed: 1,
    completed_at: timestampDaysAgo(3),
    sort_order: 29,
    created_at: timestampDaysAgo(20),
    updated_at: timestampDaysAgo(3)
  }
];

// Insert all tasks
const insertTask = db.prepare(`
  INSERT INTO tasks (title, description, priority, due_date, category_id, completed, completed_at, sort_order, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAll = db.transaction(() => {
  for (const task of tasks) {
    insertTask.run(
      task.title,
      task.description,
      task.priority,
      task.due_date,
      task.category_id,
      task.completed,
      task.completed_at,
      task.sort_order,
      task.created_at,
      task.updated_at
    );
  }
});

insertAll();

// Summary
const finalTaskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
const finalCatCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
const completedCount = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE completed = 1').get().count;
const overdueCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE due_date < date('now', 'localtime') AND completed = 0 AND due_date IS NOT NULL").get().count;

console.log('✓ TaskFlow database seeded successfully!');
console.log(`  Categories: ${finalCatCount} (4 default + 3 custom)`);
console.log(`  Tasks: ${finalTaskCount} total`);
console.log(`    - Completed: ${completedCount}`);
console.log(`    - Overdue: ${overdueCount}`);
console.log(`    - Active: ${finalTaskCount - completedCount}`);
console.log('');
console.log('The app now has realistic sample data with:');
console.log('  • Overdue tasks that need attention');
console.log('  • Tasks due today');
console.log('  • Upcoming tasks spread across the next week');
console.log('  • Recently completed tasks for progress tracking');
console.log('  • Tasks across all priority levels and categories');

db.close();