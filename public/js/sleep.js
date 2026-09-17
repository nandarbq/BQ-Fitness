const SLEEP = (() => {
  let selectedQuality = 3;
  let cache = [];

  async function init() {
    document.getElementById('sleepDate').value = API.todayISO();
    document.getElementById('qualityBtns').querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedQuality = parseInt(btn.dataset.q, 10);
        highlightQuality();
      });
    });
    highlightQuality();
    document.getElementById('saveSleepBtn').addEventListener('click', save);
    await refresh();
  }

  function highlightQuality() {
    document.getElementById('qualityBtns').querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.q, 10) === selectedQuality);
    });
  }

  async function refresh() {
    try {
      cache = await API.getSleepLogs();
    } catch (e) { cache = []; }
    renderHistory();
    drawChart();
  }

  async function save() {
    const startTime = document.getElementById('sleepStartTime').value;
    const endTime = document.getElementById('sleepEndTime').value;
    const date = document.getElementById('sleepDate').value || API.todayISO();
    if (!startTime || !endTime) return;

    const startDate = new Date(date + 'T' + startTime);
    let endDate = new Date(date + 'T' + endTime);
    if (endDate <= startDate) {
      startDate.setDate(startDate.getDate() - 1);
    }
    const hours = (endDate - startDate) / 3600000;

    try {
      await API.addSleepLog({ date, startTime, endTime, hours: Math.round(hours * 10) / 10, quality: selectedQuality });
      await refresh();
      window.dispatchEvent(new CustomEvent('bq:dataChanged'));
    } catch (e) {
      alert('Gagal menyimpan catatan tidur: ' + e.message);
    }
  }

  function renderHistory() {
    const box = document.getElementById('sleepHistory');
    if (!cache.length) {
      box.innerHTML = '<p class="empty-note">Belum ada catatan tidur.</p>';
      return;
    }
    box.innerHTML = '';
    const qIcon = ['', ICON('q1'), ICON('q2'), ICON('q3'), ICON('q4'), ICON('q5')];
    cache.slice(0, 30).forEach(s => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="h-left">
          <strong>${formatDate(s.date)}</strong>
          <span>${s.startTime} → ${s.endTime} ${qIcon[s.quality] || ''}</span>
        </div>
        <div class="h-right">${s.hours}<small>jam</small></div>`;
      box.appendChild(el);
    });
  }

  function drawChart() {
    const canvas = document.getElementById('sleepChart');
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300;
    const h = 140;
    canvas.width = w * ratio; canvas.height = h * ratio;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, w, h);

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const rec = cache.find(s => s.date === iso);
      days.push({ label: d.toLocaleDateString('id-ID', { weekday: 'short' }), hours: rec ? rec.hours : 0 });
    }

    const red = getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#B3122A';
    const muted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#83706F';
    const maxH = Math.max(9, ...days.map(d => d.hours));
    const barW = 24;
    const gap = (w - barW * 7) / 8;
    const chartBottom = h - 20;
    const chartTop = 10;

    days.forEach((d, i) => {
      const x = gap + i * (barW + gap);
      const barH = (d.hours / maxH) * (chartBottom - chartTop);
      ctx.fillStyle = red;
      ctx.globalAlpha = d.hours > 0 ? 1 : 0.15;
      roundRect(ctx, x, chartBottom - barH, barW, Math.max(barH, 2), 6);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = muted;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barW / 2, h - 4);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function lastNight() { return cache[0] || null; }
  function getCache() { return cache; }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  window.addEventListener('bq:viewchange', (e) => { if (e.detail.id === 'view-sleep') drawChart(); });

  return { init, lastNight, getCache, refresh };
})();
