/* API client for BQ Fitness backend */
const API = (() => {
  const BASE = '/api';
  let session = JSON.parse(localStorage.getItem('bq_session') || 'null');
  let currentUser = JSON.parse(localStorage.getItem('bq_user') || 'null');

  function setSession(s, user) {
    session = s;
    if (user !== undefined) currentUser = user;
    if (s) localStorage.setItem('bq_session', JSON.stringify(s));
    else localStorage.removeItem('bq_session');
    if (currentUser) localStorage.setItem('bq_user', JSON.stringify(currentUser));
  }
  function clearSession() {
    session = null; currentUser = null;
    localStorage.removeItem('bq_session');
    localStorage.removeItem('bq_user');
  }
  function isAuthed() { return !!session && !!session.access_token; }
  function getUser() { return currentUser; }

  async function refreshSession() {
    if (!session || !session.refresh_token) return false;
    let data = {};
    try {
      const res = await fetch(BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      data = await res.json();
      if (!res.ok || !data.session) return false;
    } catch (e) {
      return false;
    }
    setSession(data.session, data.user || currentUser);
    return true;
  }

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (session && session.access_token) headers['Authorization'] = 'Bearer ' + session.access_token;
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }

    if (res.status === 401 && !path.startsWith('/auth/refresh') && session && session.refresh_token) {
      // access token kedaluwarsa: coba refresh sekali lalu ulangi permintaan
      if (await refreshSession()) return request(method, path, body);
      clearSession();
      throw new Error('Sesi berakhir. Silakan login kembali.');
    }
    if (!res.ok) {
      throw new Error(data.error || 'Terjadi kesalahan jaringan.');
    }
    return data;
  }

  // ---- auth ----
  async function register(name, email, password) {
    const data = await request('POST', '/auth/register', { name, email, password });
    setSession(data.session, data.user);
    return data.user;
  }
  async function login(email, password) {
    const data = await request('POST', '/auth/login', { email, password });
    setSession(data.session, data.user);
    return data.user;
  }
  async function fetchMe() {
    const data = await request('GET', '/auth/me');
    currentUser = data.user;
    localStorage.setItem('bq_user', JSON.stringify(data.user));
    return data.user;
  }
  async function logout() {
    const snapshot = session;
    clearSession();
    if (snapshot && snapshot.refresh_token) {
      try {
        await fetch(BASE + '/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + snapshot.access_token
          },
          body: JSON.stringify({ refresh_token: snapshot.refresh_token })
        });
      } catch (e) { /* offline: sesi lokal sudah dibersihkan */ }
    }
  }
  async function resetPassword(email) { return request('POST', '/auth/reset-password', { email }); }
  async function updatePassword(accessToken, password) {
    return request('POST', '/auth/update-password', { access_token: accessToken, password });
  }

  // ---- profile ----
  async function saveProfile(profile) {
    const data = await request('PUT', '/profile', profile);
    currentUser = data.user;
    localStorage.setItem('bq_user', JSON.stringify(data.user));
    return data.user;
  }

  function setUser(user) {
    if (!user) return;
    currentUser = user;
    localStorage.setItem('bq_user', JSON.stringify(user));
  }

  // ---- program ----
  async function getProgram() { return request('GET', '/program'); }
  async function onboard(payload) {
    const data = await request('POST', '/program/onboard', payload);
    setUser(data.user);
    return data;
  }
  async function updateWeight(weightKg) {
    const data = await request('POST', '/program/weight', { weight: weightKg });
    setUser(data.user);
    return data;
  }
  async function switchProgram(payload) {
    const data = await request('POST', '/program/switch', payload);
    setUser(data.user);
    return data;
  }
  async function saveSchedule(days) {
    const data = await request('PUT', '/program/schedule', { days });
    setUser(data.user);
    return data;
  }
  async function saveIntensity(intensity) {
    const data = await request('PUT', '/program/intensity', { intensity });
    setUser(data.user);
    return data;
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
  async function deleteSleepLog(id) { return (await request('DELETE', '/sleep/' + id)); }

  // ---- AI ----
  async function getMealRecommend() { return request('GET', '/ai/meal'); }
  async function refreshMealRecommend() { return request('POST', '/ai/meal/refresh'); }
  async function getDailyAdvice() { return request('GET', '/ai/advice'); }
  async function getProgramRationale(params) {
    const qs = params ? '?' + Object.entries(params).map(([k, v]) => {
      if (v === undefined || v === null || v === '') return null;
      return encodeURIComponent(k) + '=' + encodeURIComponent(v);
    }).filter(Boolean).join('&') : '';
    return request('GET', '/ai/program' + qs);
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  return {
    isAuthed, getUser, register, login, fetchMe, logout, saveProfile, setUser,
    resetPassword, updatePassword,
    getProgram, onboard, updateWeight, switchProgram, saveSchedule, saveIntensity,
    getWorkouts, addWorkout, deleteWorkout,
    getActivities, addActivity, deleteActivity,
    getFoodLogs, addFoodLog, deleteFoodLog, getFoodGoal, saveFoodGoal,
    getSleepLogs, addSleepLog, deleteSleepLog,
    getMealRecommend, refreshMealRecommend, getDailyAdvice, getProgramRationale,
    uid, todayISO
  };
})();
