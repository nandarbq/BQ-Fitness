const express = require('express');
const supabase = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const {
  isAiEnabled,
  providerLabel,
  generateMealPlan,
  generateDailyAdvice,
  generateProgramRationale
} = require('../lib/ai');
const { computeStatus, effectiveAge, computeNutrition } = require('../lib/program');

const router = express.Router();
router.use(requireAuth);

const todayISO = () => new Date().toISOString().slice(0, 10);
const ACTIVITY_LABELS = { 1: 'Sedentari', 2: 'Ringan', 3: 'Sedang', 4: 'Berat', 5: 'Atlet' };
const MIN_REGEN_INTERVAL_MS = 60000;
const lastGen = new Map(); // kunci `${userId}:${kind}` -> timestamp

function hashCtx(obj) {
  const s = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return String(h);
}

function checkCooldown(userId, kind) {
  const key = `${userId}:${kind}`;
  const last = lastGen.get(key) || 0;
  const wait = MIN_REGEN_INTERVAL_MS - (Date.now() - last);
  if (wait > 0) return Math.ceil(wait / 1000);
  return 0;
}

function markGenerated(userId, kind) {
  lastGen.set(`${userId}:${kind}`, Date.now());
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

async function getGoals(userId) {
  const { data } = await supabase
    .from('food_goals')
    .select('cal, protein, carb, fat')
    .eq('user_id', userId)
    .maybeSingle();
  return data || { cal: 2000, protein: 120, carb: 220, fat: 60 };
}

async function getTodayTotals(userId) {
  const { data } = await supabase
    .from('food_logs')
    .select('kcal, protein, carb, fat')
    .eq('user_id', userId)
    .eq('date', todayISO());
  const logs = data || [];
  return logs.reduce((acc, e) => ({
    kcal: acc.kcal + (e.kcal || 0),
    protein: acc.protein + (e.protein || 0),
    carb: acc.carb + (e.carb || 0),
    fat: acc.fat + (e.fat || 0)
  }), { kcal: 0, protein: 0, carb: 0, fat: 0 });
}

async function getTodayWorkoutNames(userId) {
  const { data } = await supabase
    .from('workouts')
    .select('name')
    .eq('user_id', userId)
    .eq('date', todayISO());
  return (data || []).map(w => w.name).join(', ');
}

/* Jumlah sesi makan/hari yang disarankan dari kebutuhan kalori. */
function recommendedFrequency(cal) {
  if (cal < 1600) return 3;
  if (cal < 2200) return 4;
  if (cal < 2900) return 5;
  return 6;
}

function buildBaseCtx(profile, goals) {
  const activityLabel = ACTIVITY_LABELS[profile.activity_level] || 'Sedang';
  return {
    gender: profile.gender || 'pria',
    age: effectiveAge(profile),
    weight: profile.weight || 65,
    height: profile.height || 170,
    activityLabel,
    program: profile.program || 'maintenance',
    intensity: profile.intensity || 'menengah',
    goals
  };
}

async function loadCache(userId, kind, ctxHash) {
  const { data, error } = await supabase
    .from('ai_caches')
    .select('payload, source, ctx_hash')
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('date', todayISO())
    .maybeSingle();
  if (error) throw error;
  if (data && data.ctx_hash === ctxHash) return data;
  return null;
}

async function saveCache(userId, kind, ctxHash, payload, source) {
  await supabase
    .from('ai_caches')
    .upsert({
      user_id: userId,
      kind,
      date: todayISO(),
      ctx_hash: ctxHash,
      payload,
      source
    }, { onConflict: 'user_id,kind,date' });
}

async function invalidateAiCache(userId, kind) {
  await supabase
    .from('ai_caches')
    .delete()
    .eq('user_id', userId)
    .eq('kind', kind);
}

/* ------------------------------------------------------------------ */
/* MENU MAKAN HARIAN AI                                               */
/* ------------------------------------------------------------------ */
router.get('/meal', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const profile = await getProfile(userId);
  const goals = await getGoals(userId);
  const eaten = await getTodayTotals(userId);

  if (!isAiEnabled()) {
    return res.json({ enabled: false, source: 'fallback', plan: null });
  }

  const ctx = {
    ...buildBaseCtx(profile, goals),
    frequency: recommendedFrequency(goals.cal),
    eatenKcal: Math.round(eaten.kcal),
    eatenProtein: Math.round(eaten.protein)
  };
  const ctxHash = hashCtx({ goals, program: ctx.program, weight: ctx.weight, frequency: ctx.frequency });
  const cached = await loadCache(userId, 'meal', ctxHash);
  if (cached) {
    return res.json({ enabled: true, source: cached.source, plan: cached.payload, frequency: ctx.frequency });
  }

  try {
    const plan = await generateMealPlan(ctx);
    await saveCache(userId, 'meal', ctxHash, plan, 'ai');
    res.json({ enabled: true, source: 'ai', plan, frequency: ctx.frequency });
  } catch (err) {
    console.error('AI meal gagal:', err.message);
    res.json({ enabled: true, source: 'fallback', plan: null, frequency: ctx.frequency });
  }
}));

