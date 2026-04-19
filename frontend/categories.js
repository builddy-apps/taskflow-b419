/**
 * TaskFlow — Categories Module
 * Category management, sidebar rendering, and mobile chip bar.
 */

(function () {
  "use strict";

  const COLOR_SWATCHES = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', 
    '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
    '#EC4899', '#F43F5E', '#64748B', '#84CC16'
  ];

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let categories = [];
  let selectedCategoryId = null;

  function apiFetch(endpoint, options = {}) {
    const config = { headers: { "Content-Type": "application/json" }, ...options };
    if (config.body && typeof config.body === "object") config.body = JSON.stringify(config.body);
    return fetch(`/api${endpoint}`, config).then(async r => {
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
      return d;
    });
  }

  async function fetchCategories() {
    try {
      const res = await apiFetch("/categories");
      categories = res.data || [];
      return categories;
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      return [];
    }
  }

  async function createCategory(name, color) {
    if (!name || !name.trim()) throw new Error("Category name is required");
    if (name.length > 30) throw new Error("Name must be 30 characters or less");
    if (!color) throw new Error("Color is required");
    
    const res = await apiFetch("/categories", { method: "POST", body: { name: name.trim(), color } });
    categories.push(res.data);
    renderSidebar();
    renderMobileChips();
    showToast(`Category "${name}" created`);
    return res.data;
  }

  async function updateCategory(id, updates) {
    const res = await apiFetch(`/categories/${id}`, { method: "PUT", body: updates });
    const idx = categories.findIndex(c => c.id === id);
    if (idx !== -1) categories[idx] = res.data;
    renderSidebar();
    renderMobileChips();
    showToast("Category updated");
    return res.data;
  }

  async function deleteCategory(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    const hasTasks = cat.task_count > 0;
    let reassignTo = null;

    if (hasTasks) {
      const otherCats = categories.filter(c => c.id !== id);
      const msg = `"${cat.name}" has ${cat.task_count} task(s). What would you like to do?`;
      
      const choice = await showDeleteConfirm(msg, otherCats);
      if (choice === 'cancel') return;
      if (choice === 'reassign') {
        const defaultCat = categories.find(c => c.name === 'Personal') || otherCats[0];
        reassignTo = defaultCat ? defaultCat.id : null;
      }
    }

    await apiFetch(`/categories/${id}${reassignTo !== null ? `?reassign_to=${reassignTo}` : ''}`, { method: "DELETE" });
    categories = categories.filter(c => c.id !== id);
    if (selectedCategoryId === id) {
      selectedCategoryId = null;
      if (window.__filter) window.__filter(null, 'all');
    }
    renderSidebar();
    renderMobileChips();
    showToast(`Category "${cat.name}" deleted`);
  }

  function showDeleteConfirm(message, otherCats) {
    return new Promise(resolve => {
      const existing = $("#categoryDeleteConfirm");
      if (existing) existing.remove();

      const modal = document.createElement("div");
      modal.id = "categoryDeleteConfirm";
      modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4";
      modal.innerHTML = `<div class="absolute inset-0 bg-black/50"></div>
        <div class="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6 animate-fade-in">
          <h3 class="text-lg font-semibold mb-2">Delete Category?</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${message}</p>
          ${otherCats.length ? `<p class="text-xs text-gray-500 mb-4">Tasks will be reassigned to "${otherCats[0].name}"</p>` : ''}
          <div class="flex gap-2 justify-end">
            <button type="button" id="cancelDelete" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            <button type="button" id="confirmDelete" class="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600">Delete</button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      modal.querySelector("#cancelDelete").onclick = () => { modal.remove(); resolve('cancel'); };
      modal.querySelector("#confirmDelete").onclick = () => { modal.remove(); resolve('delete'); };
      modal.querySelector(".absolute").onclick = () => { modal.remove(); resolve('cancel'); };
    });
  }

  function renderSidebar() {
    const sidebar = $("#sidebar");
    if (!sidebar) return;

    const allActive = !selectedCategoryId;
    const allClass = allActive ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700";

    let html = `
      <button onclick="handleCategoryFilter(null)" class="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ${allClass}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
        <span>All Tasks</span>
      </button>
      <div class="border-t border-gray-200 dark:border-gray-700 my-2"></div>
    `;

    categories.forEach(cat => {
      const isActive = selectedCategoryId === cat.id;
      const activeClass = isActive ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700";
      html += `
        <button onclick="handleCategoryFilter(${cat.id})" class="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ${activeClass} group">
          <span class="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style="background:${cat.color}"></span>
          <span class="flex-1 truncate">${escapeHtml(cat.name)}</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">${cat.task_count || 0}</span>
          <button onclick="event.stopPropagation(); showCategoryMenu(${cat.id})" class="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-all">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg>
          </button>
        </button>
      `;
    });

    html += `
      <div class="border-t border-gray-200 dark:border-gray-700 my-2"></div>
      ${isAddingCategory ? renderAddForm() : `
        <button onclick="showAddForm()" class="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          <span>Add Category</span>
        </button>
      `}
    `;

    sidebar.innerHTML = html;
  }

  function renderAddForm() {
    const swatches = COLOR_SWATCHES.map(c => 
      `<button type="button" onclick="selectCategoryColor('${c}')" class="w-6 h-6 rounded-full border-2 ${window.selectedColor === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'} transition-all" style="background:${c}"></button>`
    ).join('');

    return `
      <div class="px-3 py-2 animate-slide-up">
        <input type="text" id="categoryNameInput" placeholder="Category name (max 30)" maxlength="30" class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none mb-2">
        <div class="flex flex-wrap gap-1 mb-2">${swatches}</div>
        <div class="flex gap-2">
          <button type="button" onclick="saveCategory()" class="flex-1 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-all">Save</button>
          <button type="button" onclick="cancelAddForm()" class="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">Cancel</button>
        </div>
      </div>
    `;
  }

  function renderMobileChips() {
    const chipsContainer = $("#mobileChips");
    if (!chipsContainer) return;

    let html = `<button onclick="handleCategoryFilter(null)" class="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!selectedCategoryId ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}">All</button>`;
    
    categories.forEach(cat => {
      const isActive = selectedCategoryId === cat.id;
      html += `<button onclick="handleCategoryFilter(${cat.id})" class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isActive ? 'text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}" style="${isActive ? `background:${cat.color}` : ''}">
        <span class="w-2 h-2 rounded-full" style="background:${cat.color}"></span>
        ${escapeHtml(cat.name)}
      </button>`;
    });

    chipsContainer.innerHTML = html;
  }

  function showAddForm() {
    window.selectedColor = COLOR_SWATCHES[0];
    isAddingCategory = true;
    renderSidebar();
    setTimeout(() => $("#categoryNameInput")?.focus(), 50);
  }

  function cancelAddForm() {
    isAddingCategory = false;
    window.selectedColor = null;
    renderSidebar();
  }

  async function saveCategory() {
    const nameInput = $("#categoryNameInput");
    const name = nameInput?.value.trim();
    const color = window.selectedColor;

    if (!name) {
      nameInput?.classList.add("border-red-500");
      setTimeout(() => nameInput?.classList.remove("border-red-500"), 1000);
      return;
    }

    try {
      await createCategory(name, color);
      isAddingCategory = false;
      window.selectedColor = null;
      renderSidebar();
      if (window.loadAll) await window.loadAll();
    } catch (err) {
      showToast(err.message);
    }
  }

  function selectCategoryColor(color) {
    window.selectedColor = color;
    renderSidebar();
  }

  async function showCategoryMenu(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    const existing = $("#categoryMenu");
    if (existing) existing.remove();

    const btn = event.target.closest("button");
    const rect = btn.getBoundingClientRect();

    const menu = document.createElement("div");
    menu.id = "categoryMenu";
    menu.className = "fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-32 animate-fade-in";
    menu.style.left = `${rect.right - 120}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.innerHTML = `
      <button onclick="handleCategoryEdit(${id})" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Edit</button>
      <button onclick="handleCategoryDelete(${id})" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30">Delete</button>
    `;
    document.body.appendChild(menu);

    const close = () => { menu.remove(); document.removeEventListener("click", close); };
    setTimeout(() => document.addEventListener("click", close), 10);
  }

  async function handleCategoryEdit(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    const newName = prompt("Category name:", cat.name);
    if (newName === null || newName.trim() === "") return;
    if (newName.length > 30) { showToast("Name must be 30 characters or less"); return; }

    const newColor = prompt("Color (hex):", cat.color);
    if (newColor && !/^#[0-9A-Fa-f]{6}$/.test(newColor)) { showToast("Invalid hex color"); return; }

    try {
      await updateCategory(id, { name: newName.trim(), color: newColor || cat.color });
      if (window.loadAll) await window.loadAll();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleCategoryDelete(id) {
    await deleteCategory(id);
    if (window.loadAll) await window.loadAll();
  }

  function handleCategoryFilter(id) {
    selectedCategoryId = id;
    renderSidebar();
    renderMobileChips();
    if (window.__filter) window.__filter(id, 'all');
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function showToast(msg) {
    if (window.renderToast) window.renderToast(msg);
    else console.log("Toast:", msg);
  }

  function updateCategoryCounts(updatedCategories) {
    if (!updatedCategories) return;
    categories.forEach(c => {
      const updated = updatedCategories.find(u => u.id === c.id);
      if (updated) c.task_count = updated.task_count;
    });
    renderSidebar();
    renderMobileChips();
  }

  // Public API
  window.handleCategoryFilter = handleCategoryFilter;
  window.selectCategoryColor = selectCategoryColor;
  window.saveCategory = saveCategory;
  window.cancelAddForm = cancelAddForm;
  window.handleCategoryEdit = handleCategoryEdit;
  window.handleCategoryDelete = handleCategoryDelete;

  // Initialize
  async function init() {
    await fetchCategories();
    renderSidebar();
    renderMobileChips();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

})();