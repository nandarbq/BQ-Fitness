const express = require('express');
const supabase = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);
const { applyWeightUpdate } = require('./program');

router.put('/', asyncHandler(async (req, res) => {
  const { name, weight, height, sleepTarget } = req.body || {};
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

  if (weight && existing && existing.program && Number(weight) !== existing.weight) {
    // BB diubah lewat profil saat program aktif: sinkronkan agar konsisten
    // dengan program & target makan otomatis.
    await applyWeightUpdate(req.userId, Number(weight));
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

  res.json({
    user: {
      id: user.id, name: user.name,
      weight: user.weight, height: user.height, sleepTarget: user.sleep_target
    }
  });
}));

module.exports = router;