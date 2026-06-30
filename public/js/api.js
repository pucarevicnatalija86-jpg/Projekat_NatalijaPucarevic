/**
 * api.js — tanak fetch wrapper koji automatski dodaje JWT u
 * Authorization header i preusmerava na login pri 401 (istekao/nevazeci
 * token). Token se cuva u localStorage (ovo je samostalna web aplikacija
 * koja se pokrece na sopstvenom serveru, ne Claude artifact, pa je
 * localStorage ovde ispravan i standardan izbor).
 */

const Api = (() => {
  const TOKEN_KEY = 'spd_token';
  const USER_KEY = 'spd_user';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      clearSession();
      window.location.href = '/index.html';
      throw new Error('Sesija je istekla. Molimo prijavite se ponovo.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Greska (HTTP ${res.status})`);
    }
    return data;
  }

  function requireLoginOrRedirect() {
    if (!getToken()) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  }

  function requireAdminOrRedirect() {
    const user = getUser();
    if (!user || user.role !== 'administrator') {
      window.location.href = '/dashboard.html';
      return false;
    }
    return true;
  }

  return {
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b),
    put: (p, b) => request('PUT', p, b),
    del: (p) => request('DELETE', p),
    getToken, getUser, setSession, clearSession,
    requireLoginOrRedirect, requireAdminOrRedirect,
  };
})();
