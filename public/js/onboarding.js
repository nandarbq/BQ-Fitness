/* Alur wajib: onboarding awal (BB/TB/dll), update BB mingguan, transisi program. */
const ONBOARDING = (() => {
  let obGender = 'pria';
  let obActivity = 3;
  let obGoal = null; // 'bulking' | 'cutting' (untuk BMI normal)

  function init() {
    bindGender();
    bindActivity();
    bindGoal();
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
    const age = parseInt(document.getElementById('obAge').value, 10);
    const weight = parseFloat(document.getElementById('obWeight').value);
    const height = parseFloat(document.getElementById('obHeight').value);
    return { gender: obGender, age, weight, height, activityLevel: obActivity };
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
    if (!d.weight || !d.height || !d.age) { err.textContent = 'Lengkapi umur, berat, dan tinggi badan dulu.'; return; }
    if (bmi >= 18.5 && bmi < 25 && !obGoal) { err.textContent = 'BMI kamu normal — pilih dulu tujuanmu (Makin berisi / Makin ramping).'; return; }

    const p = computePreview();
    const info = PROGRAM_INFO[p.program];
    const goalDesc = p.program === 'cutting'
      ? 'menurunkan berat badan'
      : (p.program === 'bulking' ? 'menambah massa otot & berat badan' : 'menjaga bentuk badan');

    document.getElementById('obResultCard').innerHTML = `
      <div class="program-head">
        <span class="program-chip">${p.program.toUpperCase()}</span>
        <span>durasi ± ${p.weeks} minggu</span>
      </div>
      <p class="program-title">${eh(info.title)}<small>${eh(info.tagline)}</small></p>
      <p class="program-desc">${eh(info.desc)}</p>
      <p class="program-why">BMI kamu <b>${(p.bmi / 1).toFixed(1)}</b> (${bmiLabel(p.bmi)}) → direkomendasikan <b>${info.title}</b> untuk ${goalDesc}.</p>
      <div class="program-stats">
        <div class="p-stat"><span>Target BB</span><b>${p.target} kg</b></div>
        <div class="p-stat"><span>Berat sekarang</span><b>${d.weight} kg</b></div>
        <div class="p-stat"><span>Target kalori</span><b>${p.cal} kkal</b></div>
        <div class="p-stat"><span>Protein</span><b>${p.protein} g/hari</b></div>
      </div>`;

    document.getElementById('obStepData').style.display = 'none';
    document.getElementById('obStepSummary').style.display = 'block';
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
        weight: d.weight,
        height: d.height,
        activityLevel: d.activityLevel,
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
    } catch (e) {
      err.textContent = e.message;
      btn.disabled = false;
    }
  }

  /* ---- Modal transisi program ---- */
  function buildTransitionOptions(st) {
    const box = document.getElementById('transitionOptions');
    box.innerHTML = '';
    const options = buildNextOptions(st);
    options.forEach(opt => {
      const row = document.createElement('div');
      row.className = 'goal-opt trans-opt';
      row.innerHTML = `<strong>${eh(PROGRAM_INFO[opt.program].title)}</strong><small>${eh(PROGRAM_INFO[opt.program].desc)}</small>`;
      row.addEventListener('click', async () => {
        document.getElementById('transitionError').textContent = '';
        try {
          await API.switchProgram({ program: opt.program });
          hide('transitionModal');
          await WORKOUT.refresh();
          window.dispatchEvent(new CustomEvent('bq:dataChanged'));
        } catch (e) {
          document.getElementById('transitionError').textContent = e.message;
        }
      });
      box.appendChild(row);
    });
  }

  function buildNextOptions(st) {
    if (st.program === 'bulking') {
      return [{ program: 'cutting' }];
    }
    if (st.program === 'cutting') {
      return [{ program: 'maintenance' }, { program: 'bulking' }];
    }
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
      showTransition(p);
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

  function showTransition(p) {
    const note = p.program === 'bulking'
      ? `Selamat! Target bulking (${p.targetWeight} kg) sudah tercapai. Waktunya pindah fase.`
      : (p.program === 'cutting'
        ? `Selamat! Target cutting (${p.targetWeight} kg) sudah tercapai. Pilih fase berikutnya.`
        : `Program maintenance kamu bisa ditutup kapan saja. Pilih fase berikutnya.`);
    document.getElementById('transitionNote').textContent = note;
    document.getElementById('transitionError').textContent = '';
    buildTransitionOptions(p);
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

  return {
    init,
    start,
    setDone: (cb) => { onDone = cb; },
    showWeekly,
    getOpen: () => document.querySelector('.modal-overlay.open') || null
  };
})();