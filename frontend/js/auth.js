/**
 * Authentication Module
 */

const Auth = {
  init() {
    this.bindEvents();
    this.checkSession();
  },

  bindEvents() {
    // Doctor Registration Form
    const docRegForm = document.getElementById('doctor-register-form');
    if (docRegForm) {
      docRegForm.addEventListener('submit', (e) => this.handleDoctorRegister(e));
    }

    // Universal Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }
  },

  checkSession() {
    const user = window.api.getCurrentUser();
    const token = window.api.getToken();

    if (user && token) {
      this.routeToDashboard(user.role);
    } else {
      // Default to landing or login
      const hash = window.location.hash || '#landing';
      App.showView(hash.replace('#', ''));
    }
  },

  routeToDashboard(role) {
    if (role === 'doctor') {
      App.showView('doctor-dashboard');
      DoctorModule.init();
    } else if (role === 'patient') {
      App.showView('patient-dashboard');
      PatientModule.init();
    } else if (role === 'admin') {
      App.showView('admin-dashboard');
      AdminModule.init();
    } else {
      App.showView('landing');
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const errorEl = document.getElementById('login-error-msg');
    errorEl.style.display = 'none';

    const username = form.username.value.trim();
    const password = form.password.value;
    const role = form.role ? form.role.value : null;

    if (!username || !password) {
      this.showError(errorEl, 'Please enter both username and password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Signing in...';

    try {
      const res = await window.api.post('/auth/login', {
        username,
        password,
        expectedRole: role || undefined
      });

      if (res.success) {
        window.api.setToken(res.token);
        window.api.setCurrentUser(res.user);
        App.showAlert('Login successful! Redirecting...', 'success');
        this.routeToDashboard(res.user.role);
      }
    } catch (err) {
      this.showError(errorEl, err.message || 'Login failed. Please check credentials.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Sign In';
    }
  },

  async handleDoctorRegister(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const errorEl = document.getElementById('doc-reg-error-msg');
    const successEl = document.getElementById('doc-reg-success-msg');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (form.password.value !== form.confirmPassword.value) {
      this.showError(errorEl, 'Passwords do not match.');
      return;
    }

    const formData = new FormData(form);

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Submitting Registration...';

    try {
      const res = await window.api.postFormData('/auth/doctor/register', formData);
      if (res.success) {
        successEl.textContent = res.message;
        successEl.style.display = 'block';
        form.reset();
        setTimeout(() => {
          App.showView('login');
        }, 3000);
      }
    } catch (err) {
      this.showError(errorEl, err.message || 'Registration failed.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Complete Registration';
    }
  },

  showError(el, msg) {
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    } else {
      App.showAlert(msg, 'danger');
    }
  },

  // 1-Click Quick Demo Login Helper
  quickLogin(username, password) {
    const userField = document.getElementById('login-username');
    const passField = document.getElementById('login-password');
    if (userField && passField) {
      userField.value = username;
      passField.value = password;
      const form = document.getElementById('login-form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    }
  },

  logout() {
    window.api.clearToken();
    App.showAlert('You have been logged out.', 'info');
    App.showView('landing');
  }
};

window.Auth = Auth;
