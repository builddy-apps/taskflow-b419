/**
 * TaskFlow — Filters Module
 * Filtering and search functionality with URL persistence and active filter pills.
 */

(function () {
  "use strict";

  let searchTimeout = null;
  const state = {
    category_id: null,
    status: "all",
    priority: null,
    date_range: null,
    search: ""
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function init() {
    loadFiltersFromURL();
    setupSearchInput();
    setupFilterDropdowns();
    renderActiveFilters();
    setupClearAll();
    window.addEventListener("popstate", handlePopState);
  }

  function loadFiltersFromURL() {
    const params = new URLSearchParams(window.location.search);
    state.category_id = params.get("category_id") ? parseInt(params.get("category_id"), 10) : null;
    state.status = params.get("status") || "all";
    state.priority = params.get("priority") || null;
    state.date_range = params.get("date_range") || null;
    state.search = params.get("search") || "";
    
    const searchInput = $("#searchInput");
    if (searchInput && state.search) searchInput.value = state.search;
    
    applyFilters();
  }

  function saveFiltersToURL() {
    const params = new URLSearchParams();
    if (state.category_id) params.set("category_id", state.category_id);
    if (state.status !== "all") params.set("status", state.status);
    if (state.priority) params.set("priority", state.priority);
    if (state.date_range) params.set("date_range", state.date_range);
    if (state.search) params.set("search", state.search);
    
    const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.pushState({ filters: state }, "", newURL);
  }

  function handlePopState(e) {
    if (e.state && e.state.filters) {
      Object.assign(state, e.state.filters);
      renderActiveFilters();
      applyFilters();
      
      const searchInput = $("#searchInput");
      if (searchInput) searchInput.value = state.search || "";
    }
  }

  function setupSearchInput() {
    const searchInput = $("#searchInput");
    if (!searchInput) return;
    
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.search = e.target.value.trim();
        saveFiltersToURL();
        renderActiveFilters();
        applyFilters();
      }, 300);
    });
  }

  function setupFilterDropdowns() {
    const dateSelect = $("#dateFilter");
    const statusSelect = $("#statusFilter");
    const prioritySelect = $("#priorityFilter");

    if (dateSelect) {
      dateSelect.value = state.date_range || "all";
      dateSelect.addEventListener("change", (e) => {
        state.date_range = e.target.value === "all" ? null : e.target.value;
        saveFiltersToURL();
        renderActiveFilters();
        applyFilters();
      });
    }

    if (statusSelect) {
      statusSelect.value = state.status;
      statusSelect.addEventListener("change", (e) => {
        state.status = e.target.value;
        saveFiltersToURL();
        renderActiveFilters();
        applyFilters();
      });
    }

    if (prioritySelect) {
      prioritySelect.value = state.priority || "all";
      prioritySelect.addEventListener("change", (e) => {
        state.priority = e.target.value === "all" ? null : e.target.value;
        saveFiltersToURL();
        renderActiveFilters();
        applyFilters();
      });
    }
  }

  function setCategoryFilter(categoryId) {
    state.category_id = categoryId;
    saveFiltersToURL();
    renderActiveFilters();
    applyFilters();
  }

  function removeFilter(filterKey) {
    if (filterKey === "category_id") state.category_id = null;
    if (filterKey === "status") state.status = "all";
    if (filterKey === "priority") state.priority = null;
    if (filterKey === "date_range") state.date_range = null;
    if (filterKey === "search") { state.search = ""; const si = $("#searchInput"); if (si) si.value = ""; }
    
    saveFiltersToURL();
    renderActiveFilters();
    applyFilters();
  }

  function clearAllFilters() {
    state.category_id = null;
    state.status = "all";
    state.priority = null;
    state.date_range = null;
    state.search = "";
    
    const searchInput = $("#searchInput");
    if (searchInput) searchInput.value = "";
    
    const dateSelect = $("#dateFilter");
    if (dateSelect) dateSelect.value = "all";
    const statusSelect = $("#statusFilter");
    if (statusSelect) statusSelect.value = "all";
    const prioritySelect = $("#priorityFilter");
    if (prioritySelect) prioritySelect.value = "all";
    
    saveFiltersToURL();
    renderActiveFilters();
    applyFilters();
  }

  function renderActiveFilters() {
    const container = $("#activeFilters");
    if (!container) return;

    const pills = [];
    const categories = window.Categories?.getCategories?.() || [];

    if (state.category_id) {
      const cat = categories.find(c => c.id === state.category_id);
      pills.push({ key: "category_id", label: cat ? `Category: ${cat.name}` : "Category", color: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" });
    }
    if (state.status !== "all") {
      const label = state.status === "active" ? "Active" : state.status === "completed" ? "Completed" : state.status;
      pills.push({ key: "status", label: `Status: ${label}`, color: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" });
    }
    if (state.priority) {
      pills.push({ key: "priority", label: `Priority: ${state.priority.charAt(0).toUpperCase() + state.priority.slice(1)}`, color: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300" });
    }
    if (state.date_range) {
      pills.push({ key: "date_range", label: `Date: ${state.date_range.replace("_", " ")}`, color: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300" });
    }
    if (state.search) {
      pills.push({ key: "search", label: `Search: "${state.search}"`, color: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" });
    }

    if (pills.length === 0) {
      container.innerHTML = "";
      container.classList.add("hidden");
      return;
    }

    container.classList.remove("hidden");
    container.innerHTML = pills.map(p => `
      <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${p.color} animate-fade-in">
        ${p.label}
        <button onclick="window.Filters.removeFilter('${p.key}')" class="ml-1 hover:opacity-70 focus:outline-none" title="Clear filter">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </span>
    `).join("");
  }

  function setupClearAll() {
    const clearBtn = $("#clearAllFilters");
    if (!clearBtn) return;
    clearBtn.addEventListener("click", clearAllFilters);
  }

  function applyFilters() {
    if (window.TaskManager) {
      window.TaskManager.setFilters(state);
      window.TaskManager.fetchTasks();
    }
    if (window.Categories) {
      window.Categories.setSelectedCategory(state.category_id);
    }
  }

  function getFilters() {
    return { ...state };
  }

  function hasActiveFilters() {
    return !!(state.category_id || state.status !== "all" || state.priority || state.date_range || state.search);
  }

  window.Filters = {
    setCategoryFilter,
    removeFilter,
    clearAllFilters,
    getFilters,
    hasActiveFilters,
    renderActiveFilters,
    init
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();