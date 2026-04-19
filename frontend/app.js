/**
 * TaskFlow — Frontend App (app.js)
 * Task management with categories, filtering, drag-and-drop, animations, and stats.
 */

(function () {
  "use strict";

  const API_BASE = "/api";
  let searchTimer = null, dragId = null;

  const state = {
    tasks: [], categories: [],
    filters: { category_id: null, status: 'all', priority: null, date_range: null, search: '' },
    stats: { dashboard: null, weekly: null },
    currentView: 'list', weeklyWeekOffset: 0, settingsOpen: false,
    loading: false, error: null
  };

  function setState(partial) { Object.assign(state, partial); render(); }

  async function apiFetch(endpoint, options = {}) {
    const config = { headers: { "Content-Type": "application/json" }, ...options };
    if (config.body && typeof config.body === "object") config.body = JSON.stringify(config.body);
    const r = await fetch(`${API_BASE}${endpoint}`, config), d = await r.json();
    if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  }

  const api = {
    fetchTasks: (f) => {
      const p = new URLSearchParams();
      if (f) Object.entries(f).forEach(([k, v]) => { if (v != null && v !== '' && v !== 'all') p.set(k, v); });
      return apiFetch("/tasks" + (p.toString() ? `?${p}` : ""));
    },
    createTask: (d) => apiFetch("/tasks", { method: "POST", body: d }),
    updateTask: (id, d) => apiFetch(`/tasks/${id}`, { method: "PUT", body: d }),
    deleteTask: (id) => apiFetch(`/tasks/${id}`, { method: "DELETE" }),
    batchDeleteTasks: (ids) => apiFetch("/tasks/batch-delete", { method: "POST", body: { ids } }),
    reorderTask: (id, so, ci) => apiFetch(`/tasks/${id}/reorder`, { method: "PUT", body: { sort_order: so, category_id: ci } }),
    fetchCategories: () => apiFetch("/categories"),
    createCategory: (d) => apiFetch("/categories", { method: "POST", body: d }),
    updateCategory: (id, d) => apiFetch(`/categories/${id}`, { method: "PUT", body: d }),
    deleteCategory: (id, r) => apiFetch(`/categories/${id}?reassign_to=${r || ''}`, { method: "DELETE" }),
    fetchWeeklyStats: (w) => apiFetch("/stats/weekly" + (w ? `?week_offset=${w}` : "")),
    fetchDashboardStats: () => apiFetch("/stats/dashboard"),
    fetchCategoryBreakdown: () => apiFetch("/stats/category-breakdown"),
  };

  const $ = (s) => document.querySelector(s);

  function initDarkMode() {
    const toggle = $("#darkToggle"), icon = $("#darkIcon");
    if (!toggle) return;
    const saved = localStorage.getItem("builddy-dark");
    if (saved === "false") { document.documentElement.classList.remove("dark"); icon.textContent = "\u2600"; }
    else { document.documentElement.classList.add("dark"); icon.textContent = "\u263E"; }
    toggle.addEventListener("click", () => {
      const isDark = document.documentElement.classList.toggle("dark");
      localStorage.setItem("builddy-dark", isDark); icon.textContent = isDark ? "\u263E" : "\u2600";
    });
  }

  function animateConfetti(origin) {
    const rect = origin.getBoundingClientRect(), colors = ["#ef4444","#f59e0b","#10b981","#3b82f6","#8b5cf6"];
    for (let i = 0; i < 8; i++) {
      const p = document.createElement("span"); p.className = "confetti-p";
      const a = (Math.PI * 2 * i) / 8, dist = 30 + Math.random() * 20;
      p.style.cssText = `left:${rect.left+rect.width/2}px;top:${rect.top}px;background:${colors[i%5]};--cx:${Math.cos(a)*dist}px;--cy:${Math.sin(a)*dist}px;`;
      document.body.appendChild(p); setTimeout(() => p.remove(), 600);
    }
  }
  function animateSlideOut(el, cb) { el.style.transition="all .3s"; el.style.opacity="0"; el.style.transform="translateX(20px)"; el.addEventListener("transitionend", cb, {once:true}); }
  function animateShake(el) { el.classList.add("animate-shake"); setTimeout(() => el.classList.remove("animate-shake"), 400); }

  function renderToast(msg, undoCb) {
    const t = $("#toast"); if (!t) return;
    t.innerHTML = msg + (undoCb ? ` <button class="underline font-medium">Undo</button>` : "");
    t.classList.remove("hidden");
    if (undoCb) t.querySelector("button")?.addEventListener("click", undoCb);
    setTimeout(() => t.classList.add("hidden"), 5000);
  }

  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  function render() {
    const loading = $("#loadingState"), error = $("#errorState"), errorMsg = $("#errorMessage"), main = $("#mainContent");
    [loading, error, main].forEach(e => e?.classList.add("hidden"));
    if (state.loading) { loading?.classList.remove("hidden"); return; }
    if (state.error) { if (errorMsg) errorMsg.textContent = state.error; error?.classList.remove("hidden"); return; }
    main?.classList.remove("hidden");
    renderDashboardWidgets(state.stats.dashboard);
    renderSidebar(state.categories, state.filters);
    if (state.currentView === 'weekly') renderWeeklyView(state.stats.weekly);
    else renderTaskSections(state.tasks, state.categories);
  }

  function renderDashboardWidgets(stats) {
    if (!stats) return;
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set("#todayCount", stats.today || 0); set("#overdueCount", stats.overdue || 0);
    set("#weekCompleted", stats.week_completed || 0); set("#weekTotal", stats.week_total || 0);
    const bar = $("#weekProgress"); if (bar && stats.week_total) bar.style.width = ((stats.week_completed/stats.week_total)*100)+"%";
  }

  function renderSidebar(cats, filters) {
    const sb = $("#sidebar"); if (!sb) return;
    sb.innerHTML = `<button onclick="window.__filter(null,'all')" class="block w-full text-left px-3 py-2 rounded ${!filters.category_id&&filters.status==='all'?'bg-blue-100 dark:bg-blue-900 font-medium':'hover:bg-gray-100 dark:hover:bg-gray-700'}">All Tasks</button>` +
      cats.map(c => `<button onclick="window.__filter(${c.id},'all')" class="flex items-center gap-2 w-full text-left px-3 py-2 rounded ${filters.category_id===c.id?'bg-blue-100 dark:bg-blue-900 font-medium':'hover:bg-gray-100 dark:hover:bg-gray-700'}">
        <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${c.color}"></span>${escapeHtml(c.name)}<span class="ml-auto text-xs text-gray-400">${c.task_count||0}</span></button>`).join("");
  }

  function renderTaskSections(tasks, cats) {
    const area = $("#taskArea"); if (!area) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const overdue=[], todayT=[], upcoming=[], completed=[];
    tasks.forEach(t => {
      if (t.completed) { completed.push(t); return; }
      if (!t.due_date) { upcoming.push(t); return; }
      const d = new Date(t.due_date+"T00:00:00");
      d < today ? overdue.push(t) : d.getTime()===today.getTime() ? todayT.push(t) : upcoming.push(t);
    });
    const sec = (title, items, cls) => items.length ? `<div class="mb-6"><h2 class="text-sm font-semibold uppercase tracking-wide mb-3 ${cls}">${title} (${items.length})</h2>${items.map(t=>renderTaskCard(t,cats)).join("")}</div>` : "";
    area.innerHTML = sec("Overdue",overdue,"text-red-500") + sec("Today",todayT,"text-blue-500") + sec("Upcoming",upcoming,"text-gray-500 dark:text-gray-400") + sec("Completed",completed,"text-green-500");
  }

  function renderTaskCard(t, cats) {
    const cat = cats.find(c => c.id === t.category_id);
    const pc = { high:"bg-red-500", medium:"bg-yellow-500", low:"bg-green-500" };
    const overdue = t.due_date && !t.completed && new Date(t.due_date+"T00:00:00") < new Date(new Date().setHours(0,0,0,0));
    return `<div class="task-card bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-2 flex items-center gap-3 animate-fade-in" draggable="true" data-id="${t.id}"
      ondragstart="window.__dragStart(event,${t.id})" ondragover="window.__dragOver(event)" ondrop="window.__drop(event,${t.id})">
      <button onclick="window.__toggle(${t.id})" class="w-5 h-5 rounded-full border-2 ${t.completed?'bg-green-500 border-green-500 text-white':'border-gray-400'} flex items-center justify-center text-xs flex-shrink-0">${t.completed?'✓':''}</button>
      <div class="flex-1 min-w-0"><span class="${t.completed?'line-through text-gray-400':''}">${escapeHtml(t.title)}</span>
      ${t.due_date?`<span class="ml-2 text-xs px-1.5 py-0.5 rounded ${overdue?'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400':'bg-gray-100 dark:bg-gray-700 text-gray-500'}">${new Date(t.due_date+'T00:00:00').toLocaleDateString()}</span>`:''}</div>
      ${cat?`<span class="text-xs px-2 py-0.5 rounded-full" style="background:${cat.color}20;color:${cat.color}">${escapeHtml(cat.name)}</span>`:''}
      <span class="w-2 h-2 rounded-full ${pc[t.priority]||''} flex-shrink-0"></span>
      <button onclick="window.__edit(${t.id})" class="text-gray-400 hover:text-blue-500 text-sm">✎</button>
      <button onclick="window.__delete(${t.id})" class="text-gray-400 hover:text-red-500 text-sm">✕</button></div>`;
  }

  function renderWeeklyView(weekly) {
    const area = $("#taskArea"); if (!area || !weekly) return;
    area.innerHTML = `<div class="flex items-center justify-between mb-4">
      <button onclick="window.__weeklyNav(-1)" class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700">← Prev</button>
      <h2 class="font-semibold">Week of ${weekly.week_start?new Date(weekly.week_start).toLocaleDateString():'Current'}</h2>
      <button onclick="window.__weeklyNav(1)" class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700">Next →</button></div>
      <div class="grid grid-cols-7 gap-2">${(weekly.days||[]).map(d=>`<div class="text-center p-2 rounded ${d.today?'bg-blue-100 dark:bg-blue-900':'bg-gray-50 dark:bg-gray-800'}">
      <div class="text-xs text-gray-500">${d.name}</div><div class="text-lg font-bold">${d.date}</div>
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1"><div class="bg-blue-500 h-1.5 rounded-full" style="width:${d.total?(d.completed/d.total*100):0}%"></div></div>
      <div class="text-xs mt-1">${d.completed}/${d.total}</div></div>`).join("")}</div>`;
  }

  async function loadAll() {
    setState({ loading: true, error: null });
    try {
      const [cats, tasks, dash, weekly] = await Promise.all([
        api.fetchCategories(), api.fetchTasks(state.filters), api.fetchDashboardStats(), api.fetchWeeklyStats(state.weeklyWeekOffset)
      ]);
      setState({ categories: cats.data, tasks: tasks.data, stats: { dashboard: dash.data, weekly: weekly.data }, loading: false });
    } catch (e) { setState({ error: e.message, loading: false }); }
  }

  async function handleToggle(id) {
    const t = state.tasks.find(x => x.id === id); if (!t) return;
    try {
      await api.updateTask(id, { completed: !t.completed });
      if (!t.completed) { const card = document.querySelector(`[data-id="${id}"]`); if (card) { animateConfetti(card); card.classList.add("task-completing"); } }
      await loadAll();
    } catch (e) { renderToast("Error: " + e.message); }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this task?")) return;
    const card = document.querySelector(`[data-id="${id}"]`);
    const doDelete = async () => { try { await api.deleteTask(id); await loadAll(); } catch (e) { renderToast("Error: " + e.message); } };
    card ? animateSlideOut(card, doDelete) : doDelete();
  }

  async function handleEdit(id) {
    const t = state.tasks.find(x => x.id === id); if (!t) return;
    const modal = $("#quickAddModal"); if (!modal) return;
    modal.classList.remove("hidden");
    const form = modal.querySelector("form"); if (!form) return;
    form.querySelector("[name=title]").value = t.title;
    const catSel = form.querySelector("[name=category_id]"); if (catSel) catSel.value = t.category_id || "";
    const priSel = form.querySelector("[name=priority]"); if (priSel) priSel.value = t.priority || "medium";
    const dateInp = form.querySelector("[name=due_date]"); if (dateInp) dateInp.value = t.due_date || "";
    form.dataset.editId = id; form.querySelector("[name=title]").focus();
  }

  function handleQuickAddOpen(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); const m = $("#quickAddModal"); if (m) { m.classList.remove("hidden"); m.querySelector("[name=title]")?.focus(); } }
    if (e.key === "Escape") { $("#quickAddModal")?.classList.add("hidden"); $("#settingsPanel")?.classList.add("hidden"); }
  }

  async function handleQuickAddSave(e) {
    e.preventDefault(); const form = e.target;
    const titleInp = form.querySelector("[name=title]"), title = titleInp.value.trim();
    if (!title) { animateShake(titleInp); titleInp.parentElement.querySelector(".text-red-500")?.remove(); const err = document.createElement("p"); err.className = "text-red-500 text-xs mt-1"; err.textContent = "Task title is required"; titleInp.after(err); return; }
    const data = { title, category_id: form.querySelector("[name=category_id]")?.value || null, priority: form.querySelector("[name=priority]")?.value || "medium", due_date: form.querySelector("[name=due_date]")?.value || null };
    try {
      const editId = form.dataset.editId;
      if (editId) { await api.updateTask(parseInt(editId), data); delete form.dataset.editId; } else { await api.createTask(data); }
      form.reset(); $("#quickAddModal")?.classList.add("hidden"); await loadAll();
      renderToast("Task saved");
    } catch (err) { renderToast("Error: " + err.message); }
  }

  function handleFilter(catId, status) { state.filters.category_id = catId; state.filters.status = status; loadAll(); }
  function handleSearch(q) { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.filters.search = q; loadAll(); }, 300); }
  function handleDragStart(e, id) { dragId = id; e.target.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; }
  function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.remove("drag-over"); e.dataTransfer.dropEffect = "move"; }
  async function handleDrop(e, targetId) {
    e.preventDefault(); e.currentTarget.classList.remove("drag-over");
    if (dragId && dragId !== targetId) { try { await api.reorderTask(dragId, targetId, state.filters.category_id); await loadAll(); } catch (err) { renderToast("Error: " + err.message); } }
    document.querySelectorAll(".dragging").forEach(el => el.classList.remove("dragging")); dragId = null;
  }
  async function handleWeeklyNav(dir) { state.weeklyWeekOffset += dir; try { const r = await api.fetchWeeklyStats(state.weeklyWeekOffset); state.stats.weekly = r.data; render(); } catch (e) { renderToast(e.message); } }

  window.__toggle = handleToggle; window.__delete = handleDelete; window.__edit = handleEdit;
  window.__filter = handleFilter; window.__dragStart = handleDragStart; window.__dragOver = handleDragOver; window.__drop = handleDrop; window.__weeklyNav = handleWeeklyNav;

  function init() {
    initDarkMode();
    document.addEventListener("keydown", handleQuickAddOpen);
    const form = $("#quickAddModal form"); if (form) form.addEventListener("submit", handleQuickAddSave);
    const search = $("#searchInput"); if (search) search.addEventListener("input", (e) => handleSearch(e.target.value));
    const cancel = $("#cancelAddBtn"); if (cancel) cancel.addEventListener("click", () => $("#quickAddModal")?.classList.add("hidden"));
    const addBtn = $("#addItemBtn"); if (addBtn) addBtn.addEventListener("click", () => { const m = $("#quickAddModal"); if (m) { m.classList.remove("hidden"); m.querySelector("[name=title]")?.focus(); } });
    const retry = $("#retryBtn"); if (retry) retry.addEventListener("click", loadAll);
    const weeklyBtn = $("#weeklyViewBtn"); if (weeklyBtn) weeklyBtn.addEventListener("click", () => { state.currentView = 'weekly'; render(); });
    const listBtn = $("#listViewBtn"); if (listBtn) listBtn.addEventListener("click", () => { state.currentView = 'list'; render(); });
    loadAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();