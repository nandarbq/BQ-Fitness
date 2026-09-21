/* Alarm tidur mingguan: tiap hari ada jam tidur & jam bangun dengan batas
   rentang sehat (tidur 19:00–02:00, bangun 04:30–09:59, durasi 6–10 jam).
   Jam tidur → nada pengantar tidur; jam bangun → alarm bangun.
   Konfigurasi diteruskan ke service worker agar tetap jalan saat app ditutup. */
const SLEEP_REMINDER = (() => {
  const KEY = 'bq_sleep_alarm_v1';
  const IDB_NAME = 'bq_db';
  const IDB_STORE = 'kv';
  const CHECK_MS = 15000;

  const DAY_ORDER = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
  const DAY_LABEL = { senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu', minggu: 'Minggu' };
  const RANGES = {
    sleep: { min: 19 * 60, max: 26 * 60 },   // 19:00 – 02:00 (02:00 = 26:00)
    wake: { min: 4 * 60 + 30, max: 9 * 60 + 59 }, // 04:30 – 09:59
    dur: { min: 6 * 60, max: 10 * 60 }        // 6 – 10 jam
  };

  let cfg = defaultCfg();
  let edit = null;
  let audio = null;
  let checkTimer = null;

  function defaultCfg() {
    const days = {};
    DAY_ORDER.forEach(d => { days[d] = { on: true, sleep: '22:00', wake: '06:00' }; });
    return { enabled: false, days, lastFired: {} };
  }

  const durStr = m => (m % 60 === 0 ? (m / 60) : (m / 60).toFixed(1).replace('.', ',')) + ' jam';

  /* ---------- IndexedDB (dipakai juga oleh service worker) ---------- */
  function idbOpen() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }

  function idbSet(key, val) {
    return idbOpen().then(db => {
      if (!db) return;
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(val, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      });
    });
  }

  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
    cfg = defaultCfg();
    if (saved && saved.days && DAY_ORDER.every(d => saved.days[d])) {
      cfg.enabled = !!saved.enabled;
      cfg.lastFired = saved.lastFired || {};
      DAY_ORDER.forEach(d => {
        cfg.days[d] = Object.assign({ on: true, sleep: '22:00', wake: '06:00' }, saved.days[d]);
      });
    }
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* kuota */ }
    const payload = { type: 'bq-alarm-save', cfg };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(payload);
    } else {
      idbSet('alarm', cfg);
    }
  }

  /* ---------- Audio ---------- */
  function ensureAudio() {
    if (audio) return audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio = { ctx: new AC(), master: null, oscs: [], timers: [], until: 0 };
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.12;
    audio.master.connect(audio.ctx.destination);
    return audio;
  }

  // Pastikan AudioContext benar-benar berjalan. Autoplay policy membuat
  // konteks berawal "suspended" — tanpa resume yang di-await, nada bisa senyap.
  // Mengembalikan true bila audio siap berbunyi.
  function ensureRunning(a) {
    return Promise.resolve()
      .then(() => {
        if (a.ctx.state === 'suspended') {
          const p = a.ctx.resume();
          if (p && typeof p.then === 'function') return p;
        }
      })
      .then(() => a.ctx.state === 'running')
      .catch(() => false);
  }

  function note(freq, at, dur, vol, type) {
    const a = ensureAudio();
    if (!a) return;
    const t = a.ctx.currentTime + at;
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.master);
    a.oscs.push(o);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function stopAll() {
    if (audio) {
      audio.timers.forEach(clearInterval); audio.timers = [];
      audio.oscs.forEach(o => { try { o.stop(); } catch (e) { /* already stopped */ } });
      audio.oscs = [];
      audio.until = 0;
      if (audio.ctx.state === 'running') audio.master.gain.value = 0.12;
    }
  }

  function scheduleUntilCheck(until) {
    const a = ensureAudio();
    a.until = until;
    a.timers.push(setInterval(() => {
      if (a.ctx.currentTime >= a.until) stopAll();
    }, 800));
  }

  // Melodi lembut slow (C pentatonik) — nada pengantar tidur.
  function playLullaby(auto) {
    const a = ensureAudio();
    if (!a) { alert('Browser tidak mendukung audio internal.'); return Promise.resolve(false); }
    return ensureRunning(a).then(running => {
      if (!running) return false;
      stopAll();
      const dur = auto ? 60 : 16;
      const scale = [523.25, 587.33, 659.25, 783.99, 880.00];
      const seq = [0, 1, 2, 1, 3, 2, 4, 3, 2, 1, 0, 1];
      const step = 0.82;
      for (let i = 0; i * step < dur; i++) {
        const idx = seq[i % seq.length];
        note(scale[idx], i * step, 0.85, 0.5);
        if (i % 2 === 0) note(scale[idx] * 2, i * step, 0.5, 0.14);
      }
      scheduleUntilCheck(a.ctx.currentTime + dur);
      showBar('lullaby');
      return true;
    });
  }

  // Dengung dua nada berulang — alarm bangun.
  function playWakeAlarm(auto) {
    const a = ensureAudio();
    if (!a) { alert('Browser tidak mendukung audio internal.'); return Promise.resolve(false); }
    return ensureRunning(a).then(running => {
      if (!running) return false;
      stopAll();
      a.master.gain.value = 0.12;
      const dur = auto ? 45 : 12;
      const until = a.ctx.currentTime + dur;
      const tones = [880, 659.25];
      let i = 0;
      while (a.ctx.currentTime + i * 0.55 < until) {
        note(tones[i % 2], i * 0.55, 0.4, 0.9, 'sine');
        i++;
      }
      scheduleUntilCheck(until);
      showBar('wake');
      return true;
    });
  }

  function stopTone() { stopAll(); hideBar('lullaby'); hideBar('wake'); }

  /* ---------- UI bar ---------- */
  function showBar(kind) {
    const el = document.getElementById(kind === 'wake' ? 'wakeBar' : 'lullabyBar');
    if (el) el.style.display = 'flex';
  }
  function hideBar(kind) {
    const el = document.getElementById(kind === 'wake' ? 'wakeBar' : 'lullabyBar');
    if (el) el.style.display = 'none';
  }

  function showNow() {
    hideBar('lullaby'); hideBar('wake');
  }

  /* ---------- Notifikasi ---------- */
  function showNotification(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'bq-sleep-alarm', silent: true });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { /* ignore */ }
  }

  function fire(kind) {
    const day = todayKey();
    const tid = new Date().toISOString().slice(0, 10);
    cfg.lastFired[day + ':' + kind] = tid;
    persist();
    if (kind === 'sleep') {
      showNotification('Waktunya tidur 🌙', 'Matikan layar, redupkan lampu. Nada pengantar tidur diputar 1 menit.');
      playLullaby(true);
    } else {
      showNotification('Waktunya bangun ☀️', 'Alarm bangun berbunyi — mulai hari dengan langkah ringan.');
      playWakeAlarm(true);
    }
  }

  function todayKey() {
    return new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
  }

  function check() {
    if (!cfg.enabled) return;
    const day = todayKey();
    const dc = cfg.days[day];
    if (!dc || !dc.on) return;
    const now = new Date();
    const tid = now.toISOString().slice(0, 10);
    const hh = now.getHours(), mm = now.getMinutes();
    const [sl, sm] = (dc.sleep || '22:00').split(':').map(Number);
    const [wk, wm] = (dc.wake || '06:00').split(':').map(Number);
    if (hh === sl && mm === sm && !cfg.lastFired[day + ':sleep']) fire('sleep');
    if (hh === wk && mm === wm && !cfg.lastFired[day + ':wake']) fire('wake');
  }

  /* ---------- Validasi rentang sehat ---------- */
  function dayMinutes(str) {
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  }

  function validateDay(day, dc) {
    const sleepM = dayMinutes(dc.sleep);
    const bedN = sleepM >= 19 * 60 ? sleepM : sleepM + 24 * 60; // 19:00–02:00 (02:00 = 26:00)
    const wakeM = dayMinutes(dc.wake);
    const wakeN = wakeM >= 12 * 60 ? wakeM : wakeM + 24 * 60;
    const dur = wakeN - bedN;
    const issues = [];
    if (bedN < RANGES.sleep.min || bedN > RANGES.sleep.max || bedN >= wakeN) {
      issues.push('jam tidur: 19:00–02:00');
    }
    if (wakeM < RANGES.wake.min || wakeM > RANGES.wake.max) {
      issues.push('jam bangun: 04:30–09:59');
    }
    if (dur < RANGES.dur.min) issues.push('minimal 6 jam');
    if (dur > RANGES.dur.max) issues.push('maksimal 10 jam');
    return issues;
  }

  // Validasi & rendar row: durasi.
  function rowDur(dc) {
    const sleepM = dayMinutes(dc.sleep);
    const bedN = sleepM >= 19 * 60 ? sleepM : sleepM + 24 * 60;
    const wakeM = dayMinutes(dc.wake);
    const wakeN = wakeM >= 12 * 60 ? wakeM : wakeM + 24 * 60;
    const dur = wakeN - bedN;
    return dur > 0 ? durStr(dur) : '—';
  }

  /* ---------- UI: jadwal mingguan ---------- */
  function buildEditFromCfg() {
    edit = {};
    DAY_ORDER.forEach(d => { edit[d] = Object.assign({}, cfg.days[d]); });
  }

  function renderSchedule() {
    const wrap = document.getElementById('scheduleList');
    if (!wrap) return;
    wrap.innerHTML = '';
    DAY_ORDER.forEach(d => {
      const dc = edit[d];
      const row = document.createElement('div');
      row.className = 'alarm-day-row';
      row.innerHTML = `
        <label class="sched-on">
          <input type="checkbox" class="sched-enable">
          <span>${DAY_LABEL[d]}</span>
        </label>
        <div class="sched-times">
          <label class="sched-t">Tidur<input type="time" class="sched-sleep"></label>
          <label class="sched-t"><svg class="ic"><use href="#i-sun"/></svg><span>Bangun</span><input type="time" class="sched-wake"></label>
        </div>
        <span class="sched-dur"></span>`;
      const on = row.querySelector('.sched-enable');
      const sl = row.querySelector('.sched-sleep');
      const wk = row.querySelector('.sched-wake');
      const durEl = row.querySelector('.sched-dur');
      on.checked = dc.on;
      sl.value = dc.sleep;
      wk.value = dc.wake;
      const upd = () => {
        dc.on = on.checked;
        dc.sleep = sl.value || '22:00';
        dc.wake = wk.value || '06:00';
        durEl.textContent = dc.on ? rowDur(dc) : '—';
        row.classList.toggle('off', !dc.on);
      };
      on.addEventListener('change', upd);
      sl.addEventListener('change', upd);
      wk.addEventListener('change', upd);
      upd();
      wrap.appendChild(row);
    });
  }

  function copySeninToAll() {
    const src = DAY_ORDER[0];
    const s = edit[src];
    DAY_ORDER.forEach(d => { edit[d].sleep = s.sleep; edit[d].wake = s.wake; });
    renderSchedule();
  }

  function renderStatus() {
    const toggle = document.getElementById('alarmToggle');
    const stat = document.getElementById('alarmStatus');
    if (toggle) toggle.checked = cfg.enabled;
    if (stat) {
      if (cfg.enabled) {
        const n = DAY_ORDER.filter(d => cfg.days[d].on).length;
        stat.innerHTML = `Alarm <b>aktif</b> untuk <b>${n} dari 7 hari</b> — nada tidur & alarm bangun otomatis sesuai jadwal.`;
        stat.className = 'alarm-status on';
      } else {
        stat.textContent = 'Alarm nonaktif — nyalakan untuk pengingat harian.';
        stat.className = 'alarm-status';
      }
    }
  }

  function saveAlarm() {
    const err = document.getElementById('alarmError');
    err.textContent = '';
    let problems = [];
    DAY_ORDER.forEach(d => {
      const dc = edit[d];
      if (!dc.on) return;
      validateDay(d, dc).forEach(msg => problems.push(DAY_LABEL[d] + ': ' + msg));
    });
    if (problems.length) {
      err.textContent = 'Cek jadwal: ' + problems.slice(0, 2).join(' · ') + (problems.length > 2 ? ' …' : '') + '.';
      return;
    }
    cfg.days = edit;
    cfg.enabled = document.getElementById('alarmToggle').checked;
    persist();
    renderStatus();
    const stat = document.getElementById('alarmStatus');
    if (stat) { stat.textContent = 'Jadwal tersimpan ✓'; stat.className = 'alarm-status on'; }
  }

  async function toggleAlarm(on) {
    if (on) {
      const err = document.getElementById('alarmError');
      if (err) err.textContent = '';
      const problems = [];
      DAY_ORDER.forEach(d => {
        const dc = edit[d];
        if (!dc.on) return;
        validateDay(d, dc).forEach(msg => problems.push(DAY_LABEL[d] + ': ' + msg));
      });
      if (problems.length) {
        const toggle = document.getElementById('alarmToggle');
        if (toggle) toggle.checked = false;
        if (err) err.textContent = 'Cek jadwal: ' + problems.slice(0, 2).join(' · ') + (problems.length > 2 ? ' …' : '') + '.';
        return;
      }
      if ('Notification' in window && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch (e) { /* ignored */ }
      }
    }
    cfg.enabled = on;
    persist();
    renderStatus();
    if (!on) stopTone();
  }

  function startCheck() {
    if (!checkTimer && cfg.enabled) checkTimer = setInterval(check, CHECK_MS);
  }

  function init() {
    load();
    buildEditFromCfg();

    const toggle = document.getElementById('alarmToggle');
    const saveBtn = document.getElementById('saveAlarmBtn');
    const copyAll = document.getElementById('copyAllBtn');
    const lullabyStop = document.getElementById('lullabyStopBtn');
    const wakeStop = document.getElementById('wakeStopBtn');

    renderSchedule();
    renderStatus();
    if (toggle) toggle.checked = cfg.enabled;
    if (toggle) toggle.addEventListener('change', () => toggleAlarm(toggle.checked));
    if (saveBtn) saveBtn.addEventListener('click', saveAlarm);
    if (copyAll) copyAll.addEventListener('click', copySeninToAll);
    if (lullabyStop) lullabyStop.addEventListener('click', stopTone);
    if (wakeStop) wakeStop.addEventListener('click', stopTone);

    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (!e.data || !e.data.type) return;
        if (e.data.type === 'bq-lullaby') playLullaby(true);
        if (e.data.type === 'bq-wake') playWakeAlarm(true);
      });
    }
    startCheck();
    window.addEventListener('bq:viewchange', startCheck);
  }

  return { init, playLullaby, playWakeAlarm, stopTone, todayKey, DAY_ORDER, DAY_LABEL, RANGES, rowDur };
})();