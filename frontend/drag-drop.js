/**
 * TaskFlow — Drag and Drop Module
 * Drag-and-drop task reordering with visual feedback and touch support.
 */

(function () {
  "use strict";

  const API_BASE = "/api";
  
  let draggedTaskId = null;
  let draggedElement = null;
  let dropIndicator = null;
  let isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Touch-specific state
  let touchStartX = 0;
  let touchStartY = 0;
  let touchedTaskId = null;
  let touchClone = null;
  let originalTransform = '';
  let touchScrollY = 0;

  function createDropIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator h-1 bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-150 pointer-events-none z-40';
    indicator.style.display = 'none';
    indicator.style.position = 'fixed';
    indicator.style.boxShadow = '0 0 8px rgba(59, 130, 246, 0.5)';
    return indicator;
  }

  function init() {
    dropIndicator = createDropIndicator();
    document.body.appendChild(dropIndicator);

    // HTML5 Drag and Drop events
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('dragover', handleDragOver, { passive: false });
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('drop', handleDrop);

    // Touch event support for mobile devices
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    // Add touch-specific styles
    addTouchStyles();

    console.log('[drag-drop] Initialized with touch support:', isTouchDevice);
  }

  function handleDragStart(e) {
    const taskCard = e.target.closest('[data-task-id]');
    if (!taskCard) return;

    draggedTaskId = parseInt(taskCard.dataset.taskId, 10);
    draggedElement = taskCard;

    if (!canReorder(taskCard)) {
      e.preventDefault();
      return;
    }

    taskCard.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTaskId.toString());

    // Create custom drag image
    const dragImage = taskCard.cloneNode(true);
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-9999px';
    dragImage.style.width = `${taskCard.offsetWidth}px`;
    dragImage.classList.add('drag-image');
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, taskCard.offsetWidth / 2, 20);
    setTimeout(() => dragImage.remove(), 0);
  }

  function handleDragEnd(e) {
    if (draggedElement) {
      draggedElement.classList.remove('dragging');
      draggedElement.style.transform = '';
    }
    draggedTaskId = null;
    draggedElement = null;
    hideDropIndicator();
  }

  function handleDragEnter(e) {
    const taskCard = e.target.closest('[data-task-id]');
    if (!taskCard || !draggedTaskId) return;
    
    const targetId = parseInt(taskCard.dataset.taskId, 10);
    if (targetId === draggedTaskId) return;
    
    if (canDropOn(taskCard)) {
      taskCard.classList.add('drag-over');
    }
  }

  function handleDragOver(e) {
    e.preventDefault();

    const taskCard = e.target.closest('[data-task-id]');
    if (!taskCard || !draggedTaskId) {
      hideDropIndicator();
      return;
    }

    const targetId = parseInt(taskCard.dataset.taskId, 10);
    if (targetId === draggedTaskId) {
      hideDropIndicator();
      return;
    }

    if (!canDropOn(taskCard)) {
      hideDropIndicator();
      return;
    }

    // Remove drag-over class from all cards
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    taskCard.classList.add('drag-over');

    e.dataTransfer.dropEffect = 'move';
    showDropIndicator(taskCard, e.clientY);
  }

  async function handleDrop(e) {
    e.preventDefault();

    const targetCard = e.target.closest('[data-task-id]');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    if (!targetCard || !draggedTaskId) {
      handleDragEnd(e);
      return;
    }

    const targetId = parseInt(targetCard.dataset.taskId, 10);
    if (targetId === draggedTaskId) {
      handleDragEnd(e);
      return;
    }

    if (!canDropOn(targetCard)) {
      handleDragEnd(e);
      return;
    }

    hideDropIndicator();

    const rect = targetCard.getBoundingClientRect();
    const isBelow = e.clientY > rect.top + rect.height / 2;

    await performReorder(draggedTaskId, targetId, isBelow);
    handleDragEnd(e);
  }

  // Touch handlers for mobile devices
  function handleTouchStart(e) {
    const taskCard = e.target.closest('[data-task-id]');
    if (!taskCard) return;

    // Prevent if touching a button or interactive element inside the card
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
      return;
    }

    touchedTaskId = parseInt(taskCard.dataset.taskId, 10);
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchScrollY = window.scrollY;

    if (!canReorder(taskCard)) return;

    // Add long-press detection for initiating drag
    taskCard.dataset.touchStartTime = Date.now();
  }

  function handleTouchMove(e) {
    if (!touchedTaskId) return;

    const taskCard = document.querySelector(`[data-task-id="${touchedTaskId}"]`);
    if (!taskCard) return;

    const touchStartTime = parseInt(taskCard.dataset.touchStartTime || '0', 10);
    const touchDuration = Date.now() - touchStartTime;

    // Require minimum touch duration before drag starts
    if (touchDuration < 200) return;

    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;

    // Require minimum movement threshold
    if (Math.abs(deltaY) < 15 && Math.abs(deltaX) < 15) return;

    e.preventDefault();

    if (!touchClone) {
      originalTransform = taskCard.style.transform;
      
      // Create visual clone
      touchClone = taskCard.cloneNode(true);
      touchClone.classList.add('touch-clone');
      touchClone.style.cssText = `
        position: fixed;
        width: ${taskCard.offsetWidth}px;
        pointer-events: none;
        z-index: 1000;
        opacity: 0.95;
        transform: scale(1.02);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
      `;
      document.body.appendChild(touchClone);
      
      taskCard.classList.add('dragging', 'touch-dragging');
    }

    // Move clone with touch
    const cloneX = touchStartX + deltaX - taskCard.offsetWidth / 2;
    const cloneY = touchStartY + deltaY - taskCard.offsetHeight / 2;
    touchClone.style.left = `${cloneX}px`;
    touchClone.style.top = `${cloneY}px`;

    // Auto-scroll near edges
    const scrollThreshold = 50;
    const viewportHeight = window.innerHeight;
    if (e.touches[0].clientY < scrollThreshold) {
      window.scrollBy(0, -5);
    } else if (e.touches[0].clientY > viewportHeight - scrollThreshold) {
      window.scrollBy(0, 5);
    }

    // Find potential drop target
    const elementsUnderTouch = document.elementsFromPoint(
      e.touches[0].clientX,
      e.touches[0].clientY
    );

    const targetCard = elementsUnderTouch.find(el => 
      el.matches && el.matches('[data-task-id]') &&
      parseInt(el.dataset.taskId, 10) !== touchedTaskId
    );

    if (targetCard && canDropOn(targetCard)) {
      showDropIndicator(targetCard, e.touches[0].clientY);
    } else {
      hideDropIndicator();
    }
  }

  async function handleTouchEnd(e) {
    if (!touchedTaskId) return;

    const taskCard = document.querySelector(`[data-task-id="${touchedTaskId}"]`);
    if (taskCard) {
      delete taskCard.dataset.touchStartTime;
    }

    if (!touchClone) {
      touchedTaskId = null;
      return;
    }

    const changedTouch = e.changedTouches[0];
    
    // Find drop target
    const elementsUnderTouch = document.elementsFromPoint(
      changedTouch.clientX,
      changedTouch.clientY
    );

    const targetCard = elementsUnderTouch.find(el => 
      el.matches && el.matches('[data-task-id]')
    );

    let reorderSuccess = false;

    if (targetCard && parseInt(targetCard.dataset.taskId, 10) !== touchedTaskId) {
      if (canDropOn(targetCard)) {
        const targetId = parseInt(targetCard.dataset.taskId, 10);
        const rect = targetCard.getBoundingClientRect();
        const isBelow = changedTouch.clientY > rect.top + rect.height / 2;
        
        await performReorder(touchedTaskId, targetId, isBelow);
        reorderSuccess = true;
      }
    }

    cleanupTouch(reorderSuccess);
  }

  function cleanupTouch(reorderSuccess) {
    if (touchClone) {
      touchClone.style.transition = 'all 0.2s ease-out';
      touchClone.style.opacity = '0';
      touchClone.style.transform = 'scale(0.9)';
      setTimeout(() => {
        if (touchClone) touchClone.remove();
        touchClone = null;
      }, 200);
    }

    const taskCard = document.querySelector(`[data-task-id="${touchedTaskId}"]`);
    if (taskCard) {
      if (reorderSuccess) {
        // Flash animation for successful reorder
        taskCard.style.transition = 'background-color 0.3s ease';
        taskCard.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
        setTimeout(() => {
          taskCard.style.backgroundColor = '';
        }, 300);
      }
      taskCard.classList.remove('dragging', 'touch-dragging');
      taskCard.style.transform = originalTransform;
    }

    touchedTaskId = null;
    hideDropIndicator();
  }

  function showDropIndicator(targetCard, clientY) {
    if (!dropIndicator) return;

    const rect = targetCard.getBoundingClientRect();
    const isBelow = clientY > rect.top + rect.height / 2;

    dropIndicator.style.width = `${Math.max(rect.width - 32, 200)}px`;
    dropIndicator.style.left = `${rect.left + 16}px`;
    dropIndicator.style.top = isBelow ? `${rect.bottom - 3}px` : `${rect.top + 1}px`;
    dropIndicator.style.display = 'block';
  }

  function hideDropIndicator() {
    if (dropIndicator) {
      dropIndicator.style.display = 'none';
    }
  }

  function canReorder(taskCard) {
    // Reordering is disabled for completed tasks section
    const section = taskCard.closest('section');
    if (section) {
      const sectionTitle = section.querySelector('h2')?.textContent.toLowerCase() || '';
      if (sectionTitle.includes('completed')) return false;
    }

    // Check if viewing a specific category filter
    const activeFilter = getActiveCategoryFilter();
    const taskCategoryId = getTaskCategoryId(parseInt(taskCard.dataset.taskId, 10));
    
    // Allow reordering if no filter or same category
    if (!activeFilter || activeFilter === taskCategoryId) return true;

    return false;
  }

  function canDropOn(targetCard) {
    if (!draggedElement && !touchedTaskId) return false;
    
    const draggedSection = (draggedElement || document.querySelector(`[data-task-id="${touchedTaskId}"]`))?.closest('section');
    const targetSection = targetCard.closest('section');
    
    // Must be in same section
    if (draggedSection && targetSection && draggedSection !== targetSection) {
      return false;
    }

    const activeFilter = getActiveCategoryFilter();
    const targetCategoryId = getTaskCategoryId(parseInt(targetCard.dataset.taskId, 10));
    
    // Must be in same category if filtered
    if (activeFilter && activeFilter !== targetCategoryId) {
      return false;
    }

    return true;
  }

  function getActiveCategoryFilter() {
    // Check URL params for category filter
    const params = new URLSearchParams(window.location.search);
    const catId = params.get('category_id');
    return catId ? parseInt(catId, 10) : null;
  }

  function getTaskSortOrder(taskId) {
    // Try to get from task-manager state
    if (window.TaskManager && window.TaskManager.state) {
      const task = window.TaskManager.state.tasks.find(t => t.id === taskId);
      return task ? task.sort_order : 0;
    }
    
    // Try app.js state
    if (window.state && window.state.tasks) {
      const task = window.state.tasks.find(t => t.id === taskId);
      return task ? task.sort_order : 0;
    }

    return 0;
  }

  function getTaskCategoryId(taskId) {
    if (window.TaskManager && window.TaskManager.state) {
      const task = window.TaskManager.state.tasks.find(t => t.id === taskId);
      return task ? task.category_id : null;
    }
    
    if (window.state && window.state.tasks) {
      const task = window.state.tasks.find(t => t.id === taskId);
      return task ? task.category_id : null;
    }

    return null;
  }

  function calculateNewSortOrder(draggedId, targetId, isBelow) {
    const currentSortOrder = getTaskSortOrder(draggedId);
    const targetSortOrder = getTaskSortOrder(targetId);

    if (isBelow) {
      return targetSortOrder + 1;
    } else {
      return Math.max(0, targetSortOrder - 1);
    }
  }

  async function performReorder(draggedId, targetId, isBelow) {
    const categoryId = getTaskCategoryId(draggedId);
    const newSortOrder = calculateNewSortOrder(draggedId, targetId, isBelow);

    try {
      await reorderTask(draggedId, newSortOrder, categoryId);
      
      // Refresh tasks to reflect new order
      if (window.TaskManager && window.TaskManager.fetchTasks) {
        await window.TaskManager.fetchTasks();
      } else if (window.loadAll) {
        await window.loadAll();
      } else if (window.location.reload) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Reorder error:', err);
      showToast('Failed to reorder task');
    }
  }

  async function reorderTask(taskId, sortOrder, categoryId) {
    // Use existing API if available
    if (window.api && window.api.reorderTask) {
      return await window.api.reorderTask(taskId, sortOrder, categoryId);
    }

    // Otherwise make direct API call
    const res = await fetch(`${API_BASE}/tasks/${taskId}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sort_order: sortOrder,
        category_id: categoryId 
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reorder task');
    }
    return data;
  }

  function showToast(message) {
    // Use existing toast if available
    if (window.renderToast) {
      window.renderToast(message);
      return;
    }

    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification fixed bottom-4 right-4 bg-slate-800 dark:bg-slate-700 text-white px-4 py-3 rounded-lg shadow-lg z-50 animate-slide-in-right flex items-center gap-2';
    toast.innerHTML = `
      <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function addTouchStyles() {
    if (document.getElementById('touchDragStyles')) return;

    const style = document.createElement('style');
    style.id = 'touchDragStyles';
    style.textContent = `
      .dragging {
        opacity: 0.5 !important;
        transform: rotate(1deg) scale(0.98) !important;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15) !important;
      }
      .touch-dragging {
        opacity: 0.3 !important;
      }
      .drag-over {
        border-color: #3b82f6 !important;
        border-style: dashed !important;
        border-width: 2px !important;
      }
      .drag-image {
        opacity: 0.9;
        transform: rotate(2deg);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }
    `;
    document.head.appendChild(style);
  }

  // Public API
  window.DragDrop = {
    init,
    canReorder,
    canDropOn
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();