/* Alur wajib: onboarding awal (BB/TB/dll), update BB mingguan, transisi program. */
const ONBOARDING = (() => {
  let obGender = 'pria';
  let obActivity = 3;
  let obIntensity = 'menengah';
  let obGoal = null; // 'bulking' | 'cutting' (untuk BMI normal)

  function init() {
    bindGender();
    bindActivity();
    bindIntensity();
    bindGoal();
    bindBirthdate();
    document.getElementById('obPreviewBtn').addEventListener('click', showPreview);
    document.getElementById('obBackBtn').addEventListener('click', () => {
      document.getElementById('obStepData').style.display = 'block';
      document.getElementById('obStepSummary').style.display = 'none';
      document.getElementById('onboardError').textContent = '';
    });
    document.getElementById('obConfirmBtn').addEventListener('click', confirmOnboard);
    document.getElementById('transitionBackBtn').addEventListener('click', () => hide('transitionModal'));

    bindWeeklyWeight();
  }

  function bindGender() {
    const wrap = document.getElementById('obGender');
    wrap.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        obGender = btn.dataset.v;
        wrap.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
  }

  function bindActivity() {
    const wrap = document.getElementById('obActivity');
    wrap.querySelectorAll('.goal-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        obActivity = Number(btn.dataset.v);
        wrap.querySelectorAll('.goal-opt').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
  }

  function bindIntensity() {
    const wrap = document.getElementById('obIntensity');
    if (!wrap) return;
    wrap.querySelectorAll('.goal-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        obIntensity = btn.dataset.v;
        wrap.querySelectorAll('.goal-opt').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
  }

  function bindGoal() {
    const bulk = document.getElementById('obGoalBulk');
    const cut = document.getElementById('obGoalCut');
    bulk.addEventListener('click', () => { obGoal = 'bulking'; activateGoal(bulk, cut); });
    cut.addEventListener('click', () => { obGoal = 'cutting'; activateGoal(cut, bulk); });
    // Pertanyaan tujuan hanya muncul saat BMI normal (18.5–24.9)
    ['obWeight', 'obHeight'].forEach(id => {
      document.getElementById(id).addEventListener('input', updateGoalBoxVisibility);
    });
  }
  function activateGoal(a, b) { a.classList.add('active'); b.classList.remove('active'); }

  function updateGoalBoxVisibility() {
    const box = document.getElementById('obGoalBox');
    const w = parseFloat(document.getElementById('obWeight').value);
    const h = parseFloat(document.getElementById('obHeight').value);
    if (!w || !h) { box.style.display = 'none'; return; }
    const bmi = w / Math.pow(h / 100, 2);
    const normal = bmi >= 18.5 && bmi < 25;
    box.style.display = normal ? 'block' : 'none';
    if (!normal) {
      obGoal = null;
      document.getElementById('obGoalBulk').classList.remove('active');
      document.getElementById('obGoalCut').classList.remove('active');
    }
  }

  /* ---- Preview rekomendasi (mirror logika server, cukup untuk tampilan) ---- */
  function readData() {
    const birthdate = document.getElementById('obBirthdate').value;
    const age = calcAge(birthdate);
    const weight = parseFloat(document.getElementById('obWeight').value);
    const height = parseFloat(document.getElementById('obHeight').value);
    return { gender: obGender, age, ageValid: birthdate ? age != null : false, birthdate, weight, height, activityLevel: obActivity, intensity: obIntensity };
  }

  function bindBirthdate() {
    const input = document.getElementById('obBirthdate');
    if (!input) return;
    const hint = document.getElementById('obAgeHint');
    const update = () => {
      const age = calcAge(input.value);
      if (hint) hint.textContent = age != null ? `Umur otomatis: ${age} tahun` : '';
    };
    input.addEventListener('input', update);
    update();
  }

  function computePreview() {
    const d = readData();
    if (!d.weight || !d.height || !d.age) return null;
    const bmi = d.weight / Math.pow(d.height / 100, 2);
    let program;
    if (bmi < 18.5) program = 'bulking';
    else if (bmi >= 25) program = 'cutting';
    else program = obGoal === 'cutting' ? 'cutting' : 'bulking';

    const m2 = Math.pow(d.height / 100, 2);
    let target, weeks;
    if (program === 'bulking') {
      let t = 24 * m2;
      if (t - d.weight > 8) t = d.weight + 8;
      target = Math.max(t, d.weight + 0.5);
      weeks = Math.max(8, Math.ceil((target - d.weight) / 0.25));
    } else {
      let t = 22 * m2;
      if (t >= d.weight) t = d.weight - 0.5;
      target = Math.max(t, 35);
      weeks = Math.min(20, Math.max(6, Math.ceil((d.weight - target) / 0.5)));
    }
    target = Math.round(target * 10) / 10;

    const bmr = d.gender === 'wanita'
      ? 10 * d.weight + 6.25 * d.height - 5 * d.age - 161
      : 10 * d.weight + 6.25 * d.height - 5 * d.age + 5;
    const factors = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 };
    const tdee = bmr * (factors[d.activityLevel] || 1.375);
    let cal, protein;
    if (program === 'bulking') { cal = Math.round(tdee + 300); protein = Math.round(1.8 * d.weight); }
    else if (program === 'cutting') { cal = Math.max(Math.round(tdee - 400), Math.round(bmr * 0.9)); protein = Math.round(2.0 * d.weight); }
    else { cal = Math.round(tdee); protein = Math.round(1.8 * d.weight); }

    return { program, bmi, target, weeks, cal, protein };
  }

  function bmiLabel(bmi) {
    if (bmi < 18.5) return 'kurus (BB di bawah ideal)';
    if (bmi < 25) return 'normal';
    return 'lebih (BB di atas ideal)';
  }

  function showPreview() {
    const err = document.getElementById('onboardError');
    err.textContent = '';
    const bmi = computePreview() && computePreview().bmi;
    const d = readData();
    if (!d.birthdate || !d.ageValid) { err.textContent = 'Lengkapi tanggal lahir dulu.'; return; }
    if (d.age < 10 || d.age > 100) { err.textContent = 'Umur harus antara 10–100 tahun (cek tanggal lahir).'; return; }
    if (!d.weight || !d.height) { err.textContent = 'Lengkapi berat dan tinggi badan dulu.'; return; }
    if (bmi >= 18.5 && bmi < 25 && !obGoal) { err.textContent = 'BMI kamu normal — pilih dulu tujuanmu (Makin berisi / Makin ramping).'; return; }

    const p = computePreview();
    const info = PROGRAM_INFO[p.program];
    const goalDesc = p.program === 'cutting'
      ? 'menurunkan berat badan'
      : (p.program === 'bulking' ? 'menambah massa otot & berat badan' : 'menjaga bentuk badan');
    const lvl = INTENSITY_LEVELS[obIntensity] || INTENSITY_LEVELS.menengah;
    const sample = getDayRoutine(1, p.program, obIntensity)[0];

    document.getElementById('obResultCard').innerHTML = `
      <div class="program-head">
        <span class="program-chip">${p.program.toUpperCase()}</span>
        <span>durasi ± ${p.weeks} minggu</span>
      </div>
      <p class="program-title">${eh(info.title)}<small>${eh(info.tagline)}</small></p>
      <p class="program-desc">${eh(info.desc)}</p>
      <p class="program-why">BMI kamu <b>${(p.bmi / 1).toFixed(1)}</b> (${bmiLabel(p.bmi)}) → direkomendasikan <b>${info.title}</b> untuk ${goalDesc}.</p>
      <p class="program-why">Intensitas <b>${eh(lvl.label)}</b> · contoh porsi hari ke-1: <b>${eh(sample.name)} — ${sample.sets} × ${eh(sample.reps)}</b>, beban saran ${sample.weight[0]}–${sample.weight[1]} kg.</p>
      <p class="program-why">Jadwal default (bisa kamu geser nanti): latihan <b>Senin, Selasa, Kamis, Jumat</b> · rest <b>Rabu, Sabtu, Minggu</b>.</p>
      <div class="program-stats">
        <div class="p-stat"><span>Target BB</span><b>${p.target} kg</b></div>
        <div class="p-stat"><span>Berat sekarang</span><b>${d.weight} kg</b></div>
        <div class="p-stat"><span>Kalori makan</span><b>${p.cal} kkal</b></div>
        <div class="p-stat"><span>Protein</span><b>${p.protein} g/hari</b></div>
      </div>
      <p class="program-why">Target makan <b>${p.cal} kkal/hari</b> = jatah kalori yang <b>kamu makan</b> (dihitung dari BB, tinggi, umur, & aktivitas + program) — <b>bukan kalori yang harus dibakar.</b></p>
      <div id="obAiRationale" class="program-why ai-why" style="display:none"><span class="rec-badge ai">AI</span><p></p></div>`;

    document.getElementById('obStepData').style.display = 'none';
    document.getElementById('obStepSummary').style.display = 'block';
    loadAiRationale(p);
  }

  async function loadAiRationale(p) {
    const box = document.getElementById('obAiRationale');
    if (!box) return;
    try {
      const d = readData();
      const resp = await API.getProgramRationale({
        program: p.program, bmi: (p.bmi / 1).toFixed(1),
        weight: d.weight, height: d.height, gender: d.gender, age: d.age,
        activity: d.activityLevel, intensity: d.intensity,
        targetWeight: p.target, durationWeeks: p.weeks
      });
      if (resp && resp.source === 'ai' && resp.text) {
        box.querySelector('p').textContent = resp.text;
        box.style.display = 'flex';
      } else {
        box.style.display = 'none';
      }
    } catch (e) {
      box.style.display = 'none';
    }
  }

  async function confirmOnboard() {
    const btn = document.getElementById('obConfirmBtn');
    const d = readData();
    btn.disabled = true;
    try {
      await API.onboard({
        name: (API.getUser() || {}).name || '',
        gender: d.gender,
        age: d.age,
        birthdate: d.birthdate,
        weight: d.weight,
        height: d.height,
        activityLevel: d.activityLevel,
        intensity: obIntensity,
        goal: obGoal || undefined
      });
      hide('onboardModal');
      await WORKOUT.refresh();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
      if (typeof onDone === 'function') onDone();
    } catch (e) {
      document.getElementById('onboardError').textContent = e.message;
      btn.disabled = false;
    }
  }

  /* ---- Modal update BB mingguan ---- */
  let weeklyOnSaved = null;
  function bindWeeklyWeight() {
    document.getElementById('saveWeeklyWeightBtn').addEventListener('click', saveWeeklyWeight);
    document.getElementById('weeklyWeightInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') saveWeeklyWeight();
    });
    const closeBtn = document.getElementById('closeWeeklyWeight');
    if (closeBtn) closeBtn.addEventListener('click', () => NAV.closeModal('weeklyWeightModal'));
  }

  async function saveWeeklyWeight() {
    const input = document.getElementById('weeklyWeightInput');
    const w = parseFloat(input.value);
    const err = document.getElementById('weeklyWeightError');
    if (!w || w < 30 || w > 300) { err.textContent = 'Masukkan berat badan valid (30–300 kg).'; return; }
    const btn = document.getElementById('saveWeeklyWeightBtn');
    btn.disabled = true;
    try {
      const data = await API.updateWeight(w);
      err.textContent = '';
      btn.disabled = false;
      hide('weeklyWeightModal');
      await WORKOUT.refresh();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
      if (typeof weeklyOnSaved === 'function') weeklyOnSaved();
      const st = WORKOUT.programStatus();
      if (st && st.targetReached) showTransition(st, 'reached');
      else if (st && st.timeUp) showTransition(st, 'timeup');
    } catch (e) {
      err.textContent = e.message;
      btn.disabled = false;
    }
  }

  /* ---- Modal transisi program (target tercapai / waktu habis) ---- */
  function transitionOption(label, desc, payload) {
    const box = document.getElementById('transitionOptions');
    const errEl = document.getElementById('transitionError');
    const row = document.createElement('div');
    row.className = 'goal-opt trans-opt';
    row.innerHTML = `<strong>${eh(label)}</strong><small>${eh(desc)}</small>`;
    row.addEventListener('click', async () => {
      errEl.textContent = '';
      try {
        await API.switchProgram(payload);
        hide('transitionModal');
        await WORKOUT.refresh();
        window.dispatchEvent(new CustomEvent('bq:dataChanged'));
      } catch (e) {
        errEl.textContent = e.message;
      }
    });
    box.appendChild(row);
  }

  function buildTransitionOptions(st, mode) {
    const box = document.getElementById('transitionOptions');
    box.innerHTML = '';
    const cur = st.currentWeight || st.startWeight || st.targetWeight;
    const title = (PROGRAM_INFO[st.program] || {}).title || st.program;

    if (mode === 'timeup') {
      if (st.program === 'bulking' || st.program === 'cutting') {
        transitionOption(`Perpanjang ${title} (siklus baru)`,
          `Target & durasi dihitung ulang dari BB sekarang (${kg(cur)}), hitungan minggu mulai dari nol.`,
          { program: st.program });
      }
      transitionOption('Evaluasi ulang',
        'Program direkomendasikan ulang dari BMI & BB terbaru kamu.',
        { recalc: true, program: st.program });
    } else if (st.program === 'bulking' || st.program === 'cutting') {
      transitionOption(`Lanjut ${title} — target baru`,
        `Target & durasi dihitung ulang dari BB sekarang (${kg(cur)}) sebagai siklus baru.`,
        { program: st.program });
    }

    const nexts = nextProgramOptions(st);
    if (!nexts.length) return;
    const div = document.createElement('div');
    div.className = 'trans-divider';
    div.textContent = 'atau pindah fase';
    box.appendChild(div);
    nexts.forEach(opt => {
      const info = PROGRAM_INFO[opt.program] || {};
      transitionOption(info.title || opt.program, info.desc || '', { program: opt.program });
    });
  }

  function nextProgramOptions(st) {
    if (st.program === 'bulking') return [{ program: 'cutting' }];
    if (st.program === 'cutting') return [{ program: 'maintenance' }, { program: 'bulking' }];
    return [{ program: 'bulking' }, { program: 'cutting' }];
  }

  /* ---- Controller utama dijalankan dari app.js ---- */
  let onDone = null;

  function activeProgram() {
    const st = WORKOUT.programStatus();
    return (st && st.program) ? st.program : null;
  }

  function start() {
    const p = activeProgram();
    if (!p) {
      show('onboardModal');
      return;
    }
    if (p.weightDue) {
      showWeekly();
      return;
    }
    if (p.targetReached) {
      showTransition(p, 'reached');
      return;
    }
    if (p.timeUp) {
      showTransition(p, 'timeup');
      return;
    }
    showProgramReadyNotice();
  }

  function showWeekly() {
    const p = activeProgram();
    const current = (p && p.currentWeight) || (API.getUser() || {}).weight || '';
    document.getElementById('weeklyWeightInput').value = current;
    document.getElementById('weeklyWeightError').textContent = '';
    document.getElementById('weeklyWeightNote').textContent =
      `Update BB mingguan kamu. Sekarang ${current || '?'} kg, target program: ${(p && p.targetWeight) || '—'} kg.`;
    document.getElementById('weeklyWeightStats').innerHTML = p
      ? `<div class="w-stat"><span>Program</span><b>${eh(p.program)}</b></div>
         <div class="w-stat"><span>${p.durationWeeks ? `Minggu ke-${p.elapsedWeeks + 1} dari ${p.durationWeeks}` : 'Program aktif'}</span><b>${p.targetWeight ? `Target ${p.targetWeight} kg` : 'Jaga BB'}</b></div>`
      : '';
    show('weeklyWeightModal');
  }

  function transitionProgress(st) {
    const cur = st.currentWeight || st.startWeight || st.targetWeight;
    const start = st.startWeight || cur;
    const target = st.targetWeight;
    if (!target || start === target) return null;
    const ratio = (cur - start) / (target - start);
    return Math.round(Math.min(100, Math.max(0, ratio * 100)));
  }

  function transitionStatsHtml(st) {
    const cur = st.currentWeight || st.startWeight || st.targetWeight;
    const weeks = st.durationWeeks
      ? `Minggu ke-${Math.min(st.elapsedWeeks + 1, st.durationWeeks)} dari ${st.durationWeeks}`
      : 'Program aktif';
    const pct = transitionProgress(st);
    return `<div class="w-stat"><span>BB sekarang</span><b>${kg(cur)} → ${kg(st.targetWeight)}</b></div>
      <div class="w-stat"><span>${st.durationWeeks ? 'Durasi' : 'Status'}</span><b>${weeks}</b></div>
      ${pct === null ? '' : `<div class="w-stat"><span>Capaian</span><b>${pct}%</b></div>`}`;
  }

  function showTransition(p, mode) {
    mode = mode === 'timeup' ? 'timeup' : 'reached';
    document.getElementById('transitionTitle').textContent =
      mode === 'timeup' ? 'Waktu Program Habis' : 'Target Tercapai!';
    const info = PROGRAM_INFO[p.program] || {};
    const note = mode === 'timeup'
      ? `Durasi program ${info.title || p.program} (${p.durationWeeks} minggu) sudah habis tapi target ${kg(p.targetWeight)} belum tercapai. Pilih langkah berikutnya.`
      : (p.program === 'maintenance'
        ? 'Program maintenance kamu bisa ditutup kapan saja. Pilih fase berikutnya.'
        : `Selamat! Target ${(info.title || p.program).toLowerCase()} (${kg(p.targetWeight)}) sudah tercapai. Pilih langkah berikutnya.`);
    document.getElementById('transitionNote').textContent = note;
    document.getElementById('transitionStats').innerHTML = transitionStatsHtml(p);
    document.getElementById('transitionError').textContent = '';
    buildTransitionOptions(p, mode);
    show('transitionModal');
  }

  function showProgramReadyNotice() {
    // klaim BB belum jatuh tempo & target belum tercapai: tidak perlu modal.
  }

  function show(id) {
    document.getElementById(id).classList.add('open');
    NAV.refreshOverlayState();
  }
  function hide(id) {
    document.getElementById(id).classList.remove('open');
    NAV.refreshOverlayState();
  }

  function eh(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
  function kg(v) { return v ? (Math.round(v * 10) / 10).toFixed(1) + ' kg' : '—'; }

  return {
    init,
    start,
    setDone: (cb) => { onDone = cb; },
    showWeekly,
    getOpen: () => document.querySelector('.modal-overlay.open') || null
  };
})();