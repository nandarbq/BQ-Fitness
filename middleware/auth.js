const supabase = require('../db/database');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan. Silakan login kembali.' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: 'Sesi tidak valid atau kedaluwarsa. Silakan login kembali.' });
    }
    req.user = data.user;
    req.userId = data.user.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesi tidak valid atau kedaluwarsa. Silakan login kembali.' });
  }
}

module.exports = { requireAuth };
