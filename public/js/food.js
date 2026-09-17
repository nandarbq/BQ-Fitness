const FOOD = (() => {
  const MEALS = [
    { key: 'sarapan', label: 'Sarapan' },
    { key: 'makan_siang', label: 'Makan Siang' },
    { key: 'makan_malam', label: 'Makan Malam' },
    { key: 'camilan', label: 'Camilan' }
  ];
  let currentDate = API.todayISO();
  let pendingMealKey = null;
  let logsCache = [];
  let goalCache = { cal: 2000, protein: 120, carb: 220, fat: 60 };
  let todayCalCache = 0;

  async function init() {
    const dateInput = document.getElementById('foodDate');
    dateInput.value = currentDate;
    dateInput.addEventListener('change', async () => { currentDate = dateInput.value; await loadLogs(); render(); });

    buildMealSections();

    document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);
    document.getElementById('saveFoodBtn').addEventListener('click', saveFoodEntry);

    await loadGoal();
    await loadLogs();
    render();
    await refreshTodayCal();
  }

  function buildMealSections() {
    const wrap = document.getElementById('mealSections');
    wrap.innerHTML = '';
    MEALS.forEach(m => {
      const block = document.createElement('div');
      block.className = 'meal-block';
      block.innerHTML = `
        <div class="meal-block-head">
          <h3>${m.label}</h3>
          <button data-meal="${m.key}" class="add-food-btn">${ICON('plus')}</button>
        </div>
        <div class="meal-items" id="meal-${m.key}"></div>`;
      wrap.appendChild(block);
    });
    wrap.querySelectorAll('.add-food-btn').forEach(btn => {
      btn.addEventListener('click', () => openFoodModal(btn.dataset.meal));
    });
  }

  function openFoodModal(mealKey) {
    pendingMealKey = mealKey;
    document.getElementById('foodModalTitle').textContent = 'Tambah ke ' + MEALS.find(m => m.key === mealKey).label;
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

  function render() {
    MEALS.forEach(m => {
      const box = document.getElementById('meal-' + m.key);
      const items = logsCache.filter(e => e.meal === m.key);
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

  function todayCalIn() { return todayCalCache; }
  function getGoal() { return goalCache; }

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return { init, todayCalIn, getGoal, refresh: async () => { await loadLogs(); render(); await refreshTodayCal(); } };
})();
