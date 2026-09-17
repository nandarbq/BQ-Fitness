document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.hash.slice(1));
  const accessToken = params.get('access_token');
  const form = document.getElementById('resetForm');
  const msg = document.getElementById('msg');

  // Buang token dari URL biar tidak telanjang di riwayat browser
  if (location.hash) history.replaceState(null, '', location.pathname);

  if (!accessToken) {
    msg.textContent = 'Tautan reset tidak valid atau sudah kedaluwarsa. Minta link baru dari halaman Masuk.';
    form.style.display = 'none';
    document.getElementById('backToApp').textContent = 'Kembali ke halaman masuk';
    document.getElementById('backToApp').addEventListener('click', () => location.href = '/');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('pw').value;
    const pw2 = document.getElementById('pw2').value;
    if (pw !== pw2) { msg.textContent = 'Kata sandi tidak sama.'; return; }
    try {
      await API.updatePassword(accessToken, pw);
      msg.textContent = 'Kata sandi berhasil diperbarui. Silakan masuk.';
      form.style.display = 'none';
      document.getElementById('backToApp').textContent = 'Lanjut ke halaman masuk';
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  document.getElementById('backToApp').addEventListener('click', () => location.href = '/');
});