router.post('/meal/refresh', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const cooldown = checkCooldown(userId, 'meal');
  if (cooldown > 0) {
    return res.status(429).json({ error: `Menu baru bisa dibuat dalam ${cooldown} detik lagi.` });
  }
  markGenerated(userId, 'meal');
  const profile = await getProfile(userId);
  const goals = await getGoals(userId);
  const ctx = {
    ...buildBaseCtx(profile, goals),
    frequency: recommendedFrequency(goals.cal),
    eatenKcal: 0,
    eatenProtein: 0
  };
  try {
    const plan = await generateMealPlan(ctx);
    const ctxHash = hashCtx({ goals, program: ctx.program, weight: ctx.weight, frequency: ctx.frequency });
    await saveCache(userId, 'meal', ctxHash, plan, 'ai');
    res.json({ source: 'ai', plan, frequency: ctx.frequency });
  } catch (err) {
    console.error('AI meal refresh gagal:', err.message);
    res.json({ source: 'fallback', plan: null, frequency: ctx.frequency });
  }
}));

/* ------------------------------------------------------------------ */
/* SARAN HARIAN AI                                                    */
/* ------------------------------------------------------------------ */
router.get('/advice', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const profile = await getProfile(userId);
  const goals = await getGoals(userId);
  const eaten = await getTodayTotals(userId);
  const todayWorkout = await getTodayWorkoutNames(userId);

  if (!isAiEnabled()) {
    return res.json({ enabled: false, source: 'fallback', advice: null });
  }

  const ctx = {
    ...buildBaseCtx(profile, goals),
    eatenKcal: Math.round(eaten.kcal),
    todayWorkout: todayWorkout || 'istirahat'
  };
  const ctxHash = hashCtx({ goals, program: ctx.program, weight: ctx.weight, eatenKcal: ctx.eatenKcal });
  const cached = await loadCache(userId, 'advice', ctxHash);
  if (cached) {
    return res.json({ enabled: true, source: cached.source, advice: cached.payload });
  }

  try {
    const advice = await generateDailyAdvice(ctx);
    await saveCache(userId, 'advice', ctxHash, advice, 'ai');
    res.json({ enabled: true, source: 'ai', advice });
  } catch (err) {
    console.error('AI advice gagal:', err.message);
    res.json({ enabled: true, source: 'fallback', advice: null });
  }
}));

/* ------------------------------------------------------------------ */
/* ALASAN REKOMENDASI PROGRAM AI                                      */
/* ------------------------------------------------------------------ */
router.get('/program', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const profile = await getProfile(userId);
  let goals = await getGoals(userId);

  if (!isAiEnabled()) {
    return res.json({ enabled: false, source: 'fallback', text: null });
  }

  /* Saat onboarding belum selesai, klien boleh mengirim konteks preview
   * lewat query (?program=bulking&bmi=...&weight=...). Bila kosong,
   * pakai profil tersimpan. */
  const q = req.query || {};
  let ctx;
  if (q.program && ['bulking', 'cutting', 'maintenance'].includes(q.program)) {
    const gender = q.gender || profile.gender || 'pria';
    const age = Number(q.age) || effectiveAge(profile) || 24;
    const weight = Number(q.weight) || profile.weight || 65;
    const height = Number(q.height) || profile.height || 170;
    const act = Number(q.activity) || profile.activity_level || 3;
    const intensity = q.intensity || profile.intensity || 'menengah';
    goals = computeNutrition(q.program, { gender, age, weight, height, activityLevel: act }).goals;
    const bmi = Number(q.bmi) || Math.round(weight / Math.pow(height / 100, 2) * 10) / 10;
    ctx = {
      gender,
      age,
      weight,
      height,
      activityLabel: ACTIVITY_LABELS[act] || 'Sedang',
      program: q.program,
      intensity,
      goals,
      bmi,
      bmiStatus: bmi < 18.5 ? 'di bawah normal' : (bmi >= 25 ? 'di atas normal' : 'normal'),
      targetWeight: Number(q.targetWeight) || null,
      durationWeeks: Number(q.durationWeeks) || null
    };
  } else {
    const status = computeStatus(profile);
    const bmi = status ? status.bmi : Math.round((profile.weight || 65) / Math.pow((profile.height || 170) / 100, 2) * 10) / 10;
    ctx = {
      ...buildBaseCtx(profile, goals),
      bmi,
      bmiStatus: bmi < 18.5 ? 'di bawah normal' : (bmi >= 25 ? 'di atas normal' : 'normal'),
      targetWeight: profile.target_weight,
      durationWeeks: profile.duration_weeks
    };
  }
  const ctxHash = hashCtx({ program: ctx.program, bmi: ctx.bmi, weight: ctx.weight, goals });
  const cached = await loadCache(userId, 'program', ctxHash);
  if (cached) {
    return res.json({ enabled: true, source: cached.source, text: cached.payload });
  }

  try {
    const text = await generateProgramRationale(ctx);
    await saveCache(userId, 'program', ctxHash, text, 'ai');
    res.json({ enabled: true, source: 'ai', text: text && typeof text === 'object' ? text.text : text });
  } catch (err) {
    console.error('AI program rationale gagal:', err.message);
    res.json({ enabled: true, source: 'fallback', text: null });
  }
}));

module.exports = router;
module.exports.invalidateAiCache = invalidateAiCache;