const DASHBOARD = (() => {
  const CIRC = 2 * Math.PI * 60;
  const ACTIVITY_FACTORS = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 };
  const ACTIVITY_LABELS = { 1: 'Sedentari', 2: 'Ringan', 3: 'Sedang', 4: 'Berat', 5: 'Atlet' };

  function init() {
    document.getElementById('calRing').style.strokeDasharray = CIRC;
    const helpBtn = document.getElementById('calHelpBtn');
    if (helpBtn) helpBtn.addEventListener('click', toggleCalHelp);
    render();
    loadAdvice();
    window.addEventListener('bq:dataChanged', render);
    window.addEventListener('bq:viewchange', (e) => { if (e.detail.id === 'view-dashboard') render(); });
  }

  async function loadAdvice() {
    const card = document.getElementById('aiAdviceCard');
    if (!card) return;
    try {
      const resp = await API.getDailyAdvice();
      if (!resp || resp.source !== 'ai' || !resp.advice || !resp.advice.points) {
        card.style.display = 'none';
        return;
      }
      const a = resp.advice;
      document.getElementById('aiAdviceTitle').textContent = a.title || 'Saran hari ini';
      document.getElementById('aiAdviceList').innerHTML = (a.points || []).map(p => `<li>${esc(p)}</li>`).join('');
      const summaryEl = document.getElementById('aiAdviceSummary');
      if (a.summary) { summaryEl.textContent = a.summary; summaryEl.style.display = 'block'; }
      else summaryEl.style.display = 'none';
      card.style.display = 'block';
    } catch (e) {
      card.style.display = 'none';
    }
  }

  function toggleCalHelp() {
    const panel = document.getElementById('calHelpPanel');
    const btn = document.getElementById('calHelpBtn');
    if (!panel) return;
    const open = panel.style.display === 'block';
    panel.style.display = open ? 'none' : 'block';
    if (btn) btn.classList.toggle('active', !open);
  }

  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function renderCalHelp(goal, user) {
    const caption = document.getElementById('calCaption');
    const panel = document.getElementById('calHelpPanel');
    const cal = (goal && goal.cal) || 2000;
    const st = WORKOUT.programStatus();
    const prog = st && st.program && st.program.program;
    const info = PROGRAM_INFO[prog] || {};

    if (caption) {
      caption.innerHTML = prog
        ? `Target makan <b>${cal}</b> kkal/hari dari program <b>${esc(info.title || prog)}</b>.`
        : 'Target kalori bisa diatur di tab Makan.';
    }
    if (!panel) return;

    const hasData = user && user.weight && user.height && user.age && user.activityLevel;
    let bmr = 0, tdee = 0, actLabel = '';
    if (hasData) {
      bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age;
      bmr += user.gender === 'wanita' ? -161 : 5;
      tdee = Math.round(bmr * (ACTIVITY_FACTORS[user.activityLevel] || 1.375));
      actLabel = ACTIVITY_LABELS[user.activityLevel] || '';
    }

    const lines = [];
    lines.push('Sisa = target makan − makanan yang sudah masuk hari ini. Kalori dari lari/aktivitas bukan pengurang angka ini.');
    if (hasData) {
      const adj = prog === 'cutting'
        ? ' lalu dikurangi defisit 400 (cutting)'
        : (prog === 'bulking'
          ? ' lalu ditambah surplus 300 (bulking)'
          : (prog === 'maintenance' ? ' (maintenance, pas kebutuhan)' : ''));
      lines.push(`Target dihitung dari datamu: BB ${esc(user.weight)} kg · TB ${esc(user.height)} cm · umur ${esc(user.age)} th · aktivitas ${esc(actLabel)} → kebutuhan ±${tdee} kkal,${adj} → target ${cal} kkal/hari.`);
    } else {
      lines.push('Lengkapi profil & program dulu biar target dihitung otomatis. Kamu tetap bisa set sendiri di tab Makan.');
    }
    lines.push('Angka ikut diperbarui tiap kamu update BB mingguan atau ganti program.');
    panel.innerHTML = `<ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>`;
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
    renderCalHelp(goal, user);

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
