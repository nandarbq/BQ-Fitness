const express = require('express');
const supabase = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

function rowToLog(row) {
  return {
    id: row.id, date: row.date, startTime: row.start_time,
    endTime: row.end_time, hours: row.hours, quality: row.quality
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { data: rows, error } = await supabase
    .from('sleep_logs')
    .select('*')
    .eq('user_id', req.userId)
    .order('date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  res.json({ logs: (rows || []).map(rowToLog) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { date, startTime, endTime, hours, quality } = req.body || {};
  if (!date || !startTime || !endTime || hours === undefined) {
    return res.status(400).json({ error: 'Data tidur tidak lengkap.' });
  }
  const { data: row, error } = await supabase
    .from('sleep_logs')
    .insert({
      user_id: req.userId,
      date,
      start_time: startTime,
      end_time: endTime,
      hours,
      quality: Number(quality) || 3
    })
    .select('*')
    .single();
  if (error) throw error;
  res.status(201).json({ log: rowToLog(row) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('sleep_logs')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);
  if (error) throw error;
  res.json({ ok: true });
}));

module.exports = router;