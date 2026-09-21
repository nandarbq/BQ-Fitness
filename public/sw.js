const CACHE_NAME = 'bq-fitness-v24';
const APP_SHELL = [
  './',
  './index.html',
  './google-callback.html',
  './manifest.json',
  './css/style.css',
  './js/icons.js',
  './js/api.js',
  './js/workout-program.js',
  './js/meal-db.js',
  './js/exercise-demo.js',
  './js/theme.js',
  './js/nav.js',
  './js/auth-ui.js',
  './js/dashboard.js',
  './js/workout.js',
  './js/onboarding.js',
  './js/running.js',
  './js/food.js',
  './js/sleep.js',
  './js/sleep-reminder.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* ---- Pengingat tidur latar belakang (service worker) ---- */
const ALARM_IDB = 'bq_db';
const ALARM_STORE = 'kv';

function alarmOpen() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(ALARM_IDB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(ALARM_STORE)) req.result.createObjectStore(ALARM_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

function alarmRead() {
  return alarmOpen().then(db => {
    if (!db) return Promise.resolve(null);
    return new Promise(resolve => {
      const tx = db.transaction(ALARM_STORE, 'readonly');
      const req = tx.objectStore(ALARM_STORE).get('alarm');
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror = () => { db.close(); resolve(null); };
    });
  });
}

function alarmWrite(key, val) {
  return alarmOpen().then(db => {
    if (!db) return;
    const tx = db.transaction(ALARM_STORE, 'readwrite');
    tx.objectStore(ALARM_STORE).put(val, key);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

self.addEventListener('message', (event) => {
  if (!event.data || !event.data.type) return;
  if (event.data.type === 'bq-alarm-save' && event.data.cfg) {
    alarmWrite('alarm', event.data.cfg);
  }
});

function checkAlarm() {
  alarmRead().then(cfg => {
    if (!cfg || !cfg.enabled || !cfg.days) return;
    const now = new Date();
    const tid = now.toISOString().slice(0, 10);
    const day = now.toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
    const dc = cfg.days[day];
    if (!dc || !dc.on) return;
    cfg.lastFired = cfg.lastFired || {};
    const hh = now.getHours();
    const mm = now.getMinutes();
    const [sl, sm] = (dc.sleep || '22:00').split(':').map(Number);
    const [wk, wm] = (dc.wake || '06:00').split(':').map(Number);

    if (hh === sl && mm === sm && cfg.lastFired[day + ':sleep'] !== tid) {
      cfg.lastFired[day + ':sleep'] = tid;
      alarmWrite('alarm', cfg);
      self.registration.showNotification('Waktunya tidur 🌙', {
        body: 'Sandarkan kepala — jadwal tidurmu dimulai. Nada pengantar diputar bila aplikasi terbuka.',
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'bq-sleep-alarm',
        silent: false
      }).catch(() => {});
      postToClients({ type: 'bq-lullaby' });
    }
    if (hh === wk && mm === wm && cfg.lastFired[day + ':wake'] !== tid) {
      cfg.lastFired[day + ':wake'] = tid;
      alarmWrite('alarm', cfg);
      self.registration.showNotification('Waktunya bangun ☀️', {
        body: 'Alarm bangun berbunyi — mulai hari dengan langkah ringan.',
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'bq-sleep-alarm',
        silent: false
      }).catch(() => {});
      postToClients({ type: 'bq-wake' });
    }
  });
}

function postToClients(data) {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    clients.forEach(c => c.postMessage(data));
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length) { clients[0].focus(); return undefined; }
      return self.clients.openWindow('./');
    })
  );
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim()).then(() => {
      setInterval(checkAlarm, 20000);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests; let the browser deal with the rest.
  if (event.request.method !== 'GET') return;

  // Never cache API calls — always go to network so data stays fresh and accurate.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.origin === self.location.origin) {
    // Network-first: always try fresh so local changes appear immediately,
    // fall back to cache only when offline.
    event.respondWith(
      fetch(event.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return resp;
      }).catch(() =>
        caches.match(event.request).then(cached => cached || caches.match('./index.html'))
      )
    );
  } else {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
