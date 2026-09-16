const WORKOUT = (() => {
  let active = null; // {name, startedAt, exercises:[{name}]}
  let timerInterval = null;
  let cache = [];

  async function init() {
    document.getElementById('newWorkoutBtn').addEventListener('click', startNew);
    document.getElementById('addExerciseBtn').addEventListener('click', addExercise);
    document.getElementById('exerciseNameInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') addExercise();
    });
    document.getElementById('finishWorkoutBtn').addEventListener('click', finish);
    await refresh();
  }

  async function refresh() {
    try {
      cache = await API.getWorkouts();
    } catch (e) { cache = []; }
    renderHistory();
  }

  function startNew() {
    if (active) return;
    active = { name: 'Sesi ' + new Date().toLocaleDateString('id-ID', { weekday: 'long' }), startedAt: Date.now(), exercises: [] };
    document.getElementById('activeWorkoutBox').style.display = 'block';
    document.getElementById('newWorkoutBtn').style.display = 'none';
    document.getElementById('activeWorkoutName').textContent = active.name;
    renderExercises();
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
  }

  function updateTimer() {
    if (!active) return;
    const s = Math.floor((Date.now() - active.startedAt) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    document.getElementById('activeWorkoutTimer').textContent = `${mm}:${ss}`;
  }

  function addExercise() {
    const input = document.getElementById('exerciseNameInput');
    const name = input.value.trim();
    if (!name || !active) return;
    active.exercises.push({ name });
    input.value = '';
    renderExercises();
  }

  function renderExercises() {
    const box = document.getElementById('exerciseList');
    box.innerHTML = '';
    active.exercises.forEach(ex => {
      const row = document.createElement('div');
      row.className = 'exercise-row';
      row.innerHTML = `<span>${escapeHtml(ex.name)}</span>`;
      box.appendChild(row);
    });
  }

  async function finish() {
    if (!active) return;
    clearInterval(timerInterval);
    const durationMin = Math.max(1, Math.round((Date.now() - active.startedAt) / 60000));
    const payload = { name: active.name, date: API.todayISO(), durationMin, exercises: active.exercises };

    active = null;
    document.getElementById('activeWorkoutBox').style.display = 'none';
    document.getElementById('newWorkoutBtn').style.display = 'inline-block';
    document.getElementById('exerciseList').innerHTML = '';

    try {
      await API.addWorkout(payload);
      await refresh();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      alert('Gagal menyimpan sesi latihan: ' + e.message);
    }
  }

  function renderHistory() {
    const box = document.getElementById('workoutHistory');
    if (!cache.length) {
      box.innerHTML = '<p class="empty-note">Belum ada sesi latihan tercatat.</p>';
      return;
    }
    box.innerHTML = '';
    cache.slice(0, 30).forEach(w => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="h-left">
          <strong>${escapeHtml(w.name)}</strong>
          <span>${formatDate(w.date)} · ${w.exercises.length} latihan</span>
        </div>
        <div class="h-right">${w.durationMin}<small>menit</small></div>`;
      box.appendChild(el);
    });
  }

  function countThisWeek() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return cache.filter(w => new Date(w.date) >= weekAgo).length;
  }

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  return { init, countThisWeek, refresh, getCache: () => cache };
})();
