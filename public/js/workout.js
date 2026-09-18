const WORKOUT = (() => {
  let active = null;        // {name, startedAt, idx, exercises:[{name, anim, cue, sets, reps, weight, rest, done}]}
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
    return refresh();
  }

  function programIntensity() {
    const st = status;
    return (st && st.program && st.program.intensity) || 'menengah';
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
    const lvl = intensityLevel(p.intensity);
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
      <p class="program-title">${eh(info.title || p.program)}<small>${eh(info.tagline || '')} · Intensitas ${eh(lvl.label)}</small></p>
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
    const todayISO = API.todayISO();
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
    return getTodaySplit(daysBetween(st.program.programStart, API.todayISO()));
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
    const intensity = st.program.intensity;
    const lvl = intensityLevel(intensity);

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

    const routine = getDayRoutine(split.day, program, intensity);
    const todayMark = (!viewDay || viewDay === (todaySplitDay() || {}).day) ? ' · Hari ini' : '';
    box.innerHTML = `
      <div class="session-head">
        <span class="day-chip">HARI ${split.day}</span>
        <div><strong>${eh(split.label)}</strong><small>${eh(split.goal)}${todayMark}</small></div>
      </div>
      <p class="rest-text">${eh(lvl.weightNote)} · ${eh(lvl.rest)}</p>
      <ul class="routine-list">
        ${routine.map(r => `<li><span>${eh(r.name)}</span><em>${r.sets} × ${eh(r.reps)}</em></li>`).join('')}
      </ul>
      <button id="startTodayBtn" class="cta-btn"><svg class="ic"><use href="#i-play"/></svg> Mulai Latihan Ini</button>`;

    document.getElementById('startTodayBtn').addEventListener('click', () => startSession(split, routine));
  }

  /* ================= Player sesi aktif ================= */
  function startSession(split, routine) {
    if (active) return;
    active = {
      name: `Day ${split.day} · ${split.label}`,
      startedAt: Date.now(),
      idx: 0,
      exercises: routine.map(r => ({ ...r, done: false }))
    };
    document.getElementById('activeWorkoutBox').style.display = 'block';
    document.getElementById('activeWorkoutName').textContent = active.name;
    document.getElementById('activeWorkoutBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
    renderPlayer();
  }

  function updateTimer() {
    if (!active) return;
    const s = Math.floor((Date.now() - active.startedAt) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    document.getElementById('activeWorkoutTimer').textContent = `${mm}:${ss}`;
  }

  function renderPlayer() {
    const box = document.getElementById('exercisePlayer');
    const list = active.exercises;
    const idx = active.idx;
    const ex = list[idx];
    const isLast = idx === list.length - 1;
    const total = list.length;

    const progress = list.map((e, i) =>
      `<span class="pp-dot ${e.done ? 'done' : ''}${i === idx ? ' here' : ''}"></span>`).join('');

    box.innerHTML = `
      <div class="player-count"><span>Gerakan ${idx + 1} dari ${total}</span></div>
      <div class="player-progress">${progress}</div>
      <div class="demo-wrap">${exerciseDemoSVG(ex.anim)}</div>
      <h3 class="player-name">${eh(ex.name)}</h3>
      <p class="player-tag">Ikuti irama pelan, utamakan teknik</p>
      <div class="player-meta">
        <span class="pm-chip">${ex.sets} × ${eh(ex.reps)}</span>
        <span class="pm-chip soft">Beban ${ex.weight[0]}–${ex.weight[1]} kg</span>
        <span class="pm-chip soft">${eh(ex.rest)}</span>
      </div>
      <p class="player-cue">${eh(ex.cue)}</p>
      <div class="player-nav">
        <button id="prevExBtn" class="pill-btn ghost" ${idx === 0 ? 'disabled' : ''}><svg class="ic"><use href="#i-arrow"/></svg> Kembali</button>
        <button id="nextExBtn" class="cta-btn">${isLast ? 'Selesai & Simpan' : 'Lanjut'}</button>
      </div>
      <button id="quitSessionBtn" class="player-quit">Selesai lebih awal</button>`;

    const prev = document.getElementById('prevExBtn');
    if (prev && idx > 0) prev.addEventListener('click', () => { active.idx--; renderPlayer(); });
    document.getElementById('nextExBtn').addEventListener('click', goNext);
    document.getElementById('quitSessionBtn').addEventListener('click', finish);
  }

  function goNext() {
    if (!active) return;
    const list = active.exercises;
    if (active.idx >= list.length - 1) {
      list[active.idx].done = true;
      finish();
      return;
    }
    list[active.idx].done = true;
    active.idx++;
    renderPlayer();
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
        doneSets: ex.done ? (ex.sets || 1) : 0
      }))
    };

    active = null;
    document.getElementById('activeWorkoutBox').style.display = 'none';
    document.getElementById('exercisePlayer').innerHTML = '';

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