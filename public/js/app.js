document.addEventListener('DOMContentLoaded', async () => {
  NAV.init();

  AUTH_UI.init(async () => {
    AUTH_UI.hide();
    await bootstrapApp();
  });

  // Jaring pengaman: bila redirect OAuth nyasar ke halaman utama
  // (mis. karena APP_URL belum ter-set dengan benar), token tetap diproses.
  const oauthViaHash = await handleOAuthCallback();

  if (API.isAuthed()) {
    try {
      await API.fetchMe();
      AUTH_UI.hide();
      await bootstrapApp();
    } catch (e) {
      AUTH_UI.show();
    }
  } else {
    AUTH_UI.show();
    if (oauthViaHash === false) {
      const err = document.getElementById('authError');
      if (err) err.textContent = 'Login Google gagal. Silakan coba lagi.';
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
        reg.update();
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        });
      }).catch(err => console.log('SW gagal:', err));
    });
  }
});

let appBootstrapped = false;

/* Baca token OAuth dari URL hash (#access_token=...), finalisasi ke server,
 * lalu simpan sesi. Mengembalikan true=berhasil, false=gagal, null=tidak ada hash. */
async function handleOAuthCallback() {
  const h = new URLSearchParams(location.hash.slice(1));
  const accessToken = h.get('access_token');
  if (!accessToken) return null;
  const sessionPayload = { access_token: accessToken };
  const refreshToken = h.get('refresh_token');
  if (refreshToken) sessionPayload.refresh_token = refreshToken;
  const expiresAt = Number(h.get('expires_at') || 0);
  if (expiresAt) sessionPayload.expires_at = expiresAt;
  history.replaceState(null, '', location.pathname + location.search);

  try {
    const res = await fetch('/api/auth/google/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: sessionPayload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.session) return false;
    API.applyOAuthSession(data.session, data.user);
    return true;
  } catch (e) {
    return false;
  }
}

async function bootstrapApp() {
  initProfile();
  ONBOARDING.init();
  if (appBootstrapped) {
    // returning session after logout/login again: refresh everything
    await Promise.all([WORKOUT.refresh(), RUNNING.refresh(), FOOD.refresh(), SLEEP.refresh()]);
    DASHBOARD.render();
    ONBOARDING.start();
    return;
  }
  appBootstrapped = true;
  await Promise.all([WORKOUT.init(), RUNNING.init(), FOOD.init(), SLEEP.init()]);
  DASHBOARD.init();
  ONBOARDING.start();

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await API.logout();
    location.reload();
  });
}

function initProfile() {
  const p = API.getUser() || {};
  document.getElementById('profName').value = p.name || '';
  document.getElementById('profWeight').value = p.weight || 65;
  document.getElementById('profHeight').value = p.height || 170;
  document.getElementById('profSleepTarget').value = p.sleepTarget || 8;
  DOB.init('prof', p.birthdate || '');
  const hint = document.getElementById('profAgeHint');
  const updateHint = () => {
    const age = calcAge(DOB.read('prof'));
    if (hint) hint.textContent = age != null ? '' : 'Wajib diisi — pilih tanggal lahir kamu.';
  };
  document.addEventListener('bq:dobchange', (e) => {
    if (e && e.detail && e.detail.prefix !== 'prof') return;
    updateHint();
  });
  updateHint();

  const saveBtn = document.getElementById('saveProfileBtn');
  const freshBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(freshBtn, saveBtn);
  freshBtn.addEventListener('click', async () => {
    const profile = {
      name: document.getElementById('profName').value.trim(),
      weight: parseFloat(document.getElementById('profWeight').value) || 65,
      height: parseFloat(document.getElementById('profHeight').value) || 170,
      sleepTarget: parseFloat(document.getElementById('profSleepTarget').value) || 8
    };
    const birthVal = DOB.read('prof');
    if (!birthVal) { alert('Tanggal lahir wajib diisi.'); return; }
    profile.birthdate = birthVal;
    try {
      await API.saveProfile(profile);
      NAV.closeModal('profileModal');
      DASHBOARD.render();
    } catch (e) {
      alert('Gagal menyimpan profil: ' + e.message);
    }
  });
}
