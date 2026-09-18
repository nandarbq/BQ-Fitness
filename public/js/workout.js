const WORKOUT = (() => {
  let active = null;        // {name, startedAt, exercises:[{name, sets, reps, doneSets}]}
  let timerInterval = null;
  let cache = [];
  let status = null;        // hasil GET /program
  let goals = null;

  function programStatus() {
    return status || { needsProgram: true, program: null };
  }
  function setProgram(response, g) {
    status = (response && response.program) ? response : { needsProgram: true, program: null };
    goals = g || null;
  }

  async function refresh() {
    try {
      cache = await API.getWorkouts();
    } catch (e) { cache = []; }
    try {
      const data = await API.getProgram();
      status = data;
      goals = data.goals || null;
    } catch (e) {
      status = { needsProgram: true, program: null };
      goals = null;
    }
    renderAll();
  }

  function renderAll() {
    renderProgramCard();
    renderSplitWeek();
    renderToday();
    renderHistory();
  }

  function init() {
    document.getElementById('addExerciseBtn').addEventListener('click', addExercise);
    document.getElementById('exerciseNameInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') addExercise();
    });
    document.getElementById('finishWorkoutBtn').addEventListener('click', finish);
    return refresh();
  }

  /* ================= Program card ================= */
  function renderProgramCard() {
    const box = document.getElementById('programCard');
    const st = status;
    if (!st || !st.program) {
      box.innerHTML = `
        <div class="program-head"><span class="program-chip warn">BELUM ADA PROGRAM</span></div>
        <p class="program-title">Mulai program bulking/cutting-mu<small>Aplikasi akan pilihkan program yang tepat dari BB & TB-mu.</small></p>
        <p class="program-desc">Ikuti panduan singkat untuk menentukan target berat, durasi ideal, dan target makan otomatis.</p>
        <button id="openOnboardBtn" class="cta-btn"><svg class="ic"><use href="#i-plus"/></svg> Mulai Program</button>`;
      document.getElementById('openOnboardBtn').addEventListener('click', () => ONBOARDING.start());
      return;
    }

    const p = st.program;
    const info = PROGRAM_INFO[p.program] || {};
    let extra = '';
    if (p.targetReached) {
      extra = `<button id="progTransitionBtn" class="pill-btn success">Target tercapai! Lanjut program berikutnya</button>`;
    } else if (p.timeUp) {
      extra = `<p class="program-warn">Waktu program sudah habis tapi target belum tercapai. Perbarui BB & evaluasi target.</p>`;
    }

    box.innerHTML = `
      <div class="program-head">
        <span class="program-chip">${eh((p.program || '').toUpperCase())}</span>
        <span class="program-week">${p.durationWeeks ? `Minggu ke-${Math.min(p.elapsedWeeks + 1, p.durationWeeks)} dari ${p.durationWeeks}` : 'Program aktif'}</span>
      </div>
      <p class="program-title">${eh(info.title || p.program)}<small>${eh(info.tagline || '')}</small></p>
      <div class="progress-track"><div class="progress-fill" style="width:${p.progressPct}%"></div></div>
      <div class="program-stats">
        <div class="p-stat"><span>BB sekarang</span><b>${fmtKg(p.currentWeight)}</b></div>
        <div class="p-stat"><span>Target</span><b>${fmtKg(p.targetWeight)}</b></div>
        <div class="p-stat"><span>Kalori</span><b>${goals ? Math.round(goals.cal) : '—'} kkal</b></div>
        <div class="p-stat"><span>BMI</span><b>${p.bmi}</b></div>
      </div>
      <div class="program-why">${p.targetWeight ? `Progress menuju target: <b>${p.progressPct}%</b>. Perjalanan: <b>${p.startWeight} kg</b> → <b>${p.targetWeight} kg</b>.` : ''}</div>
      ${extra}
      <button id="openWeeklyWeightBtn" class="pill-btn ghost"><svg class="ic"><use href="#i-target"/></svg> Perbarui BB mingguan</button>`;

    const openWw = document.getElementById('openWeeklyWeightBtn');
    if (openWw) openWw.addEventListener('click', () => ONBOARDING.showWeekly());
    const transBtn = document.getElementById('progTransitionBtn');
    if (transBtn) transBtn.addEventListener('click', () => ONBOARDING.showTransition(p));
  }

  /* ================= Weekly split ================= */
  function splitStartDate() {
    const st = status;
    return (st && st.program && st.program.programStart) ? st.program.programStart : null;
  }

  function renderSplitWeek() {
    const box = document.getElementById('splitWeek');
    box.innerHTML = '';
    const start = splitStartDate();
    if (!start) {
      box.innerHTML = '<p class="empty-note">Aktifkan program dulu untuk melihat pelan mingguan.</p>';
      return;
    }
    const todayISO = localTodayISO();
    WORKOUT_SPLIT.forEach((s, i) => {
      const date = addDays(start, i);
      const wk = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' });
      const cell = document.createElement('div');
      cell.className = 'split-cell' + (date === todayISO ? ' is-today' : '');
      cell.innerHTML = `
        <span class="split-day">HARI ${s.day}</span>
        <span class="split-weekday">${wk}</span>
        <strong>${eh(s.label)}</strong>
        <small>${eh(s.goal)}</small>`;
      cell.addEventListener('click', () => renderToday(s.day, { previewMode: true }));
      box.appendChild(cell);
    });
  }

  /* ================= Today's session ================= */
  function todaySplitDay() {
    const st = status;
    if (!st || !st.program || !st.program.programStart) return null;
    return getTodaySplit(daysBetween(st.program.programStart, localTodayISO()));
  }

  function renderToday(viewDay, opts) {
    const box = document.getElementById('todaySessionCard');
    const st = status;
    if (!st || !st.program) {
      box.innerHTML = '<p class="empty-note">Aktifkan program dulu — nanti ada porsi latihan otomatis sesuai hari.</p>';
      return;
    }
    const day = viewDay || (todaySplitDay() || {}).day || 1;
    const split = WORKOUT_SPLIT.find(s => s.day === day) || WORKOUT_SPLIT[0];
    const program = st.program.program;

    if (split.type === 'rest') {
      box.innerHTML = `
        <div class="session-head"><span class="day-chip">HARI ${split.day}</span><div><strong>${eh(split.label)}</strong><small>${eh(split.goal)}</small></div></div>
        <p class="rest-text">Hari pemulihan — hasil latihan justru terbentuk saat otot beristirahat. Cukup aktif ringan & jaga makan.
          ${goals ? `Target kalori hari ini <b>${Math.round(goals.cal)} kkal</b> tetap berjalan untuk program ${program}.` : ''}</p>`;
      return;
    }
    if (split.type === 'cardio') {
      box.innerHTML = `
        <div class="session-head"><span class="day-chip">HARI ${split.day}</span><div><strong>${eh(split.label)}</strong><small>${eh(split.goal)}</small></div></div>
        <p class="rest-text">${eh(getCardioSuggestion(program))}</p>
        <button id="startCardioBtn" class="cta-btn"><svg class="ic"><use href="#i-activity"/></svg> Mulai Kardio Ringan</button>`;
      const btn = document.getElementById('startCardioBtn');
      if (btn) btn.addEventListener('click', () => NAV.showView('view-run'));
      return;
    }

    const routine = getDayRoutine(split.day, program);
    const todayMark = (!viewDay || viewDay === (todaySplitDay() || {}).day) ? ' · Hari ini' : '';
    box.innerHTML = `
      <div class="session-head">
        <span class="day-chip">HARI ${split.day}</span>
        <div><strong>${eh(split.label)}</strong><small>${eh(split.goal)}${todayMark}</small></div>
      </div>
      <ul class="routine-list">
        ${routine.map(r => `<li><span>${eh(r.name)}</span><em>${r.sets} × ${eh(r.reps)}</em></li>`).join('')}
      </ul>
      <button id="startTodayBtn" class="cta-btn"><svg class="ic"><use href="#i-play"/></svg> Mulai Latihan Ini</button>`;

    document.getElementById('startTodayBtn').addEventListener('click', () => startSession(split, routine));
  }

  /* ================= Active session ================= */
  function startSession(split, routine) {
    if (active) return;
    active = {
      name: `Day ${split.day} · ${split.label}`,
      startedAt: Date.now(),
      exercises: routine.map(r => ({ name: r.name, sets: r.sets, reps: r.reps, doneSets: 0 }))
    };
    document.getElementById('activeWorkoutBox').style.display = 'block';
    document.getElementById('activeWorkoutName').textContent = active.name;
    document.getElementById('activeWorkoutBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    active.exercises.push({ name, sets: 0, reps: '', doneSets: 0 });
    input.value = '';
    renderExercises();
  }

  function clickSet(ex, idx) {
    const total = ex.sets || 1;
    if (idx < ex.doneSets) {
      ex.doneSets = Math.min(idx, total);
    } else {
      const tap = idx + 1;
      ex.doneSets = (ex.doneSets === tap && tap === total) ? total - 1 : Math.min(tap, total);
    }
    renderExercises();
  }

  function toggleCustom(ex) {
    // gerakan bebas tanpa set: cuma centang selesai
    ex.doneSets = ex.doneSets ? 0 : 1;
    renderExercises();
  }

  function renderExercises() {
    const box = document.getElementById('exerciseList');
    box.innerHTML = '';
    active.exercises.forEach((ex, i) => {
      const row = document.createElement('div');
      row.className = 'exercise-row';
      if (ex.sets > 0) {
        let dots = '';
        for (let s = 1; s <= ex.sets; s++) {
          dots += `<button class="set-dot${s <= ex.doneSets ? ' done' : ''}" data-i="${s - 1}">${s}</button>`;
        }
        row.innerHTML = `
          <div class="ex-track-info">
            <strong>${eh(ex.name)}</strong>
            <span>${ex.sets} × ${eh(ex.reps)}</span>
          </div>
          <div class="set-track">${dots}</div>`;
        row.querySelectorAll('.set-dot').forEach(btn => {
          btn.addEventListener('click', () => clickSet(ex, Number(btn.dataset.i)));
        });
      } else {
        row.innerHTML = `
          <div class="ex-track-info"><strong>${eh(ex.name)}</strong><span>Set bebas</span></div>
          <button class="set-dot${ex.doneSets ? ' done' : ''}" data-i="0">✓</button>`;
        row.querySelector('.set-dot').addEventListener('click', () => toggleCustom(ex));
      }
      box.appendChild(row);
    });
  }

  async function finish() {
    if (!active) return;
    clearInterval(timerInterval);
    const durationMin = Math.max(1, Math.round((Date.now() - active.startedAt) / 60000));
    const payload = {
      name: active.name,
      date: API.todayISO(),
      durationMin,
      exercises: active.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets || null,
        reps: ex.reps || null,
        doneSets: ex.doneSets || 0
      }))
    };

    active = null;
    document.getElementById('activeWorkoutBox').style.display = 'none';
    document.getElementById('exerciseList').innerHTML = '';

    try {
      await API.addWorkout(payload);
      await refresh();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      alert('Gagal menyimpan sesi latihan: ' + e.message);
    }
  }

  /* ================= History ================= */
  function renderHistory() {
    const box = document.getElementById('workoutHistory');
    if (!cache.length) {
      box.innerHTML = '<p class="empty-note">Belum ada sesi latihan tercatat.</p>';
      return;
    }
    box.innerHTML = '';
    cache.slice(0, 30).forEach(w => {
      const done = Array.isArray(w.exercises) ? w.exercises.filter(e => e.doneSets > 0).length : 0;
      const sub = w.exercises && w.exercises.length
        ? `${done}/${w.exercises.length} gerakan selesai`
        : `${w.exercises ? w.exercises.length : 0} gerakan`;
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="h-left">
          <strong>${escapeHtml(w.name)}</strong>
          <span>${formatDate(w.date)} · ${sub}</span>
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

  /* ================= Utils ================= */
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  const eh = escapeHtml;
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }
  function fmtKg(v) { return v ? (Math.round(v * 10) / 10).toFixed(1) + ' kg' : '—'; }

  function localTodayISO() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + n);
    return new Date(utc).toISOString().slice(0, 10);
  }
  function daysBetween(startISO, endISO) {
    const s = new Date(startISO + 'T00:00:00');
    const e = new Date(endISO + 'T00:00:00');
    return Math.round((Date.UTC(e.getFullYear(), e.getMonth(), e.getDate())
      - Date.UTC(s.getFullYear(), s.getMonth(), s.getDate())) / 86400000);
  }

  return { init, countThisWeek, refresh, getCache: () => cache, programStatus, setProgram };
})();