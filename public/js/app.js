document.addEventListener('DOMContentLoaded', async () => {
  NAV.init();

  AUTH_UI.init(async () => {
    AUTH_UI.hide();
    await bootstrapApp();
  });

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

async function bootstrapApp() {
  initProfile();
  if (appBootstrapped) {
    // returning session after logout/login again: refresh everything
    await Promise.all([WORKOUT.refresh(), RUNNING.refresh(), FOOD.refresh(), SLEEP.refresh()]);
    DASHBOARD.render();
    return;
  }
  appBootstrapped = true;
  await Promise.all([WORKOUT.init(), RUNNING.init(), FOOD.init(), SLEEP.init()]);
  DASHBOARD.init();

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
    try {
      await API.saveProfile(profile);
      NAV.closeModal('profileModal');
      DASHBOARD.render();
    } catch (e) {
      alert('Gagal menyimpan profil: ' + e.message);
    }
  });
}
