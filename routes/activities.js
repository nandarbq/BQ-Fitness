const express = require('express');
const supabase = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

function rowToActivity(row) {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    distanceKm: row.distance_km,
    durationSec: row.duration_sec,
    kcal: row.kcal,
    points: row.points_json || []
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { data: rows, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', req.userId)
    .order('date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  res.json({ activities: (rows || []).map(rowToActivity) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { type, date, distanceKm, durationSec, kcal, points } = req.body || {};
  if (!['running', 'cycling'].includes(type) || !date || !distanceKm || !durationSec) {
    return res.status(400).json({ error: 'Data aktivitas tidak lengkap.' });
  }
  const { data: row, error } = await supabase
    .from('activities')
    .insert({
      user_id: req.userId,
      type,
      date,
      distance_km: distanceKm,
      duration_sec: Math.round(durationSec),
      kcal: Math.round(kcal || 0),
      points_json: points || []
    })
    .select('*')
    .single();
  if (error) throw error;
  res.status(201).json({ activity: rowToActivity(row) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);
  if (error) throw error;
  res.json({ ok: true });
}));

module.exports = router;