const NAV = (() => {
  function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === id);
    });
    window.dispatchEvent(new CustomEvent('bq:viewchange', { detail: { id } }));
  }

  function init() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => showView(btn.dataset.view));
    });
    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => {
        showView(btn.dataset.goto);
        if (btn.dataset.mode) {
          window.dispatchEvent(new CustomEvent('bq:setRunMode', { detail: { mode: btn.dataset.mode } }));
        }
      });
    });
    // profile modal
    document.getElementById('openProfile').addEventListener('click', () => openModal('profileModal'));
    document.getElementById('closeProfile').addEventListener('click', () => closeModal('profileModal'));
    document.getElementById('closeFoodModal').addEventListener('click', () => closeModal('foodModal'));
    document.querySelectorAll('.modal-overlay').forEach(ov => {
      ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('open'); });
    });
  }

  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  return { init, showView, openModal, closeModal };
})();
