const SLEEP = (() => {
  let cache = [];

  async function init() {
    if (typeof SLEEP_REMINDER !== 'undefined') SLEEP_REMINDER.init();
    await refresh();
  }

  async function refresh() {
    try {
      cache = await API.getSleepLogs();
    } catch (e) { cache = []; }
    renderStatus();
  }

  function lastNight() { return cache[0] || null; }
  function getCache() { return cache; }

  function timeToStr(h, m) { const p = n => ('0' + n).slice(-2); return p(h) + ':' + p(m); }

  function computeStatus() {
    const profile = API.getUser() || {};
    const target = Math.min(12, Math.max(4, Number(profile.sleepTarget) || 8));

    let wakeH = 6, wakeM = 30;
    const wakeTimes = [];
    cache.slice(0, 14).forEach(s => {
      if (s.endTime && s.endTime.includes(':')) {
        const [hh, mm] = s.endTime.split(':').map(Number);
        if (hh >= 4 && hh <= 20) wakeTimes.push(hh * 60 + mm);
      }
    });
    const fromLogs = wakeTimes.length > 0;
    if (fromLogs) {
      const avg = Math.round(wakeTimes.reduce((a, b) => a + b, 0) / wakeTimes.length);
      wakeH = Math.floor(avg / 60); wakeM = avg % 60;
    }

    let bed = (wakeH * 60 + wakeM) - target * 60;
    if (bed < 0) bed += 24 * 60;
    const bedH = Math.floor(bed / 60), bedM = bed % 60;

    const days7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days7.push(d.toISOString().slice(0, 10));
    }
    let sum = 0, cnt = 0;
    days7.forEach(iso => {
      const s = cache.find(x => x.date === iso);
      if (s && s.hours) { sum += s.hours; cnt++; }
    });
    const avgHours = cnt ? sum / cnt : 0;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const diff = nowMin - bed;

    const def = target + ' jam  (' + (fromLogs ? 'dari jam bangunmu rata-rata' : 'target default') + ')';
    let chip = 'Masih leluasa', urgency = 'ok', msg = '', progress = 6;
    const deficit = avgHours && avgHours < target * 0.85
      ? `Malam ini <b>penting banget</b>: 7 malam terakhir kamu rata-rata tidur <b>${avgHours.toFixed(1)} jam</b> dari target <b>${target} jam</b>.`
      : '';

    if (diff <= -120) {
      progress = Math.max(6, Math.round(100 + diff / 1.5));
      msg = `Batas tidur jam <b>${timeToStr(bedH, bedM)}</b>. Tidur tepat waktu → bangun <b>${timeToStr(wakeH, wakeM)}</b> sudah cukup ${target} jam.`;
    } else if (diff <= -45) {
      progress = Math.round(100 + diff / 1.5);
      chip = 'Mulai tenang'; urgency = 'soon';
      msg = `Kurang dari 2 jam sebelum batas <b>${timeToStr(bedH, bedM)}</b>. Jauhkan HP, redupkan lampu, mulai rutinitas malammu.`;
    } else if (diff <= 0) {
      progress = Math.round(100 + diff / 1.5);
      chip = 'Siap-siap tidur'; urgency = 'warn';
      msg = `Kurang dari 1 jam lagi. Siapkan kamar gelap & sejuk sebelum <b>${timeToStr(bedH, bedM)}</b>.`;
    } else if (diff <= 45) {
      progress = 100; chip = 'Waktunya tidur!'; urgency = 'late';
      msg = `Sudah lewat batas <b>${diff} menit</b>. Tidur sekarang juga — otot & otak pulih paling baik malam ini.`;
    } else {
      progress = 100; chip = 'Terlambat'; urgency = 'high';
      msg = `Sudah lewat <b>${diff} menit</b>. Besok coba majukan ${Math.ceil(diff / 60) || 1} jam agar target ${target} jam tercapai.`;
    }

    if (deficit) msg = deficit + ' ' + msg;
    return { target, bedH, bedM, wakeH, wakeM, chip, urgency, msg, progress, avgHours, def };
  }

  function renderStatus() {
    const card = document.getElementById('sleepStatusCard');
    if (!card) return;
    const s = computeStatus();
    document.getElementById('sleepBedtime').textContent = timeToStr(s.bedH, s.bedM);
    document.getElementById('sleepWakeLine').textContent = 'bangun ' + timeToStr(s.wakeH, s.wakeM) + (s.fromLogs ? ' · dari jam bangunmu' : '');
    document.getElementById('sleepTargetLine').textContent = 'target ' + s.def;
    document.getElementById('sleepUrgencyText').innerHTML = s.msg;
    const chip = document.getElementById('sleepUrgencyChip');
    chip.textContent = s.chip;
    chip.className = 'urgency-chip ' + s.urgency;
    const bar = document.getElementById('sleepProgressBar');
    bar.style.width = s.progress + '%';
    bar.className = 'status-progress-fill ' + s.urgency;
  }

  window.addEventListener('bq:viewchange', (e) => { if (e.detail.id === 'view-sleep') renderStatus(); });

  return { init, lastNight, getCache, refresh };
})();