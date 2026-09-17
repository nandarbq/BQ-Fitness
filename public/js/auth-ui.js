const AUTH_UI = (() => {
  function init(onSuccess) {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = { login: document.getElementById('loginForm'), register: document.getElementById('registerForm') };
    const switchText = document.getElementById('authSwitchText');
    const switchLink = document.getElementById('authSwitchLink');
    const errorBox = document.getElementById('authError');
    const resetBox = document.getElementById('resetPwBox');
    const resetLink = document.getElementById('resetPwLink');
    const resetBack = document.getElementById('resetPwBack');
    const resetBtn = document.getElementById('resetPwBtn');
    const resetMsg = document.getElementById('resetPwMsg');

    function showReset(show) {
      resetBox.style.display = show ? 'block' : 'none';
      resetMsg.textContent = '';
      if (!show) {
        document.getElementById('resetPwEmail').value = '';
        resetBtn.disabled = false;
      }
    }

    function setTab(name) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
      Object.entries(forms).forEach(([k, f]) => f.classList.toggle('active', k === name));
      showReset(false);
      errorBox.textContent = '';
      switchText.innerHTML = name === 'login'
        ? 'Belum punya akun? <a id="authSwitchLink">Daftar di sini</a>'
        : 'Sudah punya akun? <a id="authSwitchLink">Masuk di sini</a>';
      document.getElementById('authSwitchLink').addEventListener('click', () => setTab(name === 'login' ? 'register' : 'login'));
    }

    tabs.forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
    switchLink.addEventListener('click', () => setTab('register'));

    forms.login.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.textContent = '';
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      try {
        await API.login(email, password);
        onSuccess();
      } catch (err) {
        errorBox.textContent = err.message;
      }
    });

    forms.register.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.textContent = '';
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      try {
        await API.register(name, email, password);
        onSuccess();
      } catch (err) {
        errorBox.textContent = err.message;
      }
    });

    if (resetLink) resetLink.addEventListener('click', () => showReset(true));
    if (resetBack) resetBack.addEventListener('click', () => showReset(false));
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const email = document.getElementById('resetPwEmail').value.trim();
        if (!email) { resetMsg.textContent = 'Masukkan email kamu dulu.'; return; }
        resetBtn.disabled = true;
        try {
          await API.resetPassword(email);
          resetMsg.textContent = 'Link reset sudah dikirim ke emailmu.';
          setTimeout(() => showReset(false), 2500);
        } catch (err) {
          resetMsg.textContent = err.message;
          resetBtn.disabled = false;
        }
      });
      document.getElementById('resetPwEmail').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') resetBtn.click();
      });
    }
  }

  function show() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  }
  function hide() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  }

  return { init, show, hide };
})();
