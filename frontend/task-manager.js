/**
 * TaskFlow — Task Manager Module
 * Handles task CRUD operations, rendering, animations, and undo functionality.
 */

(function () {
  "use strict";

  const API_BASE = "/api";
  const PRIORITY_COLORS = {
    high: { bg: "bg-red-500", text: "text-red-500", border: "border-red-400", badge: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" },
    medium: { bg: "bg-amber-500", text: "text-amber-500", border: "border-amber-400", badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" },
    low: { bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-400", badge: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" }
  };

  let deletedTask = null;
  let undoTimeout = null;

  const state = {
    tasks: [],
    categories: [],
    filters: { category_id: null, status: "all", priority: null, search: "" },
    loading: false
  };

  function apiFetch(endpoint, options = {}) {
    const config = { headers: { "Content-Type": "application/json" }, ...options };
    if (config.body && typeof config.body === "object") config.body = JSON.stringify(config.body);
    return fetch(`${API_BASE}${endpoint}`, config).then(async r => {
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
      return d;
    });
  }

  function isOverdue(dueDate) {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dueDate + "T00:00:00") < today;
  }

  function isToday(dueDate) {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dueDate + "T00:00:00");
    return d.getTime() === today.getTime();
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function animateConfetti(element) {
    const rect = element.getBoundingClientRect();
    const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
    for (let i = 0; i < 12; i++) {
      const p = document.createElement("span");
      p.className = "absolute w-2 h-2 rounded-full pointer-events-none";
      const angle = (Math.PI * 2 * i) / 12;
      const dist = 40 + Math.random() * 30;
      p.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top}px;background:${colors[i % 5]};--tx:${Math.cos(angle) * dist}px;--ty:${Math.sin(angle) * dist}px;animation:confettiBurst 0.6s ease-out forwards;`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }
  }

  function showConfettiStyles() {
    if (!document.getElementById("confettiStyles")) {
      const s = document.createElement("style");
      s.id = "confettiStyles";
      s.textContent = `@keyframes confettiBurst{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0}}`;
      document.head.appendChild(s);
    }
  }

  function showToast(message, onUndo) {
    const existing = document.querySelector(".toast-notification");
    if (existing) existing.remove();
    const t = document.createElement("div");
    t.className = "toast-notification fixed bottom-4 right-4 bg-slate-800 dark:bg-slate-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-in-right";
    t.innerHTML = `<span>${message}</span>${onUndo ? '<button class="underline font-medium text-blue-400 hover:text-blue-300">Undo</button>' : ""}`;
    document.body.appendChild(t);
    if (onUndo) t.querySelector("button").addEventListener("click", onUndo);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 5000);
  }

  async function fetchTasks() {
    state.loading = true;
    renderTasks();
    try {
      const params = new URLSearchParams();
      Object.entries(state.filters).forEach(([k, v]) => { if (v && v !== "all") params.set(k, v); });
      const res = await apiFetch(`/tasks${params.toString() ? "?" + params : ""}`);
      state.tasks = res.data;
      state.loading = false;
      renderTasks();
    } catch (err) {
      state.loading = false;
      state.error = err.message;
      renderTasks();
    }
  }

  async function createTask(taskData) {
    try {
      const res = await apiFetch("/tasks", { method: "POST", body: taskData });
      state.tasks.unshift(res.data);
      renderTasks();
      showToast("Task created");
      return res.data;
    } catch (err) {
      showToast("Error: " + err.message);
      throw err;
    }
  }

  async function updateTask(id, updates) {
    try {
      const res = await apiFetch(`/tasks/${id}`, { method: "PUT", body: updates });
      const idx = state.tasks.findIndex(t => t.id === id);
      if (idx !== -1) state.tasks[idx] = { ...state.tasks[idx], ...res.data };
      renderTasks();
    } catch (err) {
      showToast("Error: " + err.message);
      throw err;
    }
  }

  async function deleteTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    deletedTask = { ...task };
    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => { deletedTask = null; }, 5000);
    try {
      await apiFetch(`/tasks/${id}`, { method: "DELETE" });
      state.tasks = state.tasks.filter(t => t.id !== id);
      const card = document.querySelector(`[data-task-id="${id}"]`);
      if (card) {
        card.style.transition = "all 0.3s ease-out";
        card.style.opacity = "0";
        card.style.transform = "translateX(20px)";
        setTimeout(() => renderTasks(), 300);
      } else {
        renderTasks();
      }
      showToast("Task deleted", async () => {
        if (deletedTask) {
          const res = await apiFetch("/tasks", { method: "POST", body: deletedTask });
          state.tasks.unshift(res.data);
          deletedTask = null;
          clearTimeout(undoTimeout);
          renderTasks();
          showToast("Task restored");
        }
      });
    } catch (err) {
      showToast("Error: " + err.message);
      throw err;
    }
  }

  async function toggleTaskCompletion(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    const newCompleted = !task.completed;
    const card = document.querySelector(`[data-task-id="${id}"]`);
    const checkbox = card?.querySelector(".task-checkbox");
    if (checkbox) {
      checkbox.style.transform = "scale(0)";
      setTimeout(() => { checkbox.style.transform = "scale(1.2)"; setTimeout(() => checkbox.style.transform = "scale(1)", 150); }, 100);
    }
    try {
      await apiFetch(`/tasks/${id}/toggle`, { method: "PATCH" });
      task.completed = newCompleted;
      task.completed_at = newCompleted ? new Date().toISOString() : null;
      const titleEl = card?.querySelector(".task-title");
      if (titleEl) {
        titleEl.style.transition = "opacity 0.2s";
        titleEl.style.opacity = newCompleted ? "0.5" : "1";
        titleEl.classList.toggle("line-through", newCompleted);
      }
      if (newCompleted && task.priority === "high" && card) {
        animateConfetti(checkbox || card);
      }
      setTimeout(() => {
        state.tasks = [...state.tasks];
        renderTasks();
      }, 400);
    } catch (err) {
      showToast("Error: " + err.message);
    }
  }

  function renderTasks() {
    const container = document.getElementById("taskList");
    if (!container) return;
    if (state.loading) {
      container.innerHTML = `<div class="flex justify-center py-8"><div class="spinner"></div></div>`;
      return;
    }
    if (state.tasks.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <svg class="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
          <p class="text-slate-500 dark:text-slate-400">No tasks found</p>
          <button onclick="window.openQuickAdd()" class="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">Add Task</button>
        </div>`;
      return;
    }
    container.innerHTML = state.tasks.map(t => renderTaskCard(t)).join("");
  }

  function renderTaskCard(task) {
    const cat = state.categories.find(c => c.id === task.category_id);
    const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
    const overdue = isOverdue(task.due_date) && !task.completed;
    const priorityBadge = `<span class="text-xs px-2 py-0.5 rounded-full font-medium ${pc.badge}">${task.priority}</span>`;
    const overdueBadge = overdue ? `<span class="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-bold ml-1">OVERDUE</span>` : "";
    const borderClass = overdue ? "border-l-4 border-l-red-500" : "border border-slate-200 dark:border-slate-700";
    return `
      <div class="task-card bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 mb-3 transition-all duration-200 hover:shadow-md ${borderClass} ${task.completed ? "opacity-60" : ""}" data-task-id="${task.id}">
        <div class="flex items-start gap-3">
          <button onclick="window.TaskManager.toggleTaskCompletion(${task.id})" class="task-checkbox w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${task.completed ? "bg-green-500 border-green-500" : pc.border} hover:scale-105">
            ${task.completed ? '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : ""}
          </button>
          <div class="flex-1 min-w-0">
            <h3 class="task-title font-medium text-slate-900 dark:text-slate-100 ${task.completed ? "line-through text-slate-500" : ""} truncate">${escapeHtml(task.title)}</h3>
            ${task.description ? `<p class="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">${escapeHtml(task.description)}</p>` : ""}
            <div class="flex flex-wrap items-center gap-2 mt-2">
              ${priorityBadge}
              ${overdueBadge}
              ${cat ? `<span class="text-xs px-2 py-0.5 rounded-full text-white font-medium" style="background-color:${cat.color}">${escapeHtml(cat.name)}</span>` : ""}
              ${task.due_date ? `<span class="text-xs flex items-center gap-1 ${isOverdue(task.due_date) && !task.completed ? "text-red-500 font-medium" : isToday(task.due_date) ? "text-blue-500 font-medium" : "text-slate-500 dark:text-slate-400"}">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                ${formatDate(task.due_date)}
              </span>` : ""}
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="window.TaskManager.editTask(${task.id})" class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 transition-colors" title="Edit">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            </button>
            <button onclick="window.TaskManager.deleteTask(${task.id})" class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </div>
      </div>`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function setCategories(cats) {
    state.categories = cats;
  }

  function setFilters(filters) {
    state.filters = { ...state.filters, ...filters };
  }

  function editTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    window.openQuickAdd(task);
  }

  showConfettiStyles();
  window.TaskManager = { fetchTasks, createTask, updateTask, deleteTask, toggleTaskCompletion, setCategories, setFilters, editTask };
})();