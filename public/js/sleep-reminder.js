/* Pengingat tidur: notifikasi + nada pengantar tidur (WebAudio), juga meneruskan
   konfigurasi ke service worker agar tetap berbunyi walau aplikasi ditutup. */
const SLEEP_REMINDER = (() => {
  const KEY = 'bq_sleep_alarm_v1';
  const IDB_NAME = 'bq_db';
  const IDB_STORE = 'kv';
  const CHECK_MS = 15000;

  let cfg = { enabled: false, time: '22:00', lastFired: '' };
  let audio = null;

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
    try { cfg = Object.assign({ enabled: false, time: '22:00', lastFired: '' }, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { /* reset ke default */ }
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* kuota */ }
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'bq-alarm-save', cfg });
    } else {
      idbSet('alarm', cfg);
    }
  }

  /* ---------- Nada pengantar tidur ---------- */
  function ensureAudio() {
    if (audio) return audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio = { ctx: new AC(), master: null, timers: [], loop: false, until: 0 };
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.12;
    audio.master.connect(audio.ctx.destination);
    return audio;
  }

  function note(freq, at, dur, vol) {
    const a = ensureAudio();
    if (!a) return;
    const t = a.ctx.currentTime + at;
    const o1 = a.ctx.createOscillator();
    const o2 = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o1.type = 'sine';
    o2.type = 'triangle';
    o1.frequency.value = freq;
    o2.frequency.value = freq / 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.connect(g); o2.connect(g); g.connect(a.master);
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  // Melodi lembut slow (C pentatonik), ~0.8 detik per nada.
  function scheduleLullaby(from, durSec) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.00]; // C5 D5 E5 G5 A5
    const seq = [0, 1, 2, 1, 3, 2, 4, 3, 2, 1, 0, 1];
    const step = 0.82;
    let i = 0;
    while (i * step < durSec) {
      const idx = seq[i % seq.length];
      (() => {
        const t = from + i * step;
        note(scale[idx], t, 0.85, 0.5);
        if (i % 2 === 0) note(scale[idx] * 2, t, 0.5, 0.14);
      })();
      i++;
    }
  }

  function playLullaby(auto) {
    const a = ensureAudio();
    if (!a) { alert('Browser tidak mendukung audio internal.'); return; }
    if (a.ctx.state === 'suspended') a.ctx.resume();
    stopLullaby();
    const dur = auto ? 60 : 16;
    a.until = a.ctx.currentTime + dur;
    scheduleLullaby(a.ctx.currentTime + 0.05, dur);
    a.timers.push(setInterval(() => {
      if (a.ctx.currentTime >= a.until) stopLullaby();
    }, 1000));
    setPlayingUI(true);
    return true;
  }

  function stopLullaby() {
    if (audio) {
      audio.timers.forEach(clearInterval);
      audio.timers = [];
      audio.until = 0;
    }
    setPlayingUI(false);
  }

  function setPlayingUI(on) {
    const bar = document.getElementById('lullabyBar');
    const stopBtn = document.getElementById('alarmStopBtn');
    if (bar) bar.style.display = on ? 'flex' : 'none';
    if (stopBtn) stopBtn.style.display = on ? '' : 'none';
  }

  /* ---------- Notifikasi ---------- */
  function showNotification() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification('Waktunya tidur 🌙', {
        body: `Sudah jam ${cfg.time}. Matikan layar, redupkan lampu — pemulihan ototmu menunggu.`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'bq-sleep-reminder',
        silent: true
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { /* ignore */ }
  }

  async function fire() {
    cfg.lastFired = new Date().toISOString().slice(0, 10);
    persist();
    showNotification();
    playLullaby(true);
  }

  function check() {
    if (!cfg.enabled) return;
    const now = new Date();
    if (cfg.lastFired === now.toISOString().slice(0, 10)) return;
    const [hh, mm] = (cfg.time || '22:00').split(':').map(Number);
    if (now.getHours() === hh && now.getMinutes() === mm) fire();
  }

  /* ---------- UI ---------- */
  function renderStatus() {
    const toggle = document.getElementById('alarmToggle');
    const stat = document.getElementById('alarmStatus');
    if (toggle) toggle.checked = cfg.enabled;
    if (stat) {
      if (cfg.enabled) {
        const [h, m] = (cfg.time || '').split(':');
        stat.innerHTML = `Pengingat <b>aktif</b> pukul <b>${h}:${m}</b> · notifikasi + nada pengantar tidur 1 menit.`;
        stat.className = 'alarm-status on';
      } else {
        stat.textContent = 'Pengingat nonaktif — setel jam lalu nyalakan.';
        stat.className = 'alarm-status';
      }
    }
  }

  async function toggleAlarm(on) {
    cfg.enabled = on;
    if (on) {
      const t = document.getElementById('alarmTime');
      if (t && t.value) cfg.time = t.value;
    }
    if (on && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (e) { /* ignored */ }
    }
    persist();
    renderStatus();
    if (!on) stopLullaby();
  }

  function init() {
    load();
    const toggle = document.getElementById('alarmToggle');
    const time = document.getElementById('alarmTime');
    const testBtn = document.getElementById('alarmTestBtn');
    const stopBtn = document.getElementById('alarmStopBtn');
    const lullabyStop = document.getElementById('lullabyStopBtn');

    if (time) time.value = cfg.time;
    if (toggle) toggle.addEventListener('change', () => toggleAlarm(toggle.checked));
    if (time) time.addEventListener('change', () => {
      cfg.time = time.value;
      if (cfg.enabled) {
        cfg.lastFired = '';
        persist();
      }
    });
    if (testBtn) testBtn.addEventListener('click', () => {
      if ('Notification' in window && Notification.permission === 'denied') {
        showNotification();
      }
      playLullaby(false);
    });
    if (stopBtn) stopBtn.addEventListener('click', stopLullaby);
    if (lullabyStop) lullabyStop.addEventListener('click', stopLullaby);

    renderStatus();
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'bq-lullaby') playLullaby(true);
      });
    }
    if (cfg.enabled) setInterval(check, CHECK_MS);
  }

  return { init, playLullaby, stopLullaby };
})();