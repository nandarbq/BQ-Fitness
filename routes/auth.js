const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db/database');
const { requireAuth, signToken } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    weight: row.weight,
    height: row.height,
    sleepTarget: row.sleep_target
  };
}

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (existing) {
    return res.status(409).json({ error: 'Email ini sudah terdaftar. Silakan masuk.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const { data: user, error } = await supabase
    .from('users')
    .insert({ name: String(name).trim(), email: normalizedEmail, password_hash: hash })
    .select('*')
    .single();
  if (error) throw error;

  await supabase.from('food_goals').insert({ user_id: user.id });

  const token = signToken(user.id);
  res.status(201).json({ token, user: publicUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email atau kata sandi salah.' });
  }
  const token = signToken(user.id);
  res.json({ token, user: publicUser(user) });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.userId)
    .maybeSingle();
  if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  res.json({ user: publicUser(user) });
}));

module.exports = router;