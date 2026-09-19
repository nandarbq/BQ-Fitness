const express = require('express');
const supabase = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const {
  VALID_GENDERS,
  VALID_PROGRAMS,
  DEFAULT_REST_DAYS,
  parseRestDays,
  computeProgram,
  computeStatus,
  computeNutrition,
  calcAge,
  effectiveAge
} = require('../lib/program');

const { publicProfile } = require('./auth');
const { invalidateAiCache } = require('./ai');

const router = express.Router();
router.use(requireAuth);

const VALID_INTENSITY = ['pemula', 'menengah', 'mahir'];

const todayISO = () => new Date().toISOString().slice(0, 10);

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* Hitung ulang target makan dari profil terbaru (umur selalu dari tanggal lahir). */
async function recalcGoals(profile, weightKg) {
  if (!profile || !profile.program || !profile.gender) return null;
  const { goals } = computeNutrition(profile.program, {
    gender: profile.gender,
    age: effectiveAge(profile),
    weight: weightKg || profile.weight || profile.start_weight || 0,
    height: profile.height || 170,
    activityLevel: profile.activity_level || 3
  });
  await supabase.from('food_goals').upsert({ user_id: profile.id, ...goals }, { onConflict: 'user_id' });
  return goals;
}

/* Simpan update berat: isi riwayat, refresh profil, hitung ulang target makan. */
async function applyWeightUpdate(userId, weightKg, recalcGoal = true) {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('Profil tidak ditemukan.');

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ weight: weightKg, last_weight_date: todayISO() })
    .eq('id', userId);
  if (updateErr) throw updateErr;

  await supabase.from('weight_logs').insert({
    user_id: userId,
    date: todayISO(),
    weight_kg: weightKg
  });

  if (recalcGoal) await recalcGoals(profile, weightKg);
  return profile;
}

async function upsertGoals(userId, goals) {
  await supabase.from('food_goals').upsert({ user_id: userId, ...goals }, { onConflict: 'user_id' });
}

/* Data program/profil berubah -> buang cache AI hari ini biar hasil berikutnya segar. */
async function flushAi(userId) {
  await Promise.all([
    invalidateAiCache(userId, 'meal'),
    invalidateAiCache(userId, 'advice'),
    invalidateAiCache(userId, 'program')
  ]);
}

async function loadProgramResponse(userId) {
  const profile = await getProfile(userId);
  const status = computeStatus(profile);
  if (!status) {
    return { needsProgram: true, program: null };
  }
  const { data: goals } = await supabase
    .from('food_goals')
    .select('cal, protein, carb, fat')
    .eq('user_id', userId)
    .maybeSingle();
  return { needsProgram: false, program: status, goals: goals || null };
}

/* ---- Onboarding: input BB/TB/dll -> rekomendasi program + target makan ---- */
router.post('/onboard', asyncHandler(async (req, res) => {
  const { name, gender, age, birthdate, weight, height, activityLevel, intensity, goal } = req.body || {};

  if (!gender || !VALID_GENDERS.includes(gender)) {
    return res.status(400).json({ error: 'Jenis kelamin wajib diisi (pria/wanita).' });
  }
  if (!weight || weight < 30 || weight > 300) {
    return res.status(400).json({ error: 'Berat badan harus antara 30–300 kg.' });
  }
  if (!height || height < 100 || height > 250) {
    return res.status(400).json({ error: 'Tinggi badan harus antara 100–250 cm.' });
  }
  const computedAge = birthdate ? calcAge(birthdate) : null;
  if (computedAge != null && (computedAge < 10 || computedAge > 100)) {
    return res.status(400).json({ error: 'Umur harus antara 10–100 tahun (cek tanggal lahir).' });
  }
  if (computedAge == null && (!age || age < 10 || age > 100)) {
    return res.status(400).json({ error: 'Umur harus antara 10–100 tahun.' });
  }
  const finalAge = computedAge != null ? computedAge : (age ? Number(age) : null);
  const act = Number(activityLevel);
  if (!act || ![1, 2, 3, 4, 5].includes(act)) {
    return res.status(400).json({ error: 'Level aktivitas wajib diisi.' });
  }
  if (!intensity || !VALID_INTENSITY.includes(intensity)) {
    return res.status(400).json({ error: 'Intensitas latihan wajib diisi (pemula/menengah/mahir).' });
  }

  const result = computeProgram({
    gender,
    age: finalAge,
    weight,
    height,
    activityLevel: act,
    goal: goal === 'cutting' ? 'cutting' : 'bulking'
  });

  const update = {
    gender,
    age: finalAge,
    activity_level: act,
    intensity,
    rest_days: DEFAULT_REST_DAYS.join(','),
    weight,
    height,
    program: result.program,
    program_start: todayISO(),
    start_weight: weight,
    target_weight: result.targetWeight,
    duration_weeks: result.durationWeeks,
    last_weight_date: todayISO()
  };
  if (birthdate) update.birthdate = birthdate;
  if (name !== undefined) update.name = String(name).trim();

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', req.userId)
    .select('*')
    .single();
  if (profileErr) throw profileErr;

  await supabase.from('weight_logs').insert({
    user_id: req.userId,
    date: todayISO(),
    weight_kg: weight
  });
  await upsertGoals(req.userId, result.goals);
  await flushAi(req.userId);

  const payload = await loadProgramResponse(req.userId);
  res.status(201).json({
    user: publicProfile(profile),
    ...payload
  });
}));

