const express = require('express');
const supabase = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.put('/', asyncHandler(async (req, res) => {
  const { name, weight, height, sleepTarget } = req.body || {};
  const { data: user, error } = await supabase
    .from('users')
    .update({
      name: String(name || '').trim(),
      weight: Number(weight) || 65,
      height: Number(height) || 170,
      sleep_target: Number(sleepTarget) || 8
    })
    .eq('id', req.userId)
    .select('*')
    .single();
  if (error) throw error;

  res.json({
    user: {
      id: user.id, name: user.name, email: user.email,
      weight: user.weight, height: user.height, sleepTarget: user.sleep_target
    }
  });
}));

module.exports = router;