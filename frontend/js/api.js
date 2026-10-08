/**
 * Frontend API Service Layer
 * Manages JWT tokens, authenticated requests, and centralized error handling
 */

const API_BASE = '/api';

class ApiService {
  getToken() {
    return localStorage.getItem('med_auth_token');
  }

  setToken(token) {
    localStorage.setItem('med_auth_token', token);
  }

  clearToken() {
    localStorage.removeItem('med_auth_token');
    localStorage.removeItem('med_auth_user');
  }

  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('med_auth_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  }

  setCurrentUser(user) {
    localStorage.setItem('med_auth_user', JSON.stringify(user));
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = options.headers || {};

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    options.headers = headers;

    try {
      const response = await fetch(url, options);

      // Handle 401 Unauthorized (session expired)
      if (response.status === 401) {
        this.clearToken();
        if (!window.location.pathname.includes('login') && !endpoint.includes('/auth/login')) {
          window.location.hash = '#login';
          window.location.reload();
        }
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  postFormData(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData
    });
  }
}

window.api = new ApiService();
