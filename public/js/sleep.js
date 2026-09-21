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

  const DAY_ORDER = (typeof SLEEP_REMINDER !== 'undefined' && SLEEP_REMINDER.DAY_ORDER) ||
    ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
  const DAY_LABEL = (typeof SLEEP_REMINDER !== 'undefined' && SLEEP_REMINDER.DAY_LABEL) ||
    { senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu', minggu: 'Minggu' };

  function todayKey() {
    try {
      const t = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
      if (DAY_ORDER.includes(t)) return t;
    } catch (e) {}
    return DAY_ORDER[(new Date().getDay() + 6) % 7];
  }

  function readAlarmCfg() {
    try {
      const raw = JSON.parse(localStorage.getItem('bq_sleep_alarm_v1') || 'null');
      if (raw && raw.enabled && raw.days && DAY_ORDER.every(d => raw.days[d])) return raw;
    } catch (e) {}
    return null;
  }

  const toMin = s => {
    if (typeof s !== 'string' || !s.includes(':')) return null;
    const h = Number(s.split(':')[0]), m = Number(s.split(':')[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    let v = h * 60 + m;
    if (h < 12) v += 1440;
    return v;
  };
  const durText = m => (m % 60 === 0 ? m / 60 : (m / 60).toFixed(1).replace('.', ',')) + ' jam';

  function computeStatus() {
    const profile = API.getUser() || {};
    const target = Math.min(12, Math.max(4, Number(profile.sleepTarget) || 8));

    const cfg = readAlarmCfg();
    const day = todayKey();
    const sched = cfg ? cfg.days[day] : null;
    const schedOn = !!sched && sched.on && cfg.enabled;

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

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let bed, wakeIso, def, wakeNote, chip, urgency, msg, progress, avgHours, durLabel;
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
    avgHours = cnt ? sum / cnt : 0;
    const deficit = avgHours && avgHours < target * 0.85
      ? `7 malam terakhir kamu rata-rata tidur <b>${avgHours.toFixed(1)} jam</b> (di bawah target <b>${target} jam</b>) — malam ini penting banget. `
      : '';

    if (schedOn) {
      const sM = toMin(sched.sleep), wM = toMin(sched.wake);
      bed = sM;
      if (sM == null || wM == null) {
        bed = (wakeH * 60 + wakeM) - target * 60;
        if (bed < 0) bed += 1440;
      } else {
        let dur = (wM + 1440 - sM) % 1440; if (dur <= 0) dur += 1440;
        wakeH = Math.floor(wM / 60) % 24; wakeM = wM % 60;
        durLabel = durText(dur);
      }
      wakeIso = timeToStr(wakeH, wakeM);
      def = (durLabel || target + ' jam') + ' (jadwal ' + DAY_LABEL[day] + ')';
      wakeNote = '· sesuai jadwal ' + DAY_LABEL[day];
    } else {
      if (cfg && !sched.on) {
        const next = DAY_ORDER.find(d => cfg.days[d].on);
        return {
          target, wakeH, wakeM, bedH: null, bedM: null, chip: 'Tidak terjadwal', urgency: 'ok',
          msg: `Hari ini (<b>${DAY_LABEL[day]}</b>) tidak ada jadwal di Alarm Tidur.` +
            (next ? ` Alarm aktif untuk hari <b>${DAY_LABEL[next]}</b> dst. — atur di bawah.` : ' Nyalakan & set jadwal di bawah.'),
          progress: 0, avgHours, def: '', wakeNote: ''
        };
      }
      bed = (wakeH * 60 + wakeM) - target * 60;
      if (bed < 0) bed += 1440;
      wakeIso = timeToStr(wakeH, wakeM);
      def = target + ' jam  (' + (fromLogs ? 'dari jam bangunmu rata-rata' : 'target default') + ')';
      wakeNote = fromLogs ? '· dari jam bangunmu' : '';
    }

    let n = nowMin;
    if (n < 300 && bed > 720) n += 1440;
    const diff = n - bed;

    chip = 'Masih leluasa'; urgency = 'ok'; progress = 6;
    if (diff <= -120) {
      progress = Math.max(6, Math.round(100 + diff / 1.5));
    } else if (diff <= -45) {
      progress = Math.round(100 + diff / 1.5);
      chip = 'Mulai tenang'; urgency = 'soon';
    } else if (diff <= 0) {
      progress = Math.round(100 + diff / 1.5);
      chip = 'Siap-siap tidur'; urgency = 'warn';
    } else if (diff <= 45) {
      progress = 100; chip = 'Waktunya tidur!'; urgency = 'late';
    } else {
      progress = 100; chip = 'Terlambat'; urgency = 'high';
    }

    const bedH = Math.floor(bed / 60) % 24, bedM = bed % 60;
    if (schedOn) {
      msg = `Sesuai jadwal Alarm Tidur hari ini (<b>${DAY_LABEL[day]}</b>): tidur <b>${timeToStr(bedH, bedM)}</b> → bangun <b>${wakeIso}</b> (${def.split(' (')[0]}). Lullaby & alarm bangun berbunyi otomatis sesuai jadwal di bawah.`;
    } else if (diff <= -120) {
      msg = `Batas tidur dari target <b>${timeToStr(bedH, bedM)}</b>. Tidur tepat waktu → bangun <b>${wakeIso}</b> sudah cukup ${target} jam. Buat jadwal mingguan di Alarm Tidur (bawah) agar diingatkan otomatis.`;
    } else if (diff <= -45) {
      msg = `Kurang dari 2 jam sebelum batas <b>${timeToStr(bedH, bedM)}</b>. Jauhkan HP, redupkan lampu, mulai rutinitas malammu.`;
    } else if (diff <= 0) {
      msg = `Kurang dari 1 jam lagi. Siapkan kamar gelap & sejuk sebelum <b>${timeToStr(bedH, bedM)}</b>.`;
    } else if (diff <= 45) {
      msg = `Sudah lewat batas <b>${diff} menit</b>. Tidur sekarang juga — otot & otak pulih paling baik malam ini.`;
    } else {
      msg = `Sudah lewat <b>${diff} menit</b>. Besok coba majukan ${Math.ceil(diff / 60) || 1} jam agar target ${target} jam tercapai.`;
    }

    if (deficit) msg = deficit + msg;
    return { target, bedH, bedM, wakeH, wakeM, chip, urgency, msg, progress, avgHours, def, wakeNote };
  }

  function renderStatus() {
    const card = document.getElementById('sleepStatusCard');
    if (!card) return;
    const s = computeStatus();
    document.getElementById('sleepBedtime').textContent = s.bedH == null ? '—' : timeToStr(s.bedH, s.bedM);
    document.getElementById('sleepWakeLine').textContent = 'bangun ' + timeToStr(s.wakeH, s.wakeM) + (s.wakeNote ? ' ' + s.wakeNote : '');
    document.getElementById('sleepTargetLine').textContent = s.def ? 'target ' + s.def : '';
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