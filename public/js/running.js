const RUNNING = (() => {
  let map, pathLine;
  let mode = 'running';
  let watchId = null;
  let wakeLock = null;
  let tracking = false;
  let paused = false;
  let points = [];
  let distanceKm = 0;
  let startTime = null;
  let elapsedBeforePause = 0;
  let pauseStarted = null;
  let tickInterval = null;
  let cache = [];

  const METS = { running: 9.8, cycling: 7.5 };

  async function init() {
    map = L.map('runMap', { zoomControl: false, attributionControl: false }).setView([-7.98, 112.63], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    pathLine = L.polyline([], { color: getComputedStyle(document.documentElement).getPropertyValue('--red') || '#B3122A', weight: 5 }).addTo(map);

    document.getElementById('runModeToggle').addEventListener('click', (e) => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      setMode(btn.dataset.mode);
    });
    window.addEventListener('bq:setRunMode', (e) => setMode(e.detail.mode));

    document.getElementById('runStartBtn').addEventListener('click', startTracking);
    document.getElementById('runPauseBtn').addEventListener('click', togglePause);
    document.getElementById('runStopBtn').addEventListener('click', stopTracking);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 15);
      }, () => {}, { enableHighAccuracy: false, timeout: 4000 });
    }

    await refresh();
  }

  async function refresh() {
    try {
      cache = await API.getActivities();
    } catch (e) { cache = []; }
    renderHistory();
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('#runModeToggle .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  }

  function startTracking() {
    if (!navigator.geolocation) {
      setStatus('Perangkat ini tidak mendukung GPS.');
      return;
    }
    tracking = true;
    paused = false;
    points = [];
    distanceKm = 0;
    startTime = Date.now();
    elapsedBeforePause = 0;
    pathLine.setLatLngs([]);

    document.getElementById('runStartBtn').style.display = 'none';
    document.getElementById('runPauseBtn').style.display = 'inline-block';
    document.getElementById('runStopBtn').style.display = 'inline-block';
    document.getElementById('runPauseBtn').innerHTML = ICON('pause') + ' Jeda';

    requestWakeLock();
    setStatus('Mencari sinyal GPS…');

    watchId = navigator.geolocation.watchPosition(onPosition, onPosError, {
      enableHighAccuracy: true, maximumAge: 1000, timeout: 15000
    });
    tickInterval = setInterval(updateTimeDisplay, 1000);
  }

  function onPosition(pos) {
    setStatus('GPS aktif');
    if (paused) return;
    const { latitude, longitude } = pos.coords;
    const pt = { lat: latitude, lng: longitude, t: Date.now() };

    if (points.length > 0) {
      const prev = points[points.length - 1];
      const d = haversine(prev.lat, prev.lng, pt.lat, pt.lng);
      if (d > 0.001) distanceKm += d;
    }
    points.push(pt);
    pathLine.addLatLng([pt.lat, pt.lng]);
    map.panTo([pt.lat, pt.lng]);
    updateMetrics();
  }

  function onPosError(err) {
    setStatus('GPS bermasalah: ' + (err.message || 'sinyal lemah') + '. Tetap di luar ruangan untuk sinyal terbaik.');
  }

  function togglePause() {
    if (!paused) {
      paused = true;
      pauseStarted = Date.now();
      document.getElementById('runPauseBtn').innerHTML = ICON('play') + ' Lanjut';
      setStatus('Dijeda');
    } else {
      paused = false;
      elapsedBeforePause += Date.now() - pauseStarted;
      document.getElementById('runPauseBtn').innerHTML = ICON('pause') + ' Jeda';
      setStatus('GPS aktif');
    }
  }

  async function stopTracking() {
    if (!tracking) return;
    tracking = false;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    clearInterval(tickInterval);
    releaseWakeLock();

    const totalMs = (paused ? pauseStarted : Date.now()) - startTime - elapsedBeforePause;
    const durationSec = Math.max(1, Math.round(totalMs / 1000));
    const kcal = Math.round(METS[mode] * 3.5 * ((API.getUser() && API.getUser().weight) || 65) / 200 * (durationSec / 60));

    if (distanceKm >= 0.05) {
      const payload = {
        type: mode, date: API.todayISO(),
        distanceKm: Math.round(distanceKm * 100) / 100,
        durationSec, kcal, points: points.map(p => [p.lat, p.lng])
      };
      try {
        await API.addActivity(payload);
        await refresh();
        window.dispatchEvent(new CustomEvent('bq:dataChanged'));
        setStatus('Aktivitas tersimpan.');
      } catch (e) {
        setStatus('Gagal menyimpan aktivitas: ' + e.message);
      }
    } else {
      setStatus('Aktivitas terlalu pendek, tidak disimpan.');
    }

    document.getElementById('runStartBtn').style.display = 'inline-block';
    document.getElementById('runPauseBtn').style.display = 'none';
    document.getElementById('runStopBtn').style.display = 'none';

    resetDisplay();
  }

  function updateMetrics() {
    document.getElementById('runDistance').textContent = distanceKm.toFixed(2);
    const durationSec = getElapsedSec();
    document.getElementById('runPace').textContent = formatPace(durationSec, distanceKm);
    const kcal = Math.round(METS[mode] * 3.5 * ((API.getUser() && API.getUser().weight) || 65) / 200 * (durationSec / 60));
    document.getElementById('runCal').textContent = kcal;
  }

  function updateTimeDisplay() {
    const s = getElapsedSec();
    document.getElementById('runTime').textContent = formatHMS(s);
    updateMetrics();
  }

  function getElapsedSec() {
    if (!startTime) return 0;
    const now = paused ? pauseStarted : Date.now();
    return Math.max(0, Math.round((now - startTime - elapsedBeforePause) / 1000));
  }

  function resetDisplay() {
    setTimeout(() => {
      document.getElementById('runDistance').textContent = '0.00';
      document.getElementById('runTime').textContent = '00:00:00';
      document.getElementById('runPace').textContent = "0'00\"";
      document.getElementById('runCal').textContent = '0';
    }, 1500);
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatHMS(s) {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }
  function formatPace(durationSec, km) {
    if (km < 0.01) return "0'00\"";
    const paceSecPerKm = durationSec / km;
    const m = Math.floor(paceSecPerKm / 60);
    const s = Math.round(paceSecPerKm % 60);
    return `${m}'${String(s).padStart(2, '0')}"`;
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* ignore, not critical */ }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  function setStatus(text) {
    document.getElementById('gpsStatus').textContent = text;
  }

  function renderHistory() {
    const box = document.getElementById('runHistory');
    if (!cache.length) {
      box.innerHTML = '<p class="empty-note">Belum ada aktivitas lari/sepeda.</p>';
      return;
    }
    box.innerHTML = '';
    cache.slice(0, 30).forEach(a => {
      const el = document.createElement('div');
      el.className = 'history-item';
      const icon = a.type === 'running' ? ICON('footprints') : ICON('bike');
      el.innerHTML = `
        <div class="h-left">
          <strong>${icon} ${a.type === 'running' ? 'Lari' : 'Sepeda'}</strong>
          <span>${formatDate(a.date)} · ${formatHMS(a.durationSec)}</span>
        </div>
        <div class="h-right">${a.distanceKm}<small>km · ${a.kcal} kkal</small></div>`;
      box.appendChild(el);
    });
  }

  function weekDistanceKm() {
    const weekAgo = Date.now() - 7 * 86400000;
    return cache.filter(a => new Date(a.date).getTime() >= weekAgo).reduce((sum, a) => sum + a.distanceKm, 0);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  window.addEventListener('bq:viewchange', (e) => {
    if (e.detail.id === 'view-run' && map) setTimeout(() => map.invalidateSize(), 200);
  });

  return { init, weekDistanceKm, refresh, getCache: () => cache };
})();
