const WORKOUT = (() => {
  let active = null;        // {name, startedAt, idx, exercises:[{name, anim, cue, sets, reps, weight, rest, done}]}
  let timerInterval = null;
  let cache = [];
  let status = null;        // hasil GET /program
  let goals = null;
  let scheduleRest = [];    // state editor jadwal (hari rest yang sedang diedit)
  const MIN_SCHEDULE_REST = 1;
  const MAX_SCHEDULE_REST = 6;
  const PENDING_KEY = 'bq_pending_workout';
  let pending = null;       // sesi belum selesai yang bisa dilanjutkan
  let undo = null;          // latihan terakhir yang dihapus (untuk urungkan)
  let undoTimer = null;

  function savePending() {
    if (!active) { pending = null; localStorage.removeItem(PENDING_KEY); }
    else {
      pending = JSON.parse(JSON.stringify(active));
      try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch (e) { /* storage penuh */ }
    }
  }

  function loadPending() {
    try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch (e) { pending = null; }
    return pending;
  }

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
    renderSkipAlert();
    renderResumeCard();
    renderSplitWeek();
    renderToday();
    renderHistory();
  }

  function init() {
    bindScheduleEditor();
    bindIntensityEditor();
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) undoBtn.addEventListener('click', undoDelete);
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
      extra = `
        <p class="program-warn">Waktu program sudah habis tapi target belum tercapai.</p>
        <button id="progEvaluateBtn" class="pill-btn ghost warn">Evaluasi Target</button>`;
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
        <div class="p-stat"><span>Kalori makan</span><b>${goals ? Math.round(goals.cal) : '—'} kkal</b></div>
        <div class="p-stat"><span>BMI</span><b>${p.bmi}</b></div>
      </div>
      <div class="program-why">${p.targetWeight ? `Progress menuju target: <b>${p.progressPct}%</b>. Perjalanan: <b>${p.startWeight} kg</b> → <b>${p.targetWeight} kg</b>.` : ''}</div>
      ${extra}
      <button id="openWeeklyWeightBtn" class="pill-btn ghost"><svg class="ic"><use href="#i-target"/></svg> Perbarui BB mingguan</button>
      <button id="openIntensityBtn" class="pill-btn ghost"><svg class="ic"><use href="#i-zap"/></svg> Ubah intensitas</button>`;

    const openWw = document.getElementById('openWeeklyWeightBtn');
    if (openWw) openWw.addEventListener('click', () => ONBOARDING.showWeekly());
    const openIntBtn = document.getElementById('openIntensityBtn');
    if (openIntBtn) openIntBtn.addEventListener('click', openIntensityModal);
    const transBtn = document.getElementById('progTransitionBtn');
    if (transBtn) transBtn.addEventListener('click', () => ONBOARDING.showTransition(p, 'reached'));
    const evalBtn = document.getElementById('progEvaluateBtn');
    if (evalBtn) evalBtn.addEventListener('click', () => ONBOARDING.showTransition(p, 'timeup'));
  }

  function restDays() {
    const st = status;
    return (st && st.program && st.program.restDays) || DEFAULT_REST_DAYS;
  }

  /* ================= Ubah intensitas latihan ================= */
  function bindIntensityEditor() {
    const closeBtn = document.getElementById('closeIntensity');
    if (closeBtn) closeBtn.addEventListener('click', () => NAV.closeModal('intensityModal'));
    const saveBtn = document.getElementById('saveIntensityBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveIntensityChanges);
  }

  function openIntensityModal() {
    const cur = programIntensity();
    document.querySelectorAll('#intensityOptions .goal-opt').forEach(b => {
      b.classList.toggle('active', b.dataset.v === cur);
    });
    document.getElementById('intensityError').textContent = '';
    NAV.openModal('intensityModal');
  }

  async function saveIntensityChanges() {
    const selected = document.querySelector('#intensityOptions .goal-opt.active');
    const errEl = document.getElementById('intensityError');
    if (!selected) { errEl.textContent = 'Pilih satu tingkat intensitas dulu.'; return; }
    const btn = document.getElementById('saveIntensityBtn');
    btn.disabled = true;
    try {
      await API.saveIntensity(selected.dataset.v);
      errEl.textContent = '';
      btn.disabled = false;
      NAV.closeModal('intensityModal');
      await refresh();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      errEl.textContent = e.message;
      btn.disabled = false;
    }
  }

  /* ================= Alert latihan terlewat ================= */
  function renderSkipAlert() {
    const box = document.getElementById('skipAlert');
    const st = status;
    if (!st || !st.program) { box.style.display = 'none'; box.innerHTML = ''; return; }

    const todayISO = API.todayISO();
    const worked = new Set(cache.filter(w => w.date).map(w => w.date));
    const week = buildWeekSchedule(restDays(), todayISO);
    const missed = week.filter(c => c.kind === 'gym' && c.date < todayISO && !worked.has(c.date));

    const lastMon = addDaysISO(mondayOf(todayISO), -7);
    const lastSun = addDaysISO(lastMon, 6);
    const lastDone = cache.some(w => w.date >= lastMon && w.date <= lastSun);
    const lastHasGym = buildWeekSchedule(restDays(), lastMon).some(c => c.kind === 'gym');

    const parts = [];
    if (missed.length) {
      const list = missed.map(c => `<b>${c.long} · ${c.label}</b>`).join(', ');
      parts.push(`Kamu melewatkan <b>${missed.length} latihan</b> minggu ini: ${list}. Tetap mulai jadwal berikutnya ya!`);
    }
    if (!missed.length && lastHasGym && !lastDone) {
      parts.push('Pekan lalu tidak ada latihan tercatat. Semangat mulai lagi pekan ini!');
    }
    if (!parts.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

    box.style.display = 'block';
    box.innerHTML = `<div class="skip-alert">${parts.map(p => `<p>${p}</p>`).join('')}</div>`;
  }

  /* ================= Sesi belum selesai -> bisa dilanjut ================= */
  function renderResumeCard() {
    const box = document.getElementById('resumeBanner');
    if (active || !loadPending()) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    const p = pending;
    if (!p || !p.exercises || !p.exercises.length) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    const done = p.exercises.filter(e => e.done).length;
    const current = Math.min(p.idx + 1, p.exercises.length);
    box.style.display = 'block';
    box.innerHTML = `
      <div class="resume-card">
        <div class="resume-info">
          <strong>${eh(p.name)} belum selesai</strong>
          <span>Berhenti di gerakan ${current} dari ${p.exercises.length} · ${done}/${p.exercises.length} gerakan selesai</span>
        </div>
        <div class="resume-actions">
          <button id="resumeBtn" class="pill-btn"><svg class="ic"><use href="#i-play"/></svg> Lanjutkan</button>
          <button id="discardResumeBtn" class="pill-btn ghost">Buang</button>
        </div>
      </div>`;
    document.getElementById('resumeBtn').addEventListener('click', resumeSession);
    document.getElementById('discardResumeBtn').addEventListener('click', () => {
      localStorage.removeItem(PENDING_KEY);
      pending = null;
      renderResumeCard();
    });
  }

  function resumeSession() {
    if (active || !loadPending()) { renderResumeCard(); return; }
    active = pending;
    document.getElementById('activeWorkoutBox').style.display = 'block';
    document.getElementById('activeWorkoutName').textContent = active.name;
    document.getElementById('activeWorkoutBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
    renderPlayer();
    renderResumeCard();
  }

  /* ================= Weekly split ================= */
  function renderSplitWeek() {
    const box = document.getElementById('splitWeek');
    const st = status;
    if (!st || !st.program) {
      box.innerHTML = '<p class="empty-note">Aktifkan program dulu untuk melihat plan mingguan.</p>';
      return;
    }
    box.innerHTML = '';
    const todayISO = API.todayISO();
    const todayCell = getTodaySession(restDays(), todayISO);
    buildWeekSchedule(restDays(), todayISO).forEach(c => {
      const chipDay = c.kind === 'gym' ? `HARI ${c.order}` : 'REST';
      const cell = document.createElement('div');
      cell.className = 'split-cell' + (c.date === todayISO ? ' is-today' : '') + (c.kind === 'cardio' ? ' is-cardio' : '');
      cell.innerHTML = `
        <span class="split-day">${chipDay}</span>
        <span class="split-weekday">${c.short}</span>
        <strong>${eh(c.label)}</strong>
        <small>${eh(c.goal)}</small>`;
      cell.addEventListener('click', () => {
        renderToday(todayCell && todayCell.date === c.date ? undefined : c.num);
      });
      box.appendChild(cell);
    });
  }

  /* ================= Today's session ================= */
  function programEmptyBox() {
    return '<p class="empty-note">Aktifkan program dulu — nanti ada porsi latihan otomatis sesuai hari.</p>';
  }

  function missedGymCells() {
    const worked = new Set(cache.filter(w => w.date).map(w => w.date));
    return buildWeekSchedule(restDays(), API.todayISO())
      .filter(c => c.kind === 'gym' && c.date < API.todayISO() && !worked.has(c.date));
  }

  function sessionHead(cell, extra) {
    const chipDay = cell.kind === 'gym' ? `HARI ${cell.order}` : 'REST';
    return `<div class="session-head"><span class="day-chip">${chipDay}</span><div><strong>${eh(cell.label)}</strong><small>${eh(cell.goal)}${extra}</small></div></div>`;
  }

  function routineListHtml(routine) {
    return `<ul class="routine-list">
        ${routine.map(r => `<li><span>${eh(r.name)}</span><em>${r.sets} × ${eh(r.reps)}</em></li>`).join('')}
      </ul>`;
  }

  /* Pratinjau read-only hari lain di grid — tidak ada tombol mulai. */
  function renderSessionPreview(box, cell, program) {
    if (cell.kind === 'rest') {
      box.innerHTML = sessionHead(cell, ` · ${cell.long}`) +
        '<p class="rest-text">Hari pemulihan — hasil latihan justru terbentuk saat otot beristirahat. Cukup aktif ringan & jaga makan.</p>' +
        '<p class="preview-note">Ini pratinjau jadwal — mulai latihan hanya tersedia saat hari latihan tersebut tiba.</p>';
      return;
    }
    if (cell.kind === 'cardio') {
      box.innerHTML = sessionHead(cell, ` · ${cell.long}`) +
        `<p class="rest-text">${eh(getCardioSuggestion(program))}</p>` +
        '<p class="preview-note">Ini pratinjau jadwal — mulai latihan hanya tersedia saat hari latihan tersebut tiba.</p>';
      return;
    }
    const routine = getDayRoutine(cell.libDay, program, programIntensity());
    box.innerHTML = sessionHead(cell, ` · ${cell.long}`) +
      routineListHtml(routine) +
      '<p class="preview-note">Ini pratinjau jadwal — mulai latihan hanya tersedia saat hari latihan tersebut tiba.</p>';
  }

  /* Sesi yang sedang berjalan ("Hari Ini"): sesi hari ini, atau catch-up bila hari ini rest & ada yang terlewat. */
  function renderWorkingSession(box, cell, todayCell, catchUp) {
    const program = stProgram();
    const intensity = programIntensity();
    const lvl = intensityLevel(intensity);

    if (cell.kind === 'rest') {
      box.innerHTML = sessionHead(cell, ' · Hari ini') +
        `<p class="rest-text">Hari pemulihan — hasil latihan justru terbentuk saat otot beristirahat. Cukup aktif ringan & jaga makan.
          ${goals ? `Target makan harianmu <b>${Math.round(goals.cal)} kkal</b> (jatah kalori, bukan bakar) tetap berjalan untuk program ${program}.` : ''}</p>`;
      return;
    }

    if (cell.kind === 'cardio') {
      box.innerHTML = sessionHead(cell, ' · Hari ini') +
        `<p class="rest-text">${eh(getCardioSuggestion(program))}</p>
        <button id="startCardioBtn" class="cta-btn"><svg class="ic"><use href="#i-activity"/></svg> Mulai Kardio Ringan</button>`;
      const btn = document.getElementById('startCardioBtn');
      if (btn) btn.addEventListener('click', () => NAV.showView('view-run'));
      return;
    }

    const routine = getDayRoutine(cell.libDay, program, intensity);
    const headExtra = catchUp ? '' : ' · Hari ini';
    const catchNote = catchUp
      ? `<p class="catchup-note">Hari ini jadwalmu <b>${eh(todayCell.label)}</b>. Kamu melewatkan latihan <b>${eh(cell.label)}</b> (${cell.long}) — mulai sekarang lalu kembali ke jadwal.</p>`
      : '';
    box.innerHTML = sessionHead(cell, headExtra) +
      `<p class="rest-text">${eh(lvl.weightNote)} · ${eh(lvl.rest)}</p>` +
      routineListHtml(routine) +
      catchNote +
      '<button id="startTodayBtn" class="cta-btn"><svg class="ic"><use href="#i-play"/></svg> Mulai Latihan Ini</button>';

    document.getElementById('startTodayBtn').addEventListener('click', () => startSession(cell, routine));
  }

  function renderToday(viewNum) {
    const box = document.getElementById('todaySessionCard');
    const st = status;
    if (!st || !st.program) {
      box.innerHTML = programEmptyBox();
      return;
    }
    const todayISO = API.todayISO();
    const week = buildWeekSchedule(restDays(), todayISO);

    if (viewNum) {
      const cell = week.find(c => c.num === viewNum) || getTodaySession(restDays(), todayISO);
      if (!cell) { box.innerHTML = programEmptyBox(); return; }
      renderSessionPreview(box, cell, st.program.program);
      return;
    }

    const todayCell = getTodaySession(restDays(), todayISO);
    const missed = missedGymCells();
    const catchUp = !!(todayCell && todayCell.kind !== 'gym' && missed.length);
    const cell = catchUp ? missed[missed.length - 1] : todayCell;
    if (!cell) { box.innerHTML = programEmptyBox(); return; }
    renderWorkingSession(box, cell, todayCell, catchUp);
  }

  function stProgram() {
    const st = status;
    return (st && st.program && st.program.program) || 'bulking';
  }

  /* ================= Editor jadwal (pindah hari rest) ================= */
  function bindScheduleEditor() {
    const openBtn = document.getElementById('openScheduleBtn');
    if (openBtn) openBtn.addEventListener('click', openScheduleModal);
    const closeBtn = document.getElementById('closeSchedule');
    if (closeBtn) closeBtn.addEventListener('click', () => NAV.closeModal('scheduleModal'));
    const saveBtn = document.getElementById('saveScheduleBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveScheduleChanges);
  }

  function openScheduleModal() {
    const st = status;
    if (!st || !st.program) return;
    scheduleRest = restDays().slice();
    renderScheduleRows();
    NAV.openModal('scheduleModal');
  }

  function scheduleHintText() {
    const n = scheduleRest.length;
    return `Rest terpilih <b>${n}</b> hari (bisa 1–6). Hari bukan-rest otomatis jadi sesi latihan berurutan; satu hari rest paling akhir pekan otomatis jadi <b>Rest / Kardio</b>.`;
  }

  function flashHint(message) {
    const hint = document.getElementById('scheduleHint');
    hint.innerHTML = message;
    hint.classList.add('warn');
    clearTimeout(flashHint._t);
    flashHint._t = setTimeout(() => { hint.innerHTML = scheduleHintText(); hint.classList.remove('warn'); }, 1800);
  }

  function renderScheduleRows() {
    const wrap = document.getElementById('scheduleDays');
    wrap.innerHTML = '';
    WEEKDAYS.forEach(d => {
      const isRest = scheduleRest.includes(d.num);
      const row = document.createElement('div');
      row.className = 'sched-row' + (isRest ? ' is-rest' : ' is-gym');
      row.innerHTML = `
        <span class="sched-name">${d.long}</span>
        <div class="seg-toggle mini">
          <button class="seg-btn ${isRest ? '' : 'active'}" data-role="gym"><svg class="ic"><use href="#i-gym"/></svg> Latihan</button>
          <button class="seg-btn ${isRest ? 'active' : ''}" data-role="rest">Rest</button>
        </div>`;
      row.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => toggleScheduleDay(d.num, btn.dataset.role)));
      wrap.appendChild(row);
    });
    const hint = document.getElementById('scheduleHint');
    hint.innerHTML = scheduleHintText();
    hint.classList.remove('warn');
    renderSchedulePreview();
  }

  function toggleScheduleDay(num, role) {
    const isRestNow = scheduleRest.includes(num);
    const wantRest = role === 'rest';
    if (wantRest === isRestNow) return;
    if (wantRest && scheduleRest.length >= MAX_SCHEDULE_REST) {
      flashHint(`Maksimal <b>${MAX_SCHEDULE_REST} hari rest</b> — ubah hari yang terlanjur rest jadi Latihan dulu.`);
      return;
    }
    scheduleRest = wantRest
      ? [...scheduleRest, num].sort((a, b) => a - b)
      : scheduleRest.filter(n => n !== num);
    renderScheduleRows();
  }

  function renderSchedulePreview() {
    const box = document.getElementById('schedulePreview');
    if (!box) return;
    const week = buildWeekSchedule(scheduleRest, API.todayISO());
    box.innerHTML = week.map(c =>
      `<div class="sched-pv ${c.kind}"><span>${c.short}</span><b>${c.kind === 'gym' ? `HARI ${c.order} · ${c.label}` : c.label}</b></div>`).join('');
  }

  async function saveScheduleChanges() {
    if (scheduleRest.length < MIN_SCHEDULE_REST || scheduleRest.length > MAX_SCHEDULE_REST) {
      flashHint(`Pilih <b>1–${MAX_SCHEDULE_REST} hari rest</b> dulu sebelum menyimpan.`);
      return;
    }
    const btn = document.getElementById('saveScheduleBtn');
    btn.disabled = true;
    try {
      await API.saveSchedule(scheduleRest);
      NAV.closeModal('scheduleModal');
      await refresh();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      alert('Gagal menyimpan jadwal: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* ================= Player sesi aktif ================= */
  function startSession(cell, routine) {
    if (active) return;
    active = {
      name: `${cell.label} · ${cell.long}`,
      startedAt: Date.now(),
      idx: 0,
      exercises: routine.map(r => ({ ...r, done: false }))
    };
    document.getElementById('activeWorkoutBox').style.display = 'block';
    document.getElementById('activeWorkoutName').textContent = active.name;
    document.getElementById('activeWorkoutBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
    savePending();
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
    if (prev && idx > 0) prev.addEventListener('click', () => { active.idx--; savePending(); renderPlayer(); });
    document.getElementById('nextExBtn').addEventListener('click', goNext);
    document.getElementById('quitSessionBtn').addEventListener('click', quitEarly);
  }

  function quitEarly() {
    if (!active) return;
    const allDone = active.exercises.every(e => e.done);
    if (allDone) { finish(); return; }
    clearInterval(timerInterval);
    savePending(); // simpan sesi agar bisa dilanjutkan nanti
    document.getElementById('activeWorkoutBox').style.display = 'none';
    document.getElementById('exercisePlayer').innerHTML = '';
    renderResumeCard();
  }

  function goNext() {
    if (!active) return;
    const list = active.exercises;
    if (active.idx >= list.length - 1) {
      list[active.idx].done = true;
      savePending();
      finish();
      return;
    }
    list[active.idx].done = true;
    active.idx++;
    savePending();
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
    const snap = JSON.parse(JSON.stringify(active));

    active = null;
    pending = null;
    document.getElementById('activeWorkoutBox').style.display = 'none';
    document.getElementById('exercisePlayer').innerHTML = '';

    try {
      await API.addWorkout(payload);
      localStorage.removeItem(PENDING_KEY);
      await refresh();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      pending = snap; // gagal simpan -> simpan sesi agar bisa dilanjutkan lagi
      try { localStorage.setItem(PENDING_KEY, JSON.stringify(snap)); } catch (e2) { /* ignore */ }
      renderResumeCard();
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
        <button class="h-del" data-id="${w.id}" aria-label="Hapus riwayat"><svg class="ic"><use href="#i-trash"/></svg></button>
        <div class="h-left">
          <strong>${escapeHtml(w.name)}</strong>
          <span>${formatDate(w.date)} · ${sub}</span>
        </div>
        <div class="h-right">${w.durationMin}<small>menit</small></div>`;
      const del = el.querySelector('.h-del');
      del.addEventListener('click', () => removeWorkout(w.id, w));
      box.appendChild(el);
    });
  }

  async function removeWorkout(id, item) {
    try {
      await API.deleteWorkout(id);
      cache = cache.filter(x => x.id !== id);
      renderHistory();
      showUndoToast(item);
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      alert('Gagal menghapus latihan: ' + e.message);
    }
  }

  function showUndoToast(item) {
    undo = item;
    const toast = document.getElementById('undoToast');
    toast.querySelector('.ut-text').textContent = 'Latihan dihapus';
    toast.style.display = 'flex';
    toast.classList.remove('fade-out');
    clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndoToast, 8000);
  }

  function hideUndoToast() {
    undo = null;
    const toast = document.getElementById('undoToast');
    toast.style.display = 'none';
  }

  async function undoDelete() {
    if (!undo) return;
    const item = undo;
    hideUndoToast();
    try {
      await API.addWorkout({
        name: item.name,
        date: item.date,
        durationMin: item.durationMin,
        exercises: item.exercises || []
      });
      await refresh();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      alert('Gagal mengurungkan penghapusan: ' + e.message);
    }
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

  function addDaysISO(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function toISO(d) {
    const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return new Date(utc).toISOString().slice(0, 10);
  }
  function mondayOf(iso) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return toISO(d);
  }

  return { init, countThisWeek, refresh, getCache: () => cache, programStatus, setProgram };
})();