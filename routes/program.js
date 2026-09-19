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
  computeNutrition
} = require('../lib/program');

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

  if (recalcGoal && profile.program && profile.gender && profile.age) {
    const { goals } = computeNutrition(profile.program, {
      gender: profile.gender,
      age: profile.age,
      weight: weightKg,
      height: profile.height || 170,
      activityLevel: profile.activity_level || 3
    });
    await supabase.from('food_goals').upsert({ user_id: userId, ...goals }, { onConflict: 'user_id' });
  }
  return profile;
}

async function upsertGoals(userId, goals) {
  await supabase.from('food_goals').upsert({ user_id: userId, ...goals }, { onConflict: 'user_id' });
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
  const { name, gender, age, weight, height, activityLevel, intensity, goal } = req.body || {};

  if (!gender || !VALID_GENDERS.includes(gender)) {
    return res.status(400).json({ error: 'Jenis kelamin wajib diisi (pria/wanita).' });
  }
  if (!weight || weight < 30 || weight > 300) {
    return res.status(400).json({ error: 'Berat badan harus antara 30–300 kg.' });
  }
  if (!height || height < 100 || height > 250) {
    return res.status(400).json({ error: 'Tinggi badan harus antara 100–250 cm.' });
  }
  if (!age || age < 10 || age > 100) {
    return res.status(400).json({ error: 'Umur harus antara 10–100 tahun.' });
  }
  const act = Number(activityLevel);
  if (!act || ![1, 2, 3, 4, 5].includes(act)) {
    return res.status(400).json({ error: 'Level aktivitas wajib diisi.' });
  }
  if (!intensity || !VALID_INTENSITY.includes(intensity)) {
    return res.status(400).json({ error: 'Intensitas latihan wajib diisi (pemula/menengah/mahir).' });
  }

  const result = computeProgram({
    gender,
    age,
    weight,
    height,
    activityLevel: act,
    goal: goal === 'cutting' ? 'cutting' : 'bulking'
  });

  const update = {
    gender,
    age,
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

  const payload = await loadProgramResponse(req.userId);
  res.status(201).json({
    user: {
      id: profile.id,
      name: profile.name,
      weight: profile.weight,
      height: profile.height,
      sleepTarget: profile.sleep_target,
      gender: profile.gender,
      age: profile.age,
      activityLevel: profile.activity_level,
      intensity: profile.intensity,
      restDays: parseRestDays(profile.rest_days),
      program: profile.program
    },
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
  const payload = await loadProgramResponse(req.userId);
  res.json({
    user: {
      id: profile.id,
      name: profile.name,
      weight: profile.weight,
      height: profile.height,
      sleepTarget: profile.sleep_target,
      gender: profile.gender,
      age: profile.age,
      activityLevel: profile.activity_level,
      intensity: profile.intensity,
      restDays: parseRestDays(profile.rest_days),
      program: profile.program
    },
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

  const payload = await loadProgramResponse(req.userId);
  res.json({
    user: {
      id: profile.id,
      name: profile.name,
      weight: profile.weight,
      height: profile.height,
      sleepTarget: profile.sleep_target,
      gender: profile.gender,
      age: profile.age,
      activityLevel: profile.activity_level,
      intensity: profile.intensity,
      restDays: parseRestDays(profile.rest_days),
      program: profile.program
    },
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
    age: profile.age,
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
  const payload = await loadProgramResponse(req.userId);
  res.json({
    user: {
      id: updated.id,
      name: updated.name,
      weight: updated.weight,
      height: updated.height,
      sleepTarget: updated.sleep_target,
      gender: updated.gender,
      age: updated.age,
      activityLevel: updated.activity_level,
      intensity: updated.intensity,
      restDays: parseRestDays(updated.rest_days),
      program: updated.program
    },
    ...payload
  });
}));

/* ---- Atur jadwal mingguan: user memindahkan 3 hari rest ---- */
router.put('/schedule', asyncHandler(async (req, res) => {
  const { days } = req.body || {};
  if (!Array.isArray(days) || days.length !== 3) {
    return res.status(400).json({ error: 'Jadwal harus berisi tepat 3 hari rest (Senin=1 … Minggu=7).' });
  }
  const rest = [...new Set(days.map(Number))].filter(n => !Number.isNaN(n) && n >= 1 && n <= 7);
  if (rest.length !== 3) {
    return res.status(400).json({ error: 'Pilih 3 hari berbeda antara nomor 1 (Senin) sampai 7 (Minggu).' });
  }
  rest.sort((a, b) => a - b);

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ rest_days: rest.join(',') })
    .eq('id', req.userId)
    .single();
  if (error) throw error;

  const payload = await loadProgramResponse(req.userId);
  res.json({
    user: {
      id: updated.id,
      name: updated.name,
      weight: updated.weight,
      height: updated.height,
      sleepTarget: updated.sleep_target,
      gender: updated.gender,
      age: updated.age,
      activityLevel: updated.activity_level,
      intensity: updated.intensity,
      restDays: rest,
      program: updated.program
    },
    ...payload
  });
}));

module.exports = router;
module.exports.applyWeightUpdate = applyWeightUpdate;