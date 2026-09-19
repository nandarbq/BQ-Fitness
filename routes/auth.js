const express = require('express');
const supabase = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { parseRestDays, effectiveAge } = require('../lib/program');

const router = express.Router();

function publicProfile(row) {
  return {
    id: row.id,
    name: row.name,
    weight: row.weight,
    height: row.height,
    sleepTarget: row.sleep_target,
    gender: row.gender,
    age: effectiveAge(row),
    birthdate: row.birthdate || null,
    activityLevel: row.activity_level,
    intensity: row.intensity,
    restDays: parseRestDays(row.rest_days),
    program: row.program,
    programStart: row.program_start,
    targetWeight: row.target_weight,
    durationWeeks: row.duration_weeks,
    lastWeightDate: row.last_weight_date
  };
}

function isDuplicateEmailError(error) {
  const message = (error && error.message) || '';
  return /already registered|already been registered|user already exists|email.*exists/i.test(message);
}

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
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
  const trimmedName = String(name).trim();

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { name: trimmedName }
  });
  if (error) {
    if (isDuplicateEmailError(error)) {
      return res.status(409).json({ error: 'Email ini sudah terdaftar. Silakan masuk.' });
    }
    throw error;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: created.user.id, name: trimmedName });
  if (profileError) throw profileError;

  const { error: goalError } = await supabase
    .from('food_goals')
    .insert({ user_id: created.user.id });
  if (goalError) throw goalError;

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });
  if (signInError) throw signInError;

  res.status(201).json({
    session: signIn.session,
    user: { id: created.user.id, name: trimmedName, weight: 65, height: 170, sleepTarget: 8 }
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });
  if (error || !data.session) {
    return res.status(401).json({ error: 'Email atau kata sandi salah.' });
  }

  const profile = await getProfile(data.user.id);
  res.json({
    session: data.session,
    user: profile ? publicProfile(profile) : { id: data.user.id, name: '', weight: 65, height: 170, sleepTarget: 8 }
  });
}));

/* ---- Masuk/Daftar dengan Google (OAuth) ---- */
function googleCallbackUrl() {
  const base = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : '';
  return base + '/google-callback.html';
}

router.post('/google', asyncHandler(async (req, res) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: googleCallbackUrl() }
  });
  if (error) throw error;
  res.json({ url: data.url });
}));

/* Finalisasi login Google: terima token (implicit flow) ATAU kode (PKCE),
 * validasi ke Supabase, lalu pastikan profil pengguna ada. */
router.post('/google/finalize', asyncHandler(async (req, res) => {
  const { session, code } = req.body || {};
  let authSession;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(String(code));
    if (error || !data.session) {
      return res.status(401).json({ error: 'Tautan masuk Google tidak valid atau sudah kedaluwarsa.' });
    }
    authSession = data.session;
  } else if (session && session.access_token) {
    const setSessionPayload = { access_token: session.access_token };
    if (session.refresh_token) setSessionPayload.refresh_token = session.refresh_token;
    const { data, error } = await supabase.auth.setSession(setSessionPayload);
    if (error || !data.session) {
      return res.status(401).json({ error: 'Sesi Google tidak valid. Silakan coba lagi.' });
    }
    authSession = data.session;
  } else {
    return res.status(400).json({ error: 'Parameter tidak lengkap.' });
  }

  const user = authSession.user;
  if (!user) return res.status(401).json({ error: 'Gagal mendapatkan data pengguna.' });

  let profile = await getProfile(user.id);
  if (!profile) {
    const meta = user.user_metadata || {};
    const name = String(meta.name || meta.full_name || 'Pengguna Google').slice(0, 80);
    const { error: profileErr } = await supabase
      .from('profiles')
      .insert({ id: user.id, name });
    if (profileErr) throw profileErr;
    const { error: goalErr } = await supabase
      .from('food_goals')
      .insert({ user_id: user.id });
    if (goalErr) throw goalErr;
    profile = await getProfile(user.id);
  }

  res.json({ session: authSession, user: profile ? publicProfile(profile) : null });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refresh_token } = req.body || {};

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token wajib diisi.' });
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error || !data.session) {
    return res.status(401).json({ error: 'Sesi tidak valid. Silakan login kembali.' });
  }

  const profile = await getProfile(data.user.id);
  res.json({ session: data.session, user: profile ? publicProfile(profile) : null });
}));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  const { refresh_token } = req.body || {};
  if (refresh_token) {
    const { createClient } = require('@supabase/supabase-js');
    const ephemeral = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    await ephemeral.auth.setSession({
      access_token: req.headers.authorization.slice(7),
      refresh_token
    });
    await ephemeral.auth.signOut();
  }
  res.json({ ok: true });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const profile = await getProfile(req.userId);
  if (!profile) return res.status(404).json({ error: 'Profil tidak ditemukan.' });
  res.json({ user: publicProfile(profile) });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email wajib diisi.' });
  }
  const redirectTo = process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, '') + '/reset-password.html'
    : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(
    String(email).trim().toLowerCase(),
    redirectTo ? { redirectTo } : undefined
  );
  if (error) {
    return res.status(400).json({ error: 'Gagal mengirim email reset. Coba lagi nanti.' });
  }
  res.json({ ok: true });
}));

router.post('/update-password', asyncHandler(async (req, res) => {
  const { access_token, password } = req.body || {};
  if (!access_token || !password || password.length < 6) {
    return res.status(400).json({ error: 'Token dan kata sandi minimal 6 karakter wajib diisi.' });
  }

  const { data, error } = await supabase.auth.getUser(access_token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Tautan reset tidak valid atau sudah kedaluwarsa.' });
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(data.user.id, { password });
  if (updateError) throw updateError;

  res.json({ ok: true });
}));

module.exports = router;
module.exports.publicProfile = publicProfile;
