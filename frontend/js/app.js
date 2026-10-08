/**
 * App Main Controller - View Routing, Notifications, UI Helpers
 */

const App = {
  currentView: 'landing',
  notifications: [],

  init() {
    window.addEventListener('hashchange', () => this.handleRouting());
    this.handleRouting();
    this.bindGlobalEvents();
    Auth.init();
    ChatModule.init();

    // Poll notifications every 30 seconds if authenticated
    setInterval(() => this.fetchNotifications(), 30000);
  },

  handleRouting() {
    const hash = window.location.hash.replace('#', '') || 'landing';
    this.showView(hash);
  },

  showView(viewName) {
    this.currentView = viewName;

    // Hide all view containers
    document.querySelectorAll('.view-container').forEach(el => {
      el.style.display = 'none';
    });

    // Determine target element
    let target = document.getElementById(`view-${viewName}`);
    if (!target) {
      target = document.getElementById('view-landing');
      viewName = 'landing';
    }

    if (target) {
      target.style.display = 'block';
    }

    // Toggle Sidebar vs Public Navigation
    const sidebar = document.getElementById('app-sidebar');
    const publicNav = document.getElementById('public-nav');
    const mainContent = document.querySelector('.main-content');

    const isDashboard = ['doctor-dashboard', 'patient-dashboard', 'admin-dashboard', 'ai-chat'].includes(viewName);

    if (isDashboard) {
      if (sidebar) sidebar.style.display = 'flex';
      if (publicNav) publicNav.style.display = 'none';
      if (mainContent) mainContent.style.marginLeft = '270px';
      this.updateSidebarNav(viewName);
      this.fetchNotifications();
    } else {
      if (sidebar) sidebar.style.display = 'none';
      if (publicNav) publicNav.style.display = 'flex';
      if (mainContent) mainContent.style.marginLeft = '0';
    }

    // Trigger module lifecycle
    if (viewName === 'doctor-dashboard') DoctorModule.init();
    if (viewName === 'patient-dashboard') PatientModule.init();
    if (viewName === 'admin-dashboard') AdminModule.init();
    if (viewName === 'ai-chat') ChatModule.loadChatHistory();
  },

  updateSidebarNav(activeView) {
    const user = window.api.getCurrentUser();
    if (!user) return;

    // Update User Profile Widget in sidebar
    const avatar = document.getElementById('sidebar-user-avatar');
    const name = document.getElementById('sidebar-user-name');
    const roleTag = document.getElementById('sidebar-user-role');

    if (name) name.textContent = user.name || user.username;
    if (roleTag) roleTag.textContent = user.role.toUpperCase();
    if (avatar) avatar.textContent = (user.name || user.username).charAt(0).toUpperCase();

    // Toggle menu items per role
    document.querySelectorAll('.nav-role-doctor').forEach(el => {
      el.style.display = user.role === 'doctor' ? 'flex' : 'none';
    });
    document.querySelectorAll('.nav-role-patient').forEach(el => {
      el.style.display = user.role === 'patient' ? 'flex' : 'none';
    });
    document.querySelectorAll('.nav-role-admin').forEach(el => {
      el.style.display = user.role === 'admin' ? 'flex' : 'none';
    });

    // Set active link class
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-view') === activeView) {
        link.classList.add('active');
      }
    });
  },

  bindGlobalEvents() {
    // Nav links with data-view
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-view]');
      if (link) {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        window.location.hash = `#${view}`;
      }

      // Close modal on backdrop click
      if (e.target.classList.contains('modal-backdrop')) {
        this.closeAllModals();
      }
    });

    // Notifications toggle
    const notifBtn = document.getElementById('btn-notif-toggle');
    if (notifBtn) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleNotificationsDropdown();
      });
    }

    // Close notifications dropdown on outside click
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('notifications-dropdown');
      if (dropdown && dropdown.classList.contains('show') && !e.target.closest('#notifications-dropdown') && !e.target.closest('#btn-notif-toggle')) {
        dropdown.classList.remove('show');
      }
    });
  },

  async fetchNotifications() {
    const token = window.api.getToken();
    if (!token) return;

    try {
      const res = await window.api.get('/notifications');
      this.notifications = res.notifications || [];
      const badge = document.getElementById('header-notif-badge');
      const list = document.getElementById('notif-dropdown-list');

      if (badge) {
        badge.style.display = res.unreadCount > 0 ? 'block' : 'none';
      }

      if (list) {
        if (this.notifications.length === 0) {
          list.innerHTML = '<p style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No new notifications</p>';
          return;
        }

        list.innerHTML = this.notifications.map(n => `
          <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="App.markNotifRead(${n.id})">
            <div class="notif-title">${n.title}</div>
            <div style="font-size: 0.82rem; color: var(--text-main); margin-bottom: 4px;">${n.message}</div>
            <div class="notif-time">${n.created_at ? n.created_at.substring(0, 16) : ''}</div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.warn('Could not fetch notifications:', err.message);
    }
  },

  toggleNotificationsDropdown() {
    const dropdown = document.getElementById('notifications-dropdown');
    if (dropdown) {
      dropdown.classList.toggle('show');
    }
  },

  async markNotifRead(id) {
    try {
      await window.api.put(`/notifications/${id}/read`, {});
      await this.fetchNotifications();
    } catch (e) {
      console.warn(e);
    }
  },

  async markAllNotifsRead() {
    try {
      await window.api.put('/notifications/read-all', {});
      await this.fetchNotifications();
    } catch (e) {
      console.warn(e);
    }
  },

  showAlert(message, type = 'info') {
    const container = document.getElementById('global-alert-container');
    if (!container) return;

    const alert = document.createElement('div');
    alert.className = `alert-banner ${type}`;
    alert.style.marginBottom = '12px';
    alert.innerHTML = `
      <span>${message}</span>
      <button style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:inherit;" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(alert);

    setTimeout(() => {
      alert.remove();
    }, 5000);
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  },

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
  },

  showLoading(show) {
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
  },

  // Markdown Formatter for AI responses
  formatMarkdown(text) {
    if (!text) return '';
    let html = text;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');

    // Bold & Italics
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Bullet lists
    html = html.replace(/^\s*[\-\*]\s+(.*)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>');

    // Code blocks & inline code
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

    // Tables
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHtml = '<div class="table-container"><table>';
          // Header row
          const cells = line.split('|').filter(c => c !== '');
          tableHtml += '<thead><tr>' + cells.map(c => `<th>${c.trim()}</th>`).join('') + '</tr></thead><tbody>';
        } else if (line.includes('---')) {
          // Separator row, skip
          continue;
        } else {
          // Data row
          const cells = line.split('|').filter(c => c !== '');
          tableHtml += '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
        }
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</tbody></table></div>';
          newLines.push(tableHtml);
          tableHtml = '';
        }
        newLines.push(line);
      }
    }
    if (inTable) {
      tableHtml += '</tbody></table></div>';
      newLines.push(tableHtml);
    }

    html = newLines.join('<br>');
    return html;
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
