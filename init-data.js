import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'app.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Check if data already exists
const count = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
if (count.count > 0) {
  console.log('Data already seeded, skipping...');
  db.close();
  process.exit(0);
}

// Date helpers
const daysAgo = (days) => {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().replace('T', ' ').substring(0, 19);
};

const daysFromNow = (days) => {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().replace('T', ' ').substring(0, 19);
};

const todayStr = () => {
  return new Date().toISOString().split('T')[0];
};

const dateOnly = (daysOffset) => {
  const d = new Date(Date.now() + daysOffset * 86400000);
  return d.toISOString().split('T')[0];
};

// Additional categories beyond the 4 defaults (Work, Personal, Health, Learning)
const additionalCategories = [
  { name: 'Finance', color: '#EC4899', is_default: 0, sort_order: 5, created_at: daysAgo(25), updated_at: daysAgo(25) },
  { name: 'Home', color: '#6366F1', is_default: 0, sort_order: 6, created_at: daysAgo(25), updated_at: daysAgo(25) },
  { name: 'Social', color: '#14B8A6', is_default: 0, sort_order: 7, created_at: daysAgo(20), updated_at: daysAgo(20) },
  { name: 'Shopping', color: '#F43F5E', is_default: 0, sort_order: 8, created_at: daysAgo(15), updated_at: daysAgo(15) }
];

