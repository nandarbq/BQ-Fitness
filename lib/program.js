/* Logika murni program fitness: rekomendasi program dari BB/TB,
 * target berat, durasi ideal, dan target kalori/makro harian.
 * Jadwal latihan menempel nama hari kalender: Senin=1 … Minggu=7,
 * default rest = [3,6,7] (Rabu, Sabtu, Minggu). */

const ACTIVITY_FACTORS = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 };
const VALID_GENDERS = ['pria', 'wanita'];
const VALID_PROGRAMS = ['bulking', 'cutting', 'maintenance'];
const DEFAULT_REST_DAYS = [3, 6, 7];

/* Hari libur: string "3,6,7" (Senin=1 … Minggu=7) -> array angka urut.
 * Fallback default [3,6,7] untuk user lama / nilai tak valid. */
function parseRestDays(str) {
  if (Array.isArray(str)) str = str.join(',');
  const arr = String(str || '')
    .split(',')
    .map(s => parseInt(s, 10))
    .filter(n => !Number.isNaN(n) && n >= 1 && n <= 7);
  return arr.length ? [...new Set(arr)].sort((a, b) => a - b) : DEFAULT_REST_DAYS.slice();
}

function calcBMI(weightKg, heightCm) {
  const h = (heightCm || 170) / 100;
  return weightKg / (h * h);
}

function calcBMR(gender, weightKg, heightCm, age) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'wanita' ? base - 161 : base + 5;
}

function computeGoals(program, weightKg, tdee, bmr) {
  if (program === 'bulking') {
    const cal = Math.round(tdee + 300);
    const protein = Math.round(1.8 * weightKg);
    const fat = Math.round((cal * 0.25) / 9);
    const carb = Math.round((cal - protein * 4 - fat * 9) / 4);
    return { cal, protein, carb, fat };
  }
  if (program === 'cutting') {
    const cal = Math.max(Math.round(tdee - 400), Math.round(bmr * 0.9));
    const protein = Math.round(2.0 * weightKg);
    const fat = Math.round((cal * 0.27) / 9);
    const carb = Math.round((cal - protein * 4 - fat * 9) / 4);
    return { cal, protein, carb, fat };
  }
  const cal = Math.round(tdee);
  const protein = Math.round(1.8 * weightKg);
  const fat = Math.round((cal * 0.25) / 9);
  const carb = Math.round((cal - protein * 4 - fat * 9) / 4);
  return { cal, protein, carb, fat };
}

function computeNutrition(program, { gender, age, weight, height, activityLevel }) {
  const bmr = calcBMR(gender, weight, height, age);
  const tdee = Math.round(bmr * (ACTIVITY_FACTORS[activityLevel] || 1.375));
  const goals = computeGoals(program, weight, tdee, bmr);
  return { bmr, tdee, goals };
}

/* Rekomendasi program + target + durasi berdasarkan BB/TB.
 * BMI < 18.5  -> bulking (paksa)
 * BMI >= 25   -> cutting (paksa)
 * BMI normal  -> ikut preferensi user (goal), default bulking */
function computeProgram({ gender, age, weight, height, activityLevel, goal }) {
  const bmi = calcBMI(weight, height);
  let program;
  if (bmi < 18.5) {
    program = 'bulking';
  } else if (bmi >= 25) {
    program = 'cutting';
  } else {
    program = goal === 'cutting' ? 'cutting' : 'bulking';
  }

  const m2 = Math.pow(height / 100, 2);
  let targetWeight;
  let durationWeeks;

  if (program === 'bulking') {
    let t = 24 * m2;
    if (t - weight > 8) t = weight + 8;
    targetWeight = Math.max(t, weight + 0.5);
    durationWeeks = Math.max(8, Math.ceil((targetWeight - weight) / 0.25));
  } else {
    let t = 22 * m2;
    if (t >= weight) t = weight - 0.5;
    targetWeight = Math.max(t, 35);
    durationWeeks = Math.min(20, Math.max(6, Math.ceil((weight - targetWeight) / 0.5)));
  }
  targetWeight = Math.round(targetWeight * 10) / 10;

  const nutrition = computeNutrition(program, { gender, age, weight, height, activityLevel });
  return {
    program,
    bmi,
    targetWeight,
    durationWeeks,
    ...nutrition
  };
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const then = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const nowMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const thenMs = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.floor((nowMs - thenMs) / 86400000);
}

function computeStatus(profile) {
  if (!profile || !profile.program) return null;
  const cur = profile.weight || profile.start_weight || 0;
  const startW = profile.start_weight || cur;
  const target = profile.target_weight || cur;
  const elapsedWeeks = Math.floor(daysSince(profile.program_start) / 7);
  const duration = profile.duration_weeks || 0;
  const remainingWeeks = Math.max(0, duration - elapsedWeeks);

  let progressPct = 0;
  if (profile.program === 'bulking' && target > startW) {
    progressPct = Math.round(((cur - startW) / (target - startW)) * 100);
  } else if (profile.program === 'cutting' && startW > target) {
    progressPct = Math.round(((startW - cur) / (startW - target)) * 100);
  }
  progressPct = Math.max(0, Math.min(100, progressPct));

  const targetReached = profile.program === 'bulking'
    ? cur >= target - 0.2
    : cur <= target + 0.2;
  const timeUp = duration > 0 && elapsedWeeks >= duration;
  const weightDue = daysSince(profile.last_weight_date) >= 7;

  return {
    program: profile.program,
    programStart: profile.program_start,
    startWeight: startW,
    currentWeight: cur,
    targetWeight: target,
    durationWeeks: duration,
    elapsedWeeks,
    remainingWeeks,
    progressPct,
    targetReached,
    timeUp,
    weightDue,
    bmi: Math.round(calcBMI(cur, profile.height || 170) * 10) / 10,
    lastWeightDate: profile.last_weight_date,
    intensity: profile.intensity,
    restDays: parseRestDays(profile.rest_days)
  };
}

module.exports = {
  ACTIVITY_FACTORS,
  VALID_GENDERS,
  VALID_PROGRAMS,
  DEFAULT_REST_DAYS,
  parseRestDays,
  calcBMI,
  calcBMR,
  computeGoals,
  computeNutrition,
  computeProgram,
  computeStatus,
  daysSince
};