/* API client for BQ Fitness backend */
const API = (() => {
  const BASE = '/api';
  let token = localStorage.getItem('bq_token') || null;
  let currentUser = JSON.parse(localStorage.getItem('bq_user') || 'null');

  function setSession(t, user) {
    token = t; currentUser = user;
    localStorage.setItem('bq_token', t);
    localStorage.setItem('bq_user', JSON.stringify(user));
  }
  function clearSession() {
    token = null; currentUser = null;
    localStorage.removeItem('bq_token');
    localStorage.removeItem('bq_user');
  }
  function isAuthed() { return !!token; }
  function getUser() { return currentUser; }

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      if (res.status === 401) clearSession();
      throw new Error(data.error || 'Terjadi kesalahan jaringan.');
    }
    return data;
  }

  // ---- auth ----
  async function register(name, email, password) {
    const data = await request('POST', '/auth/register', { name, email, password });
    setSession(data.token, data.user);
    return data.user;
  }
  async function login(email, password) {
    const data = await request('POST', '/auth/login', { email, password });
    setSession(data.token, data.user);
    return data.user;
  }
  async function fetchMe() {
    const data = await request('GET', '/auth/me');
    currentUser = data.user;
    localStorage.setItem('bq_user', JSON.stringify(data.user));
    return data.user;
  }
  function logout() { clearSession(); }

  // ---- profile ----
  async function saveProfile(profile) {
    const data = await request('PUT', '/profile', profile);
    currentUser = data.user;
    localStorage.setItem('bq_user', JSON.stringify(data.user));
    return data.user;
  }

  // ---- workouts ----
  async function getWorkouts() { return (await request('GET', '/workouts')).workouts; }
  async function addWorkout(w) { return (await request('POST', '/workouts', w)).workout; }
  async function deleteWorkout(id) { return request('DELETE', '/workouts/' + id); }

  // ---- activities ----
  async function getActivities() { return (await request('GET', '/activities')).activities; }
  async function addActivity(a) { return (await request('POST', '/activities', a)).activity; }
  async function deleteActivity(id) { return request('DELETE', '/activities/' + id); }

  // ---- food ----
  async function getFoodLogs(date) {
    const q = date ? '?date=' + encodeURIComponent(date) : '';
    return (await request('GET', '/food/logs' + q)).logs;
  }
  async function addFoodLog(entry) { return (await request('POST', '/food/logs', entry)).log; }
  async function deleteFoodLog(id) { return request('DELETE', '/food/logs/' + id); }
  async function getFoodGoal() { return (await request('GET', '/food/goal')).goal; }
  async function saveFoodGoal(g) { return (await request('PUT', '/food/goal', g)).goal; }

  // ---- sleep ----
  async function getSleepLogs() { return (await request('GET', '/sleep')).logs; }
  async function addSleepLog(s) { return (await request('POST', '/sleep', s)).log; }
  async function deleteSleepLog(id) { return request('DELETE', '/sleep/' + id); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  return {
    isAuthed, getUser, register, login, fetchMe, logout, saveProfile,
    getWorkouts, addWorkout, deleteWorkout,
    getActivities, addActivity, deleteActivity,
    getFoodLogs, addFoodLog, deleteFoodLog, getFoodGoal, saveFoodGoal,
    getSleepLogs, addSleepLog, deleteSleepLog,
    uid, todayISO
  };
})();
