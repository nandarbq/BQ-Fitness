const express = require('express');
const supabase = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

function rowToWorkout(row) {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    durationMin: row.duration_min,
    exercises: row.exercises_json || []
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { data: rows, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', req.userId)
    .order('date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  res.json({ workouts: (rows || []).map(rowToWorkout) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, date, durationMin, exercises } = req.body || {};
  if (!name || !date || !durationMin) {
    return res.status(400).json({ error: 'Nama, tanggal, dan durasi wajib diisi.' });
  }
  const { data: row, error } = await supabase
    .from('workouts')
    .insert({
      user_id: req.userId,
      name,
      date,
      duration_min: Math.round(durationMin),
      exercises_json: exercises || []
    })
    .select('*')
    .single();
  if (error) throw error;
  res.status(201).json({ workout: rowToWorkout(row) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);
  if (error) throw error;
  res.json({ ok: true });
}));

module.exports = router;