/* ---- Status program (untuk halaman latihan + cek BB mingguan) ---- */
router.get('/', asyncHandler(async (req, res) => {
  res.json(await loadProgramResponse(req.userId));
}));

/* ---- Update BB mingguan (wajib) ---- */
router.post('/weight', asyncHandler(async (req, res) => {
  const { weight } = req.body || {};
  if (!weight || weight < 30 || weight > 300) {
    return res.status(400).json({ error: 'Berat badan harus antara 30–300 kg.' });
  }
  const profile = await applyWeightUpdate(req.userId, weight);
  await flushAi(req.userId);
  const payload = await loadProgramResponse(req.userId);
  res.json({
    user: publicProfile(profile),
    ...payload
  });
}));

/* ---- Ubah intensitas latihan (pemula/menengah/mahir) ---- */
router.put('/intensity', asyncHandler(async (req, res) => {
  const { intensity } = req.body || {};
  if (!intensity || !VALID_INTENSITY.includes(intensity)) {
    return res.status(400).json({ error: 'Intensitas latihan tidak valid (pemula/menengah/mahir).' });
  }
  const { data: profile, error } = await supabase
    .from('profiles')
    .update({ intensity })
    .eq('id', req.userId)
    .select('*')
    .single();
  if (error) throw error;

  await flushAi(req.userId);
  const payload = await loadProgramResponse(req.userId);
  res.json({
    user: publicProfile(profile),
    ...payload
  });
}));

/* ---- Ganti / perpanjang program: hanya boleh saat target tercapai / waktu habis ----
 * recalc=true  -> pilih program otomatis dari BMI/BB terbaru.
 * program=sama -> extend: siklus baru dengan target & durasi dihitung dari BB sekarang. */
router.post('/switch', asyncHandler(async (req, res) => {
  const { program, recalc } = req.body || {};

  const profile = await getProfile(req.userId);
  const status = computeStatus(profile);
  if (!status) {
    return res.status(400).json({ error: 'Belum ada program aktif. Selesaikan onboarding dulu.' });
  }
  if (!status.targetReached && !status.timeUp) {
    return res.status(400).json({
      error: 'Target berat badan belum tercapai, jadi program belum bisa diganti. ' +
        'Tetap jalankan program sampai target tercapai ya.'
    });
  }

  const weight = profile.weight || profile.start_weight || 0;
  const ctx = {
    gender: profile.gender,
    age: effectiveAge(profile),
    weight,
    height: profile.height || 170,
    activityLevel: profile.activity_level || 3
  };

  const targetProgram = recalc
    ? computeProgram({ ...ctx, goal: status.program === 'cutting' ? 'cutting' : 'bulking' }).program
    : program;
  if (!recalc && (!targetProgram || !VALID_PROGRAMS.includes(targetProgram))) {
    return res.status(400).json({ error: 'Program tidak valid.' });
  }
  if (targetProgram === status.program && targetProgram === 'maintenance') {
    return res.status(400).json({ error: 'Program maintenance tidak perlu diperpanjang.' });
  }

  const update = {
    program: targetProgram,
    program_start: todayISO(),
    start_weight: weight,
    last_weight_date: todayISO()
  };
  let goals;

  if (targetProgram === 'maintenance') {
    update.target_weight = null;
    update.duration_weeks = null;
    goals = computeNutrition('maintenance', ctx).goals;
  } else {
    const result = computeProgram({ ...ctx, goal: targetProgram === 'cutting' ? 'cutting' : 'bulking' });
    update.target_weight = result.targetWeight;
    update.duration_weeks = result.durationWeeks;
    goals = result.goals;
  }

  const { data: updated, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', req.userId)
    .single();
  if (error) throw error;

  await upsertGoals(req.userId, goals);
  await flushAi(req.userId);
  const payload = await loadProgramResponse(req.userId);
  res.json({
    user: publicProfile(updated),
    ...payload
  });
}));

/* ---- Atur jadwal mingguan: user mengatur 1–6 hari rest ---- */
router.put('/schedule', asyncHandler(async (req, res) => {
  const { days } = req.body || {};
  if (!Array.isArray(days) || days.length < 1 || days.length > 6) {
    return res.status(400).json({ error: 'Jadwal harus berisi 1 sampai 6 hari rest (Senin=1 … Minggu=7).' });
  }
  const rest = [...new Set(days.map(Number))].filter(n => !Number.isNaN(n) && n >= 1 && n <= 7);
  if (rest.length !== days.length) {
    return res.status(400).json({ error: 'Pilih hari berbeda antara nomor 1 (Senin) sampai 7 (Minggu).' });
  }
  rest.sort((a, b) => a - b);

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ rest_days: rest.join(',') })
    .eq('id', req.userId)
    .single();
  if (error) throw error;

  await flushAi(req.userId);
  const payload = await loadProgramResponse(req.userId);
  res.json({
    user: publicProfile(updated),
    ...payload
  });
}));

module.exports = router;
module.exports.applyWeightUpdate = applyWeightUpdate;
module.exports.recalcGoals = recalcGoals;