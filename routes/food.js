const express = require('express');
const supabase = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

function rowToLog(row) {
  return {
    id: row.id, date: row.date, meal: row.meal, name: row.name,
    kcal: row.kcal, protein: row.protein, carb: row.carb, fat: row.fat
  };
}

router.get('/logs', asyncHandler(async (req, res) => {
  const { date } = req.query;
  let query = supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', req.userId);
  if (date) {
    query = query.eq('date', date).order('id', { ascending: true });
  } else {
    query = query.order('date', { ascending: false }).order('id', { ascending: true });
  }
  const { data: rows, error } = await query;
  if (error) throw error;
  res.json({ logs: (rows || []).map(rowToLog) });
}));

router.post('/logs', asyncHandler(async (req, res) => {
  const { date, meal, name, kcal, protein, carb, fat } = req.body || {};
  if (!date || !meal || !name) {
    return res.status(400).json({ error: 'Tanggal, jenis makan, dan nama makanan wajib diisi.' });
  }
  const { data: row, error } = await supabase
    .from('food_logs')
    .insert({
      user_id: req.userId,
      date,
      meal,
      name,
      kcal: Number(kcal) || 0,
      protein: Number(protein) || 0,
      carb: Number(carb) || 0,
      fat: Number(fat) || 0
    })
    .select('*')
    .single();
  if (error) throw error;
  res.status(201).json({ log: rowToLog(row) });
}));

router.delete('/logs/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('food_logs')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);
  if (error) throw error;
  res.json({ ok: true });
}));

router.get('/goal', asyncHandler(async (req, res) => {
  let { data: goal, error } = await supabase
    .from('food_goals')
    .select('*')
    .eq('user_id', req.userId)
    .maybeSingle();
  if (error) throw error;
  if (!goal) {
    const { data: created, error: createError } = await supabase
      .from('food_goals')
      .insert({ user_id: req.userId })
      .select('*')
      .single();
    if (createError) throw createError;
    goal = created;
  }
  res.json({ goal: { cal: goal.cal, protein: goal.protein, carb: goal.carb, fat: goal.fat } });
}));

router.put('/goal', asyncHandler(async (req, res) => {
  const { cal, protein, carb, fat } = req.body || {};
  const { data: goal, error } = await supabase
    .from('food_goals')
    .upsert(
      {
        user_id: req.userId,
        cal: Number(cal) || 2000,
        protein: Number(protein) || 120,
        carb: Number(carb) || 220,
        fat: Number(fat) || 60
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();
  if (error) throw error;
  res.json({ goal: { cal: goal.cal, protein: goal.protein, carb: goal.carb, fat: goal.fat } });
}));

module.exports = router;