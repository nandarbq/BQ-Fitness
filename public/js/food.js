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
  let selection = new Set();
  let logsCache = [];
  let goalCache = { cal: 2000, protein: 120, carb: 220, fat: 60 };
  let todayCalCache = 0;
  let recState = { source: null, plan: null, busy: false };
  let recLoaded = false;
  const REC_CACHE_KEY = 'bq_ai_meal_v1';

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

  function autoSlot() {
    const h = new Date().getHours();
    if (h < 10) return 'sarapan';
    if (h < 15) return 'makan_siang';
    if (h < 18) return 'camilan_sore';
    return 'makan_malam';
  }

  async function init() {
    const dateInput = document.getElementById('foodDate');
    dateInput.value = currentDate;
    dateInput.addEventListener('change', async () => {
      currentDate = dateInput.value;
      await loadLogs();
      render();
      await refreshTodayCal();
    });

    document.getElementById('openPickFoodBtn').addEventListener('click', openPickFood);
    document.getElementById('editGoalBtn').addEventListener('click', toggleGoalForm);
    document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);
    document.getElementById('pickerManualBtn').addEventListener('click', toggleManual);
    document.getElementById('saveFoodBtn').addEventListener('click', finishPicking);
    document.getElementById('pickerRecRefresh').addEventListener('click', async () => {
      await refreshRecommendation();
      renderPickerGroups();
      updatePickerToolbar();
    });

    // Saran AI tidak memblokir app: muat dari cache lokal bila ada (instan),
    // sisanya baru diambil saat halaman Makan dibuka pertama kali.
    hydrateRecFromCache();
    updatePickerToolbar();

    window.addEventListener('bq:viewchange', (e) => {
      if (e.detail.id === 'view-food' && !recLoaded) {
        recLoaded = true;
        loadRecommendation().then(() => {
          updatePickerToolbar();
          const modal = document.getElementById('foodModal');
          if (modal && modal.classList.contains('open')) renderPickerGroups();
        });
      }
    });

    await loadGoal();
    await loadLogs();
    render();
    renderAutoNote();
    await refreshTodayCal();
  }

  function hydrateRecFromCache() {
    try {
      const raw = localStorage.getItem(REC_CACHE_KEY);
      if (!raw) return;
      const rec = JSON.parse(raw);
      if (!rec || rec.date !== API.todayISO() || !rec.payload) return;
      recState.plan = rec.payload;
      recState.source = rec.source === 'ai' ? 'ai' : 'fallback';
      recLoaded = true;
    } catch (e) { /* abaikan cache korup */ }
  }

  function cacheTodayPlan(payload) {
    try {
      localStorage.setItem(REC_CACHE_KEY, JSON.stringify({ date: API.todayISO(), payload, source: 'ai' }));
    } catch (e) { /* kuota penuh dsb — abaikan */ }
  }

  /* ---- Picker "Pilih Makanan" ---- */
  function openPickFood() {
    const sel = document.getElementById('pickerMeal');
    sel.innerHTML = '';
    activeMealKeys().forEach(k => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = SLOT_META[k].label;
      sel.appendChild(o);
    });
    sel.value = autoSlot();

    selection = new Set();
    document.getElementById('pickerManualBox').style.display = 'none';
    document.getElementById('pickerManualBtn').innerHTML = ICON('plus') + ' Catat manual / makan seadanya';
    ['foodName', 'foodKcal', 'foodProtein', 'foodCarb', 'foodFat'].forEach(id => document.getElementById(id).value = '');
    setPickerError('');
    renderPickerGroups();
    updatePickerToolbar();
    updatePickerSum();
    NAV.openModal('foodModal');
  }

  function renderPickerGroups() {
    const wrap = document.getElementById('pickerGroups');
    const cats = (window.FOOD_CATALOG && window.FOOD_CATALOG.groups) || [];
    const aiSet = aiItemNames();
    wrap.innerHTML = '';
    cats.forEach(cat => {
      const group = document.createElement('div');
      group.className = 'picker-group';
      const head = document.createElement('div');
      head.className = 'picker-group-head';
      const nSel = [...selection].filter(id => window.FOODS[id] && window.FOODS[id].cat === cat.key).length;
      head.innerHTML = `<h3>${cat.label}<small>${cat.note}</small></h3><span class="picker-group-count" data-key="${cat.key}">${nSel ? nSel + ' dipilih' : ''}</span>`;
      const grid = document.createElement('div');
      grid.className = 'picker-grid';
      cat.ids.forEach(id => {
        const f = window.FOODS[id];
        if (!f) return;
        const sel = selection.has(id);
        const ai = aiMatch(f.name, aiSet);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'picker-opt' + (sel ? ' selected' : '');
        b.dataset.id = id;
        b.innerHTML = `
          <span class="opt-top">
            <span class="opt-name">${escapeHtml(f.name)}${ai ? '<i class="opt-ai" title="Direkomendasikan AI hari ini">AI</i>' : ''}</span>
            <span class="opt-check">${ICON('check')}</span>
          </span>
          <span class="opt-qty">${escapeHtml(f.unit)}</span>
          <span class="opt-macro">${f.kcal} kkal · P${f.protein} K${f.carb} L${f.fat}</span>`;
        b.addEventListener('click', () => toggleTile(id, b, cat.key));
        grid.appendChild(b);
      });
      group.appendChild(head);
      group.appendChild(grid);
      wrap.appendChild(group);
    });
  }

  function toggleTile(id, btn, catKey) {
    if (selection.has(id)) selection.delete(id);
    else selection.add(id);
    btn.classList.toggle('selected', selection.has(id));
    const countEl = document.querySelector(`.picker-group-count[data-key="${catKey}"]`);
    if (countEl) {
      const n = [...selection].filter(i => window.FOODS[i] && window.FOODS[i].cat === catKey).length;
      countEl.textContent = n ? n + ' dipilih' : '';
    }
    updatePickerSum();
    setPickerError('');
  }

  function updatePickerSum() {
    const t = { kcal: 0, protein: 0, carb: 0, fat: 0 };
    selection.forEach(id => {
      const f = window.FOODS[id];
      t.kcal += f.kcal; t.protein += f.protein; t.carb += f.carb; t.fat += f.fat;
    });
    document.getElementById('pickerSum').textContent = `${Math.round(t.kcal)} kkal · P${Math.round(t.protein)} K${Math.round(t.carb)} L${Math.round(t.fat)}`;
  }

  function toggleManual() {
    const box = document.getElementById('pickerManualBox');
    const show = box.style.display === 'none';
    box.style.display = show ? 'block' : 'none';
    document.getElementById('pickerManualBtn').innerHTML = show
      ? ICON('close') + ' Sembunyikan form manual'
      : ICON('plus') + ' Catat manual / makan seadanya';
    if (show) {
      selection.clear();
      renderPickerGroups();
      updatePickerSum();
    }
    setPickerError('');
  }

  async function finishPicking() {
    const meal = document.getElementById('pickerMeal').value;
    const manualName = document.getElementById('foodName').value.trim();
    const manual = manualName ? {
      name: manualName,
      kcal: parseFloat(document.getElementById('foodKcal').value) || 0,
      protein: parseFloat(document.getElementById('foodProtein').value) || 0,
      carb: parseFloat(document.getElementById('foodCarb').value) || 0,
      fat: parseFloat(document.getElementById('foodFat').value) || 0
    } : null;

    const items = manual ? [manual] : [...selection].map(id => window.FOODS[id]);
    if (!items.length) {
      setPickerError('Pilih dulu makanannya, atau isi catatan manual.');
      return;
    }

    try {
      for (const it of items) {
        await API.addFoodLog({
          date: currentDate,
          meal,
          name: it.name,
          kcal: it.kcal || 0,
          protein: it.protein || 0,
          carb: it.carb || 0,
          fat: it.fat || 0
        });
      }
      NAV.closeModal('foodModal');
      await loadLogs();
      render();
      await refreshTodayCal();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      setPickerError('Gagal menyimpan catatan makan: ' + e.message);
    }
  }

  function setPickerError(msg) {
    const el = document.getElementById('pickerError');
    if (el) el.textContent = msg;
  }

  /* ---- Rekomendasi menu (AI) — hanya sebagai saran di picker ---- */
  async function loadRecommendation() {
    if (!window.MEAL_RECOMMEND) return;
    let plan = null, source = 'fallback';
    try {
      const resp = await API.getMealRecommend();
      plan = resp.plan;
      source = resp.source || 'fallback';
    } catch (e) { /* lanjut ke fallback */ }
    if (!plan) plan = MEAL_RECOMMEND.buildFallbackPlan(goalCache);
    recState.plan = plan;
    recState.source = source === 'ai' ? 'ai' : 'fallback';
    if (source === 'ai' && plan) cacheTodayPlan(plan);
  }

  async function refreshRecommendation() {
    if (recState.busy || !window.MEAL_RECOMMEND) return;
    recState.busy = true;
    const btn = document.getElementById('pickerRecRefresh');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      let plan = null, source = 'fallback';
      try {
        const resp = await API.refreshMealRecommend();
        plan = resp.plan;
        source = resp.source || 'fallback';
      } catch (e) {
        await loadRecommendation();
        return;
      }
      if (!plan) plan = MEAL_RECOMMEND.buildFallbackPlan(goalCache);
      recState.plan = plan;
      recState.source = source === 'ai' ? 'ai' : 'fallback';
      if (source === 'ai' && plan) cacheTodayPlan(plan);
    } finally {
      recState.busy = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Segarkan saran'; }
    }
  }

  function aiItemNames() {
    if (recState.source !== 'ai' || !recState.plan) return new Set();
    const s = new Set();
    (recState.plan.meals || []).forEach(m => (m.items || []).forEach(it => s.add(String(it.name).toLowerCase().trim())));
    return s;
  }

  function aiMatch(name, set) {
    const n = name.toLowerCase();
    for (const x of set) if (x === n || x.includes(n) || n.includes(x)) return true;
    return false;
  }

  function updatePickerToolbar() {
    const badge = document.getElementById('pickerRecBadge');
    const btn = document.getElementById('pickerRecRefresh');
    if (!badge) return;
    if (recState.source === 'ai') {
      badge.style.display = '';
      badge.textContent = 'AI';
      badge.className = 'rec-badge ai';
      btn.style.display = '';
    } else if (recState.plan) {
      badge.style.display = '';
      badge.textContent = 'Menu Luring';
      badge.className = 'rec-badge';
      btn.style.display = '';
    } else {
      badge.style.display = 'none';
      btn.style.display = 'none';
    }
  }

  /* ---- Data & catatan ---- */
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

  function toggleGoalForm() {
    const box = document.getElementById('goalFormBox');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
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
      document.getElementById('goalFormBox').style.display = 'none';
      render();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      alert('Gagal menyimpan target: ' + e.message);
    }
  }

  function render() {
    const totals = logsCache.reduce((a, e) => {
      a.kcal += e.kcal; a.protein += e.protein; a.carb += e.carb; a.fat += e.fat;
      return a;
    }, { kcal: 0, protein: 0, carb: 0, fat: 0 });
    const g = goalCache;
    const tiles = [
      { label: 'Kalori', unit: 'kkal', need: g.cal, have: totals.kcal },
      { label: 'Protein', unit: 'g', need: g.protein, have: totals.protein },
      { label: 'Karbo', unit: 'g', need: g.carb, have: totals.carb },
      { label: 'Lemak', unit: 'g', need: g.fat, have: totals.fat }
    ];
    document.getElementById('needsGrid').innerHTML = tiles.map(t => `
      <div class="needs-tile">
        <span class="needs-label">${t.label}</span>
        <span class="needs-val">${fmt(t.need)} <em>${t.unit}</em></span>
        <small>Termakan <b>${fmt(t.have)} ${t.unit}</b></small>
      </div>`).join('');
    renderTiming();
    renderNotes();
  }

  function renderTiming() {
    const wrap = document.getElementById('mealTimingList');
    if (!wrap) return;
    const keys = activeMealKeys().slice().sort((a, b) => MEAL_ORDER.indexOf(a) - MEAL_ORDER.indexOf(b));
    const nowKey = autoSlot();
    if (!keys.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = keys.map(k => {
      const meta = SLOT_META[k] || { label: k, time: '' };
      return `<div class="timing-row${k === nowKey ? ' now' : ''}">
        <span class="timing-name">${meta.label}</span>
        <span class="timing-hour">${meta.time || '—'}</span>
      </div>`;
    }).join('');
  }

  function renderNotes() {
    const wrap = document.getElementById('foodNotes');
    const byMeal = {};
    logsCache.forEach(e => {
      const k = normalizeMealKey(e.meal);
      (byMeal[k] = byMeal[k] || []).push(e);
    });
    const keys = MEAL_ORDER.filter(k => byMeal[k] && byMeal[k].length);
    wrap.innerHTML = '';
    if (!keys.length) {
      wrap.innerHTML = '<p class="empty-note">Belum ada catatan. Tap <b style="color:var(--red)">Catat Makan</b> lalu pilih makanannya.</p>';
      return;
    }
    keys.forEach(k => {
      const meta = SLOT_META[k] || { label: k, time: '' };
      const block = document.createElement('div');
      block.className = 'meal-block';
      const head = document.createElement('div');
      head.className = 'meal-block-head';
      head.innerHTML = `<h3>${meta.label}<small>${meta.time || ''}</small></h3>`;
      const list = document.createElement('div');
      list.className = 'meal-items';
      byMeal[k].forEach(it => {
        const row = document.createElement('div');
        row.className = 'food-item';
        row.innerHTML = `<div><div class="f-name">${escapeHtml(it.name)}</div><div class="f-macro">${it.kcal} kkal · P${it.protein} K${it.carb} L${it.fat}</div></div>
          <button class="f-del" data-id="${it.id}">${ICON('close')}</button>`;
        row.querySelector('.f-del').addEventListener('click', () => deleteEntry(it.id));
        list.appendChild(row);
      });
      block.appendChild(head);
      block.appendChild(list);
      wrap.appendChild(block);
    });
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
      note.innerHTML = `<svg class="ic"><use href="#i-zap"/></svg> Kebutuhan harian dihitung <b>otomatis</b> dari program <b>${eh(info.title || p.program)}</b> kamu${targetPart}. Ini jatah asupanmu, bukan kewajiban mengikuti rencana — catat saja apa yang kamu makan.`;
      note.style.display = 'flex';
    } else {
      note.style.display = 'none';
    }
  }

  function todayCalIn() { return todayCalCache; }
  function getGoal() { return goalCache; }
  function fmt(n) { return Math.round(n).toLocaleString('id-ID'); }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return { init, todayCalIn, getGoal, refresh: async () => { await loadLogs(); render(); await refreshTodayCal(); } };
})();