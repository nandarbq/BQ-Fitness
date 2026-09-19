const FOOD = (() => {
  const SLOT_META = {
    sarapan: { label: 'Sarapan', time: '06.00-09.00' },
    camilan_pagi: { label: 'Camilan Pagi', time: '09.30-11.30' },
    makan_siang: { label: 'Makan Siang', time: '12.00-14.00' },
    camilan_sore: { label: 'Camilan Sore', time: '15.00-17.00' },
    makan_malam: { label: 'Makan Malam', time: '18.00-20.00' },
    camilan_malam: { label: 'Camilan Malam', time: '20.30-22.00' }
  };
  const MEAL_ORDER = ['sarapan', 'camilan_pagi', 'makan_siang', 'camilan_sore', 'makan_malam', 'camilan_malam'];
  const BASE_MEALS = ['sarapan', 'makan_siang', 'makan_malam'];

  let currentDate = API.todayISO();
  let pendingMealKey = null;
  let logsCache = [];
  let goalCache = { cal: 2000, protein: 120, carb: 220, fat: 60 };
  let todayCalCache = 0;
  let recState = { source: null, plan: null, busy: false };

  function normalizeMealKey(meal) {
    return meal === 'camilan' ? 'camilan_sore' : meal;
  }

  function activeMealKeys() {
    const freq = MEAL_RECOMMEND ? MEAL_RECOMMEND.recommendationFrequency(goalCache.cal) : 4;
    const keys = BASE_MEALS.slice();
    if (freq >= 4) keys.splice(2, 0, 'camilan_sore');
    if (freq >= 5) keys.splice(1, 0, 'camilan_pagi');
    if (freq >= 6) keys.push('camilan_malam');
    return keys;
  }

  async function init() {
    const dateInput = document.getElementById('foodDate');
    dateInput.value = currentDate;
    dateInput.addEventListener('change', async () => { currentDate = dateInput.value; await loadLogs(); render(); await refreshTodayCal(); });

    document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);
    document.getElementById('saveFoodBtn').addEventListener('click', saveFoodEntry);
    document.getElementById('mealRecRefreshBtn').addEventListener('click', refreshRecommendation);
    const recWrap = document.getElementById('mealRec');
    if (recWrap) recWrap.addEventListener('click', handleRecClick);

    await loadGoal();
    await loadLogs();
    render();
    renderAutoNote();
    await refreshTodayCal();
    await loadRecommendation();
  }

  function buildMealSections() {
    const wrap = document.getElementById('mealSections');
    const keys = activeMealKeys();
    wrap.innerHTML = '';
    keys.forEach(key => {
      const meta = SLOT_META[key];
      const block = document.createElement('div');
      block.className = 'meal-block';
      block.innerHTML = `
        <div class="meal-block-head">
          <h3>${meta.label}<small>${meta.time}</small></h3>
          <button data-meal="${key}" class="add-food-btn">${ICON('plus')}</button>
        </div>
        <div class="meal-items" id="meal-${key}"></div>`;
      wrap.appendChild(block);
    });
    wrap.querySelectorAll('.add-food-btn').forEach(btn => {
      btn.addEventListener('click', () => openFoodModal(btn.dataset.meal));
    });
  }

  function openFoodModal(mealKey) {
    pendingMealKey = mealKey;
    document.getElementById('foodModalTitle').textContent = 'Tambah ke ' + (SLOT_META[mealKey] ? SLOT_META[mealKey].label : mealKey);
    ['foodName', 'foodKcal', 'foodProtein', 'foodCarb', 'foodFat'].forEach(id => document.getElementById(id).value = '');
    NAV.openModal('foodModal');
  }

  async function saveFoodEntry() {
    const name = document.getElementById('foodName').value.trim();
    const kcal = parseFloat(document.getElementById('foodKcal').value) || 0;
    const protein = parseFloat(document.getElementById('foodProtein').value) || 0;
    const carb = parseFloat(document.getElementById('foodCarb').value) || 0;
    const fat = parseFloat(document.getElementById('foodFat').value) || 0;
    if (!name) return;

    const entry = { date: currentDate, meal: pendingMealKey, name, kcal, protein, carb, fat };
    try {
      await API.addFoodLog(entry);
      NAV.closeModal('foodModal');
      await loadLogs();
      render();
      await refreshTodayCal();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      alert('Gagal menyimpan catatan makan: ' + e.message);
    }
  }

  async function deleteEntry(id) {
    try {
      await API.deleteFoodLog(id);
      await loadLogs();
      render();
      await refreshTodayCal();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      alert('Gagal menghapus: ' + e.message);
    }
  }

  async function loadLogs() {
    try {
      logsCache = await API.getFoodLogs(currentDate);
    } catch (e) { logsCache = []; }
  }

  async function loadGoal() {
    try {
      goalCache = await API.getFoodGoal();
    } catch (e) { /* keep defaults */ }
    document.getElementById('goalCal').value = goalCache.cal;
    document.getElementById('goalProtein').value = goalCache.protein;
    document.getElementById('goalCarb').value = goalCache.carb;
    document.getElementById('goalFat').value = goalCache.fat;
  }

  async function saveGoal() {
    const g = {
      cal: parseFloat(document.getElementById('goalCal').value) || 2000,
      protein: parseFloat(document.getElementById('goalProtein').value) || 120,
      carb: parseFloat(document.getElementById('goalCarb').value) || 220,
      fat: parseFloat(document.getElementById('goalFat').value) || 60
    };
    try {
      goalCache = await API.saveFoodGoal(g);
      render();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      alert('Gagal menyimpan target: ' + e.message);
    }
  }

  /* ---- Rekomendasi menu (AI utama, fallback statis bila AI tak ada) ---- */
  async function loadRecommendation() {
    const section = document.getElementById('mealRecSection');
    if (!section) return;
    let plan = null, source = 'fallback';
    try {
      const resp = await API.getMealRecommend();
      plan = resp.plan;
      source = resp.source || 'fallback';
    } catch (e) { /* lanjut ke fallback */ }
    if (!plan && window.MEAL_RECOMMEND) plan = MEAL_RECOMMEND.buildFallbackPlan(goalCache);
    if (!plan) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    recState.plan = plan;
    recState.source = source === 'ai' ? 'ai' : 'fallback';
    renderRec();
  }

  async function refreshRecommendation() {
    if (recState.busy) return;
    recState.busy = true;
    const btn = document.getElementById('mealRecRefreshBtn');
    if (btn) btn.disabled = true;
    try {
      let plan = null, source = 'fallback';
      try {
        const resp = await API.refreshMealRecommend();
        plan = resp.plan;
        source = resp.source || 'fallback';
      } catch (e) {
        alert(e.message);
        await loadRecommendation();
        return;
      }
      if (!plan && window.MEAL_RECOMMEND) plan = MEAL_RECOMMEND.buildFallbackPlan(goalCache);
      if (!plan) return;
      recState.plan = plan;
      recState.source = source === 'ai' ? 'ai' : 'fallback';
      renderRec();
    } finally {
      recState.busy = false;
      if (btn) btn.disabled = false;
    }
  }

  function recBadgeText() {
    return recState.source === 'ai' ? 'AI Menu' : 'Menu Luring';
  }

  function renderRec() {
    const wrap = document.getElementById('mealRec');
    if (!wrap || !recState.plan) return;
    const badge = document.getElementById('mealRecBadge');
    if (badge) {
      badge.textContent = recBadgeText();
      badge.className = 'rec-badge' + (recState.source === 'ai' ? ' ai' : '');
    }
    const sub = document.getElementById('mealRecSub');
    const plan = recState.plan;
    if (sub) {
      const totals = (plan.meals || []).reduce((acc, m) => {
        (m.items || []).forEach(it => {
          acc.kcal += it.kcal || 0; acc.protein += it.protein || 0; acc.carb += it.carb || 0; acc.fat += it.fat || 0;
        });
        return acc;
      }, { kcal: 0, protein: 0, carb: 0, fat: 0 });
      const freqNote = plan.frequency ? `Disarankan makan <b>${plan.frequency}×</b> sehari sesuai kebutuhanmu.<br>` : '';
      sub.innerHTML = `${freqNote}Total menu &plusmn; <b>${Math.round(totals.kcal)} kkal</b> · P <b>${Math.round(totals.protein)}g</b> K <b>${Math.round(totals.carb)}g</b> L <b>${Math.round(totals.fat)}g</b>.`;
    }

    const meals = (plan.meals || []).slice();
    if (!meals.length) { wrap.innerHTML = '<p class="empty-note">Belum ada rekomendasi menu.</p>'; return; }
    wrap.innerHTML = '';
    meals.forEach((meal, mi) => {
      const meta = SLOT_META[meal.slot] || { label: meal.slot, time: meal.time || '' };
      const block = document.createElement('div');
      block.className = 'rec-meal';
      const itemsHtml = (meal.items || []).map((it, ii) => recItemHtml(meal, it, mi, ii)).join('');
      block.innerHTML = `
        <div class="rec-meal-head">
          <span class="rec-meal-label">${escapeHtml(meta.label)}</span>
          <span class="rec-meal-time"><svg class="ic"><use href="#i-clock"/></svg> ${escapeHtml(meal.time || meta.time || '')}</span>
        </div>
        ${itemsHtml}`;
      wrap.appendChild(block);
    });
  }

  function recItemHtml(meal, item, mi, ii) {
    const alts = (item.alternatives || []).map((a, ai) => `
      <button class="rec-chip" data-action="swap" data-mi="${mi}" data-ii="${ii}" data-ai="${ai}">${escapeHtml(a.name)}</button>`).join('');
    return `
      <div class="rec-item">
        <div class="rec-item-main">
          <div class="rec-item-top">
            <strong>${escapeHtml(item.name)}</strong>
            <button class="f-del rec-add" data-action="add" data-mi="${mi}" data-ii="${ii}" title="Tambahkan ke catatan">${ICON('plus')}</button>
          </div>
          <span class="rec-qty">${escapeHtml(item.qty || '')}</span>
          <span class="f-macro">${Math.round(item.kcal)} kkal · P${Math.round(item.protein)} K${Math.round(item.carb)} L${Math.round(item.fat)}</span>
          ${alts ? `<div class="rec-alts">Alternatif: ${alts}</div>` : ''}
        </div>
      </div>`;
  }

  function handleRecClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || !recState.plan) return;
    const mi = Number(btn.dataset.mi);
    const ii = Number(btn.dataset.ii);
    if (btn.dataset.action === 'add') {
      const meal = recState.plan.meals[mi];
      if (!meal || !meal.items[ii]) return;
      recAdd({ slot: meal.slot, item: meal.items[ii] });
    } else if (btn.dataset.action === 'swap') {
      const ai = Number(btn.dataset.ai);
      recSwap(recState.plan.meals[mi], ii, ai);
    }
  }

  function recSwap(meal, itemIndex, altIndex) {
    const item = meal.items[itemIndex];
    const alt = (item.alternatives || [])[altIndex];
    if (!alt) return;
    item.name = alt.name;
    item.qty = alt.qty || item.qty;
    item.kcal = alt.kcal != null ? alt.kcal : item.kcal;
    item.protein = alt.protein != null ? alt.protein : item.protein;
    item.carb = alt.carb != null ? alt.carb : item.carb;
    item.fat = alt.fat != null ? alt.fat : item.fat;
    renderRec();
  }

  async function recAdd(meal) {
    const item = meal.item;
    try {
      await API.addFoodLog({
        date: currentDate,
        meal: meal.slot,
        name: item.name,
        kcal: item.kcal || 0,
        protein: item.protein || 0,
        carb: item.carb || 0,
        fat: item.fat || 0
      });
      await loadLogs();
      render();
      await refreshTodayCal();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      alert('Gagal menambahkan: ' + e.message);
    }
  }

  function render() {
    buildMealSections();
    const keys = activeMealKeys();
    keys.forEach(key => {
      const box = document.getElementById('meal-' + key);
      const key2 = normalizeMealKey(key);
      const items = logsCache.filter(e => normalizeMealKey(e.meal) === key2);
      if (!items.length) { box.innerHTML = '<p class="empty-note" style="padding:8px 0">Belum ada catatan.</p>'; return; }
      box.innerHTML = '';
      items.forEach(it => {
        const row = document.createElement('div');
        row.className = 'food-item';
        row.innerHTML = `
          <div><div class="f-name">${escapeHtml(it.name)}</div><div class="f-macro">${it.kcal} kkal · P${it.protein} K${it.carb} L${it.fat}</div></div>
          <button class="f-del" data-id="${it.id}">${ICON('close')}</button>`;
        row.querySelector('.f-del').addEventListener('click', () => deleteEntry(it.id));
        box.appendChild(row);
      });
    });

    const totals = logsCache.reduce((acc, e) => {
      acc.kcal += e.kcal; acc.protein += e.protein; acc.carb += e.carb; acc.fat += e.fat;
      return acc;
    }, { kcal: 0, protein: 0, carb: 0, fat: 0 });

    document.getElementById('foodCalIn').textContent = Math.round(totals.kcal);
    document.getElementById('foodCalTarget').textContent = goalCache.cal;
    document.getElementById('calBarFg').style.width = Math.min(100, (totals.kcal / goalCache.cal) * 100) + '%';
    document.getElementById('proteinVal').textContent = Math.round(totals.protein) + 'g';
    document.getElementById('carbVal').textContent = Math.round(totals.carb) + 'g';
    document.getElementById('fatVal').textContent = Math.round(totals.fat) + 'g';
  }

  async function refreshTodayCal() {
    if (currentDate === API.todayISO()) {
      todayCalCache = logsCache.reduce((s, e) => s + e.kcal, 0);
    } else {
      try {
        const todayLogs = await API.getFoodLogs(API.todayISO());
        todayCalCache = todayLogs.reduce((s, e) => s + e.kcal, 0);
      } catch (e) { /* ignore */ }
    }
  }

  function renderAutoNote() {
    const note = document.getElementById('foodAutoNote');
    if (!note) return;
    const st = window.WORKOUT && WORKOUT.programStatus();
    if (st && st.program) {
      const p = st.program;
      const info = PROGRAM_INFO[p.program] || {};
      const targetPart = goalCache && p.targetWeight
        ? ` · target BB ${p.targetWeight} kg (minggu ke-${Math.min(p.elapsedWeeks + 1, p.durationWeeks)} dari ${p.durationWeeks})`
        : '';
      note.innerHTML = `<svg class="ic"><use href="#i-zap"/></svg> Target makan dihitung <b>otomatis</b> dari program <b>${eh(info.title || p.program)}</b> kamu${targetPart}. Target makan = <b>jatah kalori yang kamu konsumsi, bukan kalori yang harus dibakar.</b> Ikuti target ini supaya program berjalan maksimal.`;
      note.style.display = 'flex';
    } else {
      note.style.display = 'none';
    }
  }

  function todayCalIn() { return todayCalCache; }
  function getGoal() { return goalCache; }

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return { init, todayCalIn, getGoal, refresh: async () => { await loadLogs(); render(); await refreshTodayCal(); } };
})();