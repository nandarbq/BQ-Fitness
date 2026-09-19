const express = require('express');
const supabase = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);
const { applyWeightUpdate, recalcGoals } = require('./program');
const { invalidateAiCache } = require('./ai');
const { publicProfile } = require('./auth');
const { calcAge } = require('../lib/program');

router.put('/', asyncHandler(async (req, res) => {
  const { name, weight, height, sleepTarget, birthdate } = req.body || {};
  const update = {
    name: String(name || '').trim(),
    height: Number(height) || 170,
    sleep_target: Number(sleepTarget) || 8
  };

  const { data: existing, error: fetchErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  let birthdateChanged = false;
  if (birthdate) {
    const age = calcAge(birthdate);
    if (age == null || age < 10 || age > 100) {
      return res.status(400).json({ error: 'Tanggal lahir tidak valid (umur harus 10–100 tahun).' });
    }
    if ((existing && existing.birthdate) !== birthdate) birthdateChanged = true;
    update.birthdate = birthdate;
    update.age = age;
  }

  let weightChanged = false;
  if (weight && existing && existing.program && Number(weight) !== existing.weight) {
    // BB diubah lewat profil saat program aktif: sinkronkan agar konsisten
    // dengan program & target makan otomatis.
    await applyWeightUpdate(req.userId, Number(weight));
    weightChanged = true;
  } else {
    update.weight = Number(weight) || existing?.weight || 65;
  }

  const { data: user, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', req.userId)
    .select('*')
    .single();
  if (error) throw error;

  // Umur berubah karena tanggal lahir diubah: target makan dihitung ulang.
  if (existing && existing.program && birthdateChanged) {
    await recalcGoals(user);
  }

  if (birthdateChanged) {
    await Promise.all([
      invalidateAiCache(req.userId, 'meal'),
      invalidateAiCache(req.userId, 'advice'),
      invalidateAiCache(req.userId, 'program')
    ]);
  }

  res.json({ user: publicProfile(user) });
}));

module.exports = router;