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
      ov.addEventListener('click', (e) => {
        // data-no-close (tanpa nilai juga) = modal wajib, tidak boleh ditutup dari klik overlay
        if (e.target === ov && !ov.hasAttribute('data-no-close')) closeModal(ov.id);
      });
    });
    // tombol Esc tidak boleh menutup modal wajib
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.querySelector('.modal-overlay.open[data-no-close]')) {
        e.preventDefault();
      }
    });
  }

  function openModal(id) { document.getElementById(id).classList.add('open'); refreshOverlayState(); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); refreshOverlayState(); }

  // Kunci scroll halaman saat ada modal terbuka
  function refreshOverlayState() {
    const anyOpen = !!document.querySelector('.modal-overlay.open');
    document.body.classList.toggle('no-scroll', anyOpen);
  }

  return { init, showView, openModal, closeModal, refreshOverlayState };
})();
