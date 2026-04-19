/**
 * TaskFlow — Quick Add Module
 * Quick-add task modal with keyboard shortcuts (Ctrl+N / Cmd+N)
 */

(function () {
  "use strict";

  const API_BASE = "/api";
  let lastUsedCategoryId = null;
  let undoTimeout = null;
  let lastCreatedTask = null;

  const modal = document.getElementById("quick-add-modal");
  const form = document.getElementById("quickAddForm");
  const titleInput = document.getElementById("qaTitle");
  const titleError = document.getElementById("qaTitleError");
  const categorySelect = document.getElementById("qaCategory");
  const dateInput = document.getElementById("qaDate");
  const priorityBtns = {
    low: document.getElementById("qaPriorityLow"),
    medium: document.getElementById("qaPriorityMedium"),
    high: document.getElementById("qaPriorityHigh")
  };

  let currentPriority = "medium";
  let isEditMode = false;
  let editTaskId = null;

  function init() {
    loadLastUsedCategory();
    setupEventListeners();
    setupPriorityButtons();
    setPriority("medium");
  }

  function loadLastUsedCategory() {
    const saved = localStorage.getItem("taskflow_last_category_id");
    if (saved) lastUsedCategoryId = parseInt(saved, 10);
  }

  function saveLastUsedCategory(id) {
    if (id) {
      lastUsedCategoryId = id;
      localStorage.setItem("taskflow_last_category_id", id);
    }
  }

  function setupPriorityButtons() {
    Object.entries(priorityBtns).forEach(([level, btn]) => {
      if (btn) {
        btn.addEventListener("click", () => setPriority(level));
      }
    });
  }

  function setPriority(level) {
    currentPriority = level;
    Object.entries(priorityBtns).forEach(([l, btn]) => {
      if (!btn) return;
      if (l === level) {
        btn.classList.remove("bg-slate-100", "dark:bg-slate-700", "text-slate-600", "dark:text-slate-400");
        btn.classList.add(
          "bg-blue-100", "dark:bg-blue-900/50", "text-blue-700", "dark:text-blue-300",
          "ring-2", "ring-blue-500", "ring-offset-1", "ring-offset-white", "dark:ring-offset-slate-800"
        );
      } else {
        btn.classList.add("bg-slate-100", "dark:bg-slate-700", "text-slate-600", "dark:text-slate-400");
        btn.classList.remove(
          "bg-blue-100", "dark:bg-blue-900/50", "text-blue-700", "dark:text-blue-300",
          "ring-2", "ring-blue-500", "ring-offset-1", "ring-offset-white", "dark:ring-offset-slate-800"
        );
      }
    });
  }

  function setupEventListeners() {
    document.addEventListener("keydown", handleGlobalKeydown);
    if (form) form.addEventListener("submit", handleSubmit);
    if (modal) modal.addEventListener("click", handleBackdropClick);
  }

  function handleGlobalKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "n" || e.key === "N")) {
      e.preventDefault();
      openModal();
    }
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeModal();
    }
  }

  function handleBackdropClick(e) {
    if (e.target === modal || e.target.classList.contains("bg-black/40")) {
      closeModal();
    }
  }

  function openModal(taskData = null) {
    if (!modal) return;
    resetForm();
    
    populateCategories();

    if (taskData) {
      isEditMode = true;
      editTaskId = taskData.id;
      titleInput.value = taskData.title || "";
      categorySelect.value = taskData.category_id || "";
      dateInput.value = taskData.due_date || "";
      setPriority(taskData.priority || "medium");
    } else {
      isEditMode = false;
      editTaskId = null;
      categorySelect.value = lastUsedCategoryId || "";
      setPriority("medium");
    }

    modal.classList.remove("hidden");
    setTimeout(() => titleInput.focus(), 50);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    resetForm();
  }

  function resetForm() {
    if (form) form.reset();
    titleError.classList.add("hidden");
    titleInput.classList.remove("border-red-500", "animate-shake");
    setPriority("medium");
    isEditMode = false;
    editTaskId = null;
  }

  function populateCategories() {
    if (!categorySelect) return;
    const categories = getCategories();
    categorySelect.innerHTML = `<option value="">No category</option>` +
      categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  }

  function getCategories() {
    if (window.Categories?.getCategories) return window.Categories.getCategories();
    if (window.state?.categories) return window.state.categories;
    return [];
  }

  function validateForm() {
    const title = titleInput.value.trim();
    if (!title) {
      titleError.classList.remove("hidden");
      titleInput.classList.add("border-red-500", "animate-shake");
      setTimeout(() => titleInput.classList.remove("animate-shake"), 400);
      titleInput.focus();
      return false;
    }
    titleError.classList.add("hidden");
    titleInput.classList.remove("border-red-500");
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const data = {
      title: titleInput.value.trim(),
      category_id: categorySelect.value ? parseInt(categorySelect.value, 10) : null,
      due_date: dateInput.value || null,
      priority: currentPriority
    };

    try {
      if (isEditMode && editTaskId) {
        await updateTask(editTaskId, data);
        showToast("Task updated");
      } else {
        await createTask(data);
      }
      closeModal();
      triggerRefresh();
    } catch (err) {
      showToast("Error: " + err.message);
    }
  }

  async function apiFetch(endpoint, options = {}) {
    const config = { headers: { "Content-Type": "application/json" }, ...options };
    if (config.body && typeof config.body === "object") config.body = JSON.stringify(config.body);
    const r = await fetch(`${API_BASE}${endpoint}`, config);
    const d = await r.json();
    if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  }

  async function createTask(data) {
    const res = await apiFetch("/tasks", { method: "POST", body: data });
    lastCreatedTask = res.data;
    
    if (data.category_id) {
      saveLastUsedCategory(data.category_id);
    }

    showToast("Task created", handleUndo);
    
    setTimeout(() => animateNewTask(res.data.id), 100);
  }

  async function updateTask(id, data) {
    await apiFetch(`/tasks/${id}`, { method: "PUT", body: data });
  }

  async function handleUndo() {
    if (!lastCreatedTask) return;
    
    clearTimeout(undoTimeout);
    const taskToUndo = lastCreatedTask;
    lastCreatedTask = null;

    try {
      await apiFetch(`/tasks/${taskToUndo.id}`, { method: "DELETE" });
      showToast("Task restored");
      triggerRefresh();
    } catch (err) {
      showToast("Error: " + err.message);
    }
  }

  function animateNewTask(taskId) {
    const card = document.querySelector(`[data-task-id="${taskId}"], [data-id="${taskId}"]`);
    if (card) {
      card.classList.remove("animate-fade-in");
      card.classList.add("animate-slide-in-right");
    }
  }

  function triggerRefresh() {
    if (window.TaskManager?.fetchTasks) window.TaskManager.fetchTasks();
    if (window.loadAll) window.loadAll();
  }

  function showToast(message, onUndo) {
    const existing = document.querySelector(".toast-notification");
    if (existing) existing.remove();

    const t = document.createElement("div");
    t.className = "toast-notification fixed bottom-4 right-4 bg-slate-800 dark:bg-slate-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-in-right";
    t.innerHTML = `<span>${message}</span>${onUndo ? '<button class="underline font-medium text-blue-400 hover:text-blue-300">Undo</button>' : ""}`;
    document.body.appendChild(t);

    if (onUndo) {
      const btn = t.querySelector("button");
      if (btn) btn.addEventListener("click", () => {
        onUndo();
        t.remove();
      });
      clearTimeout(undoTimeout);
      undoTimeout = setTimeout(() => t.remove(), 5000);
    } else {
      setTimeout(() => {
        t.style.opacity = "0";
        t.style.transition = "opacity 0.3s";
        setTimeout(() => t.remove(), 300);
      }, 3000);
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  window.openQuickAdd = openModal;
  window.closeQuickAdd = closeModal;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();