// Tasks - category IDs: 1=Work, 2=Personal, 3=Health, 4=Learning, 5=Finance, 6=Home, 7=Social, 8=Shopping
const tasks = [
  // Work tasks
  {
    title: 'Finalize Q4 marketing budget proposal',
    description: 'Review all department requests, consolidate spreadsheet, and prepare presentation for Friday board meeting',
    priority: 'high',
    due_date: dateOnly(1),
    category_id: 1,
    completed: 0,
    completed_at: null,
    sort_order: 1,
    created_at: daysAgo(12),
    updated_at: daysAgo(2)
  },
  {
    title: 'Update API documentation for v2.0',
    description: 'Revise endpoints documentation, add new authentication flows, and deprecation notices for legacy routes',
    priority: 'medium',
    due_date: dateOnly(4),
    category_id: 1,
    completed: 0,
    completed_at: null,
    sort_order: 2,
    created_at: daysAgo(8),
    updated_at: daysAgo(1)
  },
  {
    title: 'Prepare client presentation slides',
    description: 'Create 20-slide deck for Acme Corp quarterly review with updated metrics, projections, and action items',
    priority: 'high',
    due_date: todayStr(),
    category_id: 1,
    completed: 0,
    completed_at: null,
    sort_order: 3,
    created_at: daysAgo(5),
    updated_at: daysAgo(1)
  },
  {
    title: 'Code review authentication module PR',
    description: 'Review pull request #247 implementing OAuth2, JWT refresh tokens, and session management improvements',
    priority: 'medium',
    due_date: dateOnly(-2),
    category_id: 1,
    completed: 1,
    completed_at: daysAgo(2),
    sort_order: 4,
    created_at: daysAgo(7),
    updated_at: daysAgo(2)
  },
  {
    title: 'Set up CI/CD pipeline for staging',
    description: 'Configure GitHub Actions workflow for automated testing, build, and deployment to staging environment',
    priority: 'medium',
    due_date: dateOnly(6),
    category_id: 1,
    completed: 0,
    completed_at: null,
    sort_order: 5,
    created_at: daysAgo(10),
    updated_at: daysAgo(3)
  },
  {
    title: 'Weekly team standup preparation',
    description: 'Compile status updates, blockers list, and priority items for Monday morning standup meeting',
    priority: 'low',
    due_date: todayStr(),
    category_id: 1,
    completed: 0,
    completed_at: null,
    sort_order: 6,
    created_at: daysAgo(1),
    updated_at: daysAgo(1)
  },
  {
    title: 'Database migration for user profiles',
    description: 'Write and test migration script to add new profile fields: bio, location, social links',
    priority: 'high',
    due_date: dateOnly(-1),
    category_id: 1,
    completed: 0,
    completed_at: null,
    sort_order: 7,
    created_at: daysAgo(6),
    updated_at: daysAgo(2)
  },
  {
    title: 'Conduct user interviews for feature research',
    description: 'Schedule and complete 5 user interviews focusing on dashboard customization needs',
    priority: 'medium',
    due_date: dateOnly(-5),
    category_id: 1,
    completed: 1,
    completed_at: daysAgo(5),
    sort_order: 8,
    created_at: daysAgo(15),
    updated_at: daysAgo(5)
  },

  // Personal tasks
  {
    title: 'Renew car insurance policy',
    description: 'Compare quotes from Progressive, Geico, and State Farm before current policy expires next week',
    priority: 'high',
    due_date: dateOnly(-1),
    category_id: 2,
    completed: 0,
    completed_at: null,
    sort_order: 1,
    created_at: daysAgo(14),
    updated_at: daysAgo(3)
  },
  {
    title: 'Book dentist appointment',
    description: 'Schedule routine cleaning and checkup with Dr. Martinez - morning slot preferred',
    priority: 'medium',
    due_date: dateOnly(7),
    category_id: 2,
    completed: 0,
    completed_at: null,
    sort_order: 2,
    created_at: daysAgo(6),
    updated_at: daysAgo(6)
  },
  {
    title: 'Organize home office space',
    description: 'Sort through paperwork, organize cable management, and install new dual monitor arm',
    priority: 'low',
    due_date: dateOnly(10),
    category_id: 2,
    completed: 0,
    completed_at: null,
    sort_order: 3,
    created_at: daysAgo(9),
    updated_at: daysAgo(4)
  },
  {
    title: 'Return online shopping package',
    description: 'Drop off return at Whole Foods before return window closes on Friday',
    priority: 'medium',
    due_date: dateOnly(2),
    category_id: 2,
    completed: 0,
    completed_at: null,
    sort_order: 4,
    created_at: daysAgo(3),
    updated_at: daysAgo(3)
  },
  {
    title: 'Plan weekend trip to Asheville',
    description: 'Research cabin rentals, book accommodation, create packing list, and plan hiking trails',
    priority: 'low',
    due_date: dateOnly(12),
    category_id: 2,
    completed: 1,
    completed_at: daysAgo(2),
    sort_order: 5,
    created_at: daysAgo(18),
    updated_at: daysAgo(2)
  },
  {
    title: 'Update passport application',
    description: 'Gather required documents, fill out renewal form, and schedule photo appointment at CVS',
    priority: 'high',
    due_date: dateOnly(-3),
    category_id: 2,
    completed: 0,
    completed_at: null,
    sort_order: 6,
    created_at: daysAgo(20),
    updated_at: daysAgo(8)
  },

  // Health tasks
  {
    title: 'Complete 5K training run',
    description: 'Week 6 of Couch to 5K program - 25 minute continuous jog at moderate pace',
    priority: 'medium',
    due_date: todayStr(),
    category_id: 3,
    completed: 0,
    completed_at: null,
    sort_order: 1,
    created_at: daysAgo(4),
    updated_at: daysAgo(1)
  },
  {
    title: 'Meal prep for the work week',
    description: 'Prepare grilled chicken, quinoa bowls, roasted vegetables, and overnight oats for breakfast',
    priority: 'medium',
    due_date: dateOnly(-4),
    category_id: 3,
    completed: 1,
    completed_at: daysAgo(4),
    sort_order: 2,
    created_at: daysAgo(7),
    updated_at: daysAgo(4)
  },
  {
    title: 'Schedule annual physical exam',
    description: 'Call Dr. Thompson office to schedule appointment - need fasting blood work panel',
    priority: 'high',
    due_date: dateOnly(14),
    category_id: 3,
    completed: 0,
    completed_at: null,
    sort_order: 3,
    created_at: daysAgo(3),
    updated_at: daysAgo(3)
  },
  {
    title: 'Refill prescription medications',
    description: 'Call pharmacy to refill lisinopril 10mg and vitamin D3 supplements before running out',
    priority: 'high',
    due_date: dateOnly(-6),
    category_id: 3,
    completed: 0,
    completed_at: null,
    sort_order: 4,
    created_at: daysAgo(15),
    updated_at: daysAgo(7)
  },
  {
    title: 'Evening yoga and meditation',
    description: 'Follow 30-minute restorative yoga video, then 10-minute guided meditation for better sleep',
    priority: 'low',
    due_date: todayStr(),
    category_id: 3,
    completed: 0,
    completed_at: null,
    sort_order: 5,
    created_at: daysAgo(2),
    updated_at: daysAgo(1)
  },
  {
    title: 'Track daily water intake',
    description: 'Aim for 8 glasses minimum - use water tracking app and set hourly reminders',
    priority: 'low',
    due_date: dateOnly(0),
    category_id: 3,
    completed: 0,
    completed_at: null,
    sort_order: 6,
    created_at: daysAgo(1),
    updated_at: daysAgo(1)
  },

  // Learning tasks
  {
    title: 'Complete React Hooks advanced tutorial',
    description: 'Finish modules 5-8 covering custom hooks, context patterns, and performance optimization',
    priority: 'medium',
    due_date: dateOnly(5),
    category_id: 4,
    completed: 0,
    completed_at: null,
    sort_order: 1,
    created_at: daysAgo(10),
    updated_at: daysAgo(3)
  },
  {
    title: 'Read "Designing Data-Intensive Applications"',
    description: 'Complete chapters 7-9 on transactions, distributed consistency, and consensus algorithms',
    priority: 'low',
    due_date: dateOnly(15),
    category_id: 4,
    completed: 0,
    completed_at: null,
    sort_order: 2,
    created_at: daysAgo(20),
    updated_at: daysAgo(5)
  },
  {
    title: 'Practice SQL joins and subqueries',
    description: 'Complete 10 exercises on LeetCode database section focusing on complex multi-table joins',
    priority: 'medium',
    due_date: dateOnly(-3),
    category_id: 4,
    completed: 1,
    completed_at: daysAgo(3),
    sort_order: 3,
    created_at: daysAgo(12),
    updated_at: daysAgo(3)
  },
  {
    title: 'Watch microservices architecture talk',
    description: 'Watch KubeCon 2024 keynote on service mesh patterns, observability, and best practices',
    priority: 'low',
    due_date: dateOnly(8),
    category_id: 4,
    completed: 0,
    completed_at: null,
    sort_order: 4,
    created_at: daysAgo(7),
    updated_at: daysAgo(5)
  },
  {
    title: 'Update portfolio website with new projects',
    description: 'Add recent case studies, refresh hero section, and update testimonials from clients',
    priority: 'medium',
    due_date: dateOnly(9),
    category_id: 4,
    completed: 0,
    completed_at: null,
    sort_order: 5,
    created_at: daysAgo(14),
    updated_at: daysAgo(6)
  },
  {
    title: 'Complete TypeScript generics exercises',
    description: 'Work through advanced type challenges on type-challenges.org focusing on conditional types',
    priority: 'medium',
    due_date: dateOnly(-7),
    category_id: 4,
    completed: 1,
    completed_at: daysAgo(7),
    sort_order: 6,
    created_at: daysAgo(16),
    updated_at: daysAgo(7)
  },

  // Finance tasks
  {
    title: 'Review and adjust monthly budget',
    description: 'Analyze spending patterns in Mint, identify areas to cut back, and allocate savings goals',
    priority: 'medium',
    due_date: dateOnly(3),
    category_id: 5,
    completed: 0,
    completed_at: null,
    sort_order: 1,
    created_at: daysAgo(5),
    updated_at: daysAgo(2)
  },
  {
    title: 'File quarterly estimated taxes',
    description: 'Calculate Q3 earnings, complete Form 1040-ES, and submit payment before deadline',
    priority: 'high',
    due_date: dateOnly(-8),
    category_id: 5,
    completed: 1,
    completed_at: daysAgo(8),
    sort_order: 2,
    created_at: daysAgo(25),
    updated_at: daysAgo(8)
  },
  {
    title: 'Research investment portfolio rebalancing',
    description: 'Review current allocation, read up on market conditions, and plan adjustments for Q4',
    priority: 'low',
    due_date: dateOnly(11),
    category_id: 5,
    completed: 0,
    completed_at: null,
    sort_order: 3,
    created_at: daysAgo(8),
    updated_at: daysAgo(4)
  },
  {
    title: 'Set up automatic bill payments',
    description: 'Configure auto-pay for utilities, internet, and streaming services to avoid late fees',
    priority: 'medium',
    due_date: dateOnly(-2),
    category_id: 5,
    completed: 0,
    completed_at: null,
    sort_order: 4,
    created_at: daysAgo(11),
    updated_at: daysAgo(5)
  },

  // Home tasks
  {
    title: 'Fix leaky kitchen faucet',
    description: 'Replace worn washer and O-ring in Delta faucet - watch YouTube tutorial first',
    priority: 'high',
    due_date: dateOnly(2),
    category_id: 6,
    completed: 0,
    completed_at: null,
    sort_order: 1,
    created_at: daysAgo(9),
    updated_at: daysAgo(4)
  },
  {
    title: 'Deep clean master bathroom',
    description: 'Scrub tiles, clean grout lines, organize medicine cabinet, replace shower curtain liner',
    priority: 'low',
    due_date: dateOnly(6),
    category_id: 6,
    completed: 0,
    completed_at: null,
    sort_order: 2,
    created_at: daysAgo(6),
    updated_at: daysAgo(6)
  },
  {
    title: 'Organize garage storage',
    description: 'Install shelving unit, sort seasonal items into labeled bins, donate unused equipment',
    priority: 'medium',
    due_date: dateOnly(13),
    category_id: 6,
    completed: 0,
    completed_at: null,
    sort_order: 3,
    created_at: daysAgo(11),
    updated_at: daysAgo(7)
  },
  {
    title: 'Replace HVAC air filter',
    description: 'Buy MERV 11 filter size 20x25x1 and replace - last changed 3 months ago',
    priority: 'medium',
    due_date: dateOnly(-4),
    category_id: 6,
    completed: 1,
    completed_at: daysAgo(4),
    sort_order: 4,
    created_at: daysAgo(18),
    updated_at: daysAgo(4)
  },

  // Social tasks
  {
    title: 'RSVP to Sarah and Tom wedding',
    description: 'Send confirmation for June 15th ceremony, select meal preference (chicken/fish/vegetarian)',
    priority: 'high',
    due_date: dateOnly(-2),
    category_id: 7,
    completed: 0,
    completed_at: null,
    sort_order: 1,
    created_at: daysAgo(20),
    updated_at: daysAgo(8)
  },
  {
    title: 'Plan game night with friends',
    description: 'Coordinate Saturday date, prepare appetizers, choose 3-4 board games, set up living room',
    priority: 'low',
    due_date: dateOnly(4),
    category_id: 7,
    completed: 0,
    completed_at: null,
    sort_order: 2,
    created_at: daysAgo(5),
    updated_at: daysAgo(2)
  },
  {
    title: 'Send birthday card to Mom',
    description: 'Buy Hallmark card, write personal message, and mail by Tuesday to arrive on time',
    priority: 'high',
    due_date: dateOnly(1),
    category_id: 7,
    completed: 0,
    completed_at: null,
    sort_order: 3,
    created_at: daysAgo(3),
    updated_at: daysAgo(3)
  },
  {
    title: 'Volunteer at community food bank',
    description: 'Saturday morning shift 9am-12pm sorting donations and packing food boxes',
    priority: 'medium',
    due_date: dateOnly(-10),
    category_id: 7,
    completed: 1,
    completed_at: daysAgo(10),
    sort_order: 4,
    created_at: daysAgo(22),
    updated_at: daysAgo(10)
  },

  // Shopping tasks
  {
    title: 'Buy birthday gift for Dad',
    description: 'Looking for new fishing rod or tackle box - check Amazon, Bass Pro Shop, and local store',
    priority: 'medium',
    due_date: dateOnly(3),
    category_id: 8,
    completed: 0,
    completed_at: null,
    sort_order: 1,
    created_at: daysAgo(4),
    updated_at: daysAgo(2)
  },
  {
    title: 'Order new running shoes',
    description: 'Research Nike Pegasus vs Brooks Ghost, find best price, order in size 10.5',
    priority: 'low',
    due_date: dateOnly(7),
    category_id: 8,
    completed: 0,
    completed_at: null,
    sort_order: 2,
    created_at: daysAgo(6),
    updated_at: daysAgo(4)
  },
  {
    title: 'Grocery shopping for the week',
    description: 'Buy vegetables, proteins, snacks, and ingredients for meal prep recipes',
    priority: 'medium',
    due_date: dateOnly(0),
    category_id: 8,
    completed: 0,
    completed_at: null,
    sort_order: 3,
    created_at: daysAgo(1),
    updated_at: daysAgo(1)
  }
];

const insertAll = db.transaction(() => {
  // Insert additional categories
  const catStmt = db.prepare(`
    INSERT INTO categories (name, color, is_default, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const cat of additionalCategories) {
    catStmt.run(cat.name, cat.color, cat.is_default, cat.sort_order, cat.created_at, cat.updated_at);
  }

  // Insert tasks
  const taskStmt = db.prepare(`
    INSERT INTO tasks (title, description, priority, due_date, category_id, completed, completed_at, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const task of tasks) {
    taskStmt.run(
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

// Count records for summary
const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
const completedCount = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE completed = 1').get().count;
const overdueCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE completed = 0 AND due_date < date('now') AND due_date IS NOT NULL").get().count;
const todayCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE completed = 0 AND due_date = date('now')").get().count;

console.log('✓ TaskFlow database seeded successfully!');
console.log(`  - ${categoryCount} categories (${additionalCategories.length} custom + 4 default)`);
console.log(`  - ${taskCount} tasks (${completedCount} completed)`);
console.log(`  - ${overdueCount} overdue tasks, ${todayCount} due today`);
console.log('');
console.log('TaskFlow is ready to use!');

db.close();