const DASHBOARD = (() => {
  const CIRC = 2 * Math.PI * 60;

  function init() {
    document.getElementById('calRing').style.strokeDasharray = CIRC;
    render();
    window.addEventListener('bq:dataChanged', render);
    window.addEventListener('bq:viewchange', (e) => { if (e.detail.id === 'view-dashboard') render(); });
  }

  async function render() {
    const user = API.getUser() || {};
    document.getElementById('greetName').textContent = user.name ? `Halo, ${user.name}` : 'Halo, Atlet';
    document.getElementById('greetDate').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

    const goal = FOOD.getGoal();
    const calIn = FOOD.todayCalIn();
    const activities = RUNNING.getCache();
    const activitiesToday = activities.filter(a => a.date === API.todayISO());
    const calBurn = activitiesToday.reduce((s, a) => s + a.kcal, 0);
    const pct = Math.min(1, calIn / (goal.cal || 2000));

    document.getElementById('calRing').style.strokeDashoffset = CIRC * (1 - pct);
    document.getElementById('calRemaining').textContent = Math.max(0, Math.round((goal.cal || 2000) - calIn));
    document.getElementById('calIn').textContent = Math.round(calIn);
    document.getElementById('calBurn').textContent = Math.round(calBurn);
    document.getElementById('calTarget').textContent = goal.cal || 2000;

    const last = SLEEP.lastNight();
    if (last) {
      document.getElementById('sleepLastVal').textContent = last.hours + ' jam';
      document.getElementById('sleepLastSub').textContent = formatDate(last.date);
    } else {
      document.getElementById('sleepLastVal').textContent = '-';
      document.getElementById('sleepLastSub').textContent = 'Belum ada data';
    }

    document.getElementById('workoutTodayVal').textContent = WORKOUT.countThisWeek();
    document.getElementById('distWeekVal').textContent = RUNNING.weekDistanceKm().toFixed(1) + ' km';
    renderProgramMini();

    let allFoodDates = [];
    try {
      const allFoodLogs = await API.getFoodLogs();
      allFoodDates = allFoodLogs.map(f => f.date);
    } catch (e) { /* ignore */ }

    document.getElementById('streakVal').textContent = computeStreak(allFoodDates) + ' hari';
    renderInsight();
  }

function renderProgramMini() {
    const mini = document.getElementById('programMiniCard');
    if (!mini) return;
    const st = WORKOUT.programStatus();
    if (!st || !st.program) { mini.style.display = 'none'; return; }
    const p = st.program;
    const info = PROGRAM_INFO[p.program] || {};
    document.getElementById('miniProgramChip').textContent = (p.program || '').toUpperCase();
    document.getElementById('miniProgramText').textContent =
      (p.durationWeeks ? `Minggu ke-${Math.min(p.elapsedWeeks + 1, p.durationWeeks)} dari ${p.durationWeeks} · ` : 'Program aktif · ') + (info.title || p.program);
    document.getElementById('miniProgramProgress').style.width = (p.progressPct || 0) + '%';
    document.getElementById('miniProgramSub').textContent =
      p.targetWeight ? `BB ${p.currentWeight} kg → target ${p.targetWeight} kg (${p.progressPct}%)` : `BB ${p.currentWeight} kg · pertahankan`;
    mini.style.display = 'block';
  }

  function computeStreak(allFoodDates) {
    const foodDates = new Set(allFoodDates);
    const workoutDates = new Set(WORKOUT.getCache().map(w => w.date));
    const actDates = new Set(RUNNING.getCache().map(a => a.date));
    const sleepDates = new Set(SLEEP.getCache().map(s => s.date));

    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if (foodDates.has(iso) || workoutDates.has(iso) || actDates.has(iso) || sleepDates.has(iso)) {
        streak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }
    return streak;
  }

  function renderInsight() {
    const sleepLogs = SLEEP.getCache();
    const activities = RUNNING.getCache();
    const card = document.getElementById('insightCard');
    const text = document.getElementById('insightText');

    if (sleepLogs.length >= 3 && activities.length >= 2) {
      const activeDates = new Set(activities.map(a => a.date));
      const sleepByDate = {};
      sleepLogs.forEach(s => { sleepByDate[s.date] = s.hours; });

      const withActivity = [];
      const withoutActivity = [];
      Object.keys(sleepByDate).forEach(date => {
        if (activeDates.has(date)) withActivity.push(sleepByDate[date]);
        else withoutActivity.push(sleepByDate[date]);
      });

      if (withActivity.length >= 2 && withoutActivity.length >= 2) {
        const avgWith = withActivity.reduce((a, b) => a + b, 0) / withActivity.length;
        const avgWithout = withoutActivity.reduce((a, b) => a + b, 0) / withoutActivity.length;
        const diff = avgWith - avgWithout;
        if (Math.abs(diff) >= 0.3) {
          card.style.display = 'block';
          if (diff > 0) {
            text.textContent = `Kamu tidur rata-rata ${diff.toFixed(1)} jam lebih lama di hari kamu olahraga lari/sepeda. Pertahankan kebiasaan ini!`;
          } else {
            text.textContent = `Tidurmu rata-rata ${Math.abs(diff).toFixed(1)} jam lebih pendek di hari kamu olahraga. Coba jaga jadwal tidur di hari aktif.`;
          }
          return;
        }
      }
    }
    card.style.display = 'none';
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  return { init, render };
})();
