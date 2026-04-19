/**
 * TaskFlow — Dashboard Module
 * Statistics, weekly progress visualization, and dashboard metrics.
 */

(function () {
  "use strict";

  const API_BASE = "/api";

  /**
   * Fetches dashboard statistics (counts, overdue, etc.)
   */
  async function fetchStats() {
    try {
      const res = await fetch(`${API_BASE}/stats/dashboard`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      return data.data;
    } catch (err) {
      console.error("Dashboard stats error:", err);
      return null;
    }
  }

  /**
   * Fetches weekly completion stats for the chart
   */
  async function fetchWeeklyStats(offset = 0) {
    try {
      const res = await fetch(`${API_BASE}/stats/weekly?week_offset=${offset}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      return data.data;
    } catch (err) {
      console.error("Weekly stats error:", err);
      return null;
    }
  }

  /**
   * Renders dashboard header badges and summary progress bar.
   * Called by app.js render() loop.
   */
  window.renderDashboardWidgets = function (stats) {
    if (!stats) return;

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const setProgress = (id, pct) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.width = `${pct}%`;
        el.classList.remove("transition-none");
        el.classList.add("transition-all", "duration-1000", "ease-out");
      }
    };

    // Update badges
    setText("todayCount", stats.today || 0);
    setText("overdueCount", stats.overdue || 0);
    setText("weekCompleted", stats.week_completed || 0);
    setText("weekTotal", stats.week_total || 0);

    // Animate progress bar
    const rate = stats.week_total > 0 
      ? Math.round((stats.week_completed / stats.week_total) * 100) 
      : 0;
    setProgress("weekProgress", rate);
    
    // Update percentage display if exists
    const rateEl = document.getElementById("completionRate");
    if (rateEl) rateEl.textContent = `${rate}%`;
  };

  /**
   * Renders the 7-bar weekly chart with day-by-day completion stats.
   * Highlights the current day and includes summary metrics.
   */
  window.renderWeeklyView = function (weekly) {
    const container = document.getElementById("taskArea");
    if (!container || !weekly || !weekly.days) return;

    const days = weekly.days;
    const weekStart = new Date(weekly.week_start || Date.now());

    // Calculate aggregate stats from weekly data for the footer
    const totalWeekTasks = days.reduce((sum, d) => sum + (d.total || 0), 0);
    const totalWeekCompleted = days.reduce((sum, d) => sum + (d.completed || 0), 0);
    const weekRate = totalWeekTasks > 0 ? Math.round((totalWeekCompleted / totalWeekTasks) * 100) : 0;

    // Build navigation header
    let html = `
      <div class="flex items-center justify-between mb-6">
        <button onclick="window.__weeklyNav(-1)" class="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-sm font-medium text-slate-600 dark:text-slate-300">← Prev Week</button>
        <div class="text-center">
          <h2 class="text-lg font-bold text-slate-800 dark:text-slate-200">Weekly Progress</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">Week of ${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <button onclick="window.__weeklyNav(1)" class="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-sm font-medium text-slate-600 dark:text-slate-300">Next Week →</button>
      </div>
    `;

    // Build 7-bar chart
    // Find max value to scale bars dynamically, minimum 5 to avoid flat lines
    const maxVal = Math.max(...days.map(d => d.completed || 0), 5);

    html += `
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <div class="flex items-end justify-between h-56 gap-2 sm:gap-4 relative">
    `;

    days.forEach((day) => {
      const heightPct = day.total > 0 ? (day.completed / day.total) * 100 : 0;
      const barHeight = (day.completed / maxVal) * 100;
      const isToday = day.today;
      
      // Style for active/normal days
      const activeColor = isToday ? "bg-blue-500" : "bg-slate-400 dark:bg-slate-600";
      const barBg = isToday ? "bg-blue-50 dark:bg-blue-900/20" : "bg-slate-100 dark:bg-slate-700/50";
      const labelClass = isToday ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-500 dark:text-slate-400";

      html += `
        <div class="flex-1 flex flex-col items-center group cursor-default">
          <!-- Bar Container -->
          <div class="w-full max-w-[48px] h-full rounded-t-xl ${barBg} relative flex items-end overflow-hidden transition-all duration-300 hover:opacity-80">
            <!-- Completion Bar -->
            <div class="w-full ${activeColor} rounded-t-xl transition-all duration-1000 ease-out" 
                 style="height: ${barHeight}%"></div>
          </div>
          <!-- Day Label -->
          <div class="mt-3 text-xs uppercase tracking-wide ${labelClass}">${day.name.substring(0, 3)}</div>
          <!-- Date/Count Label -->
          <div class="text-[10px] text-slate-400 mt-1">${day.date} <span class="mx-1">·</span>${day.completed}/${day.total}</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    // Summary Cards Footer
    html += `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex items-center justify-between animate-fade-in">
          <div>
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Tasks</div>
            <div class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">${totalWeekTasks}</div>
          </div>
          <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
          </div>
        </div>
        
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex items-center justify-between animate-fade-in" style="animation-delay: 50ms">
          <div>
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed</div>
            <div class="text-2xl font-bold text-green-500 mt-1">${totalWeekCompleted}</div>
          </div>
          <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-500">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
        </div>
        
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex items-center justify-between animate-fade-in" style="animation-delay: 100ms">
          <div>
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completion Rate</div>
            <div class="text-2xl font-bold text-blue-500 mt-1">${weekRate}%</div>
          </div>
          <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  };

  console.log("[dashboard] Module initialized.");
})();