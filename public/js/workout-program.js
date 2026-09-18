/* Katalog latihan statis untuk program bulking/cutting.
 * Split mingguan:
 *   Day 1 Chest & Triceps · Day 2 Back & Biceps · Day 3 Rest
 *   Day 4 Shoulder · Day 5 Leg Day · Day 6 & 7 Rest/Cardio
 * Variasi set & rep: bulking (massal, volume lebih tinggi) vs cutting (moderat). */

const WORKOUT_SPLIT = [
  { day: 1, label: 'Chest & Triceps', slug: 'chest_triceps', type: 'gym', goal: 'Dada & trisep' },
  { day: 2, label: 'Back & Biceps', slug: 'back_biceps', type: 'gym', goal: 'Punggung & bisep' },
  { day: 3, label: 'Rest', slug: 'rest', type: 'rest', goal: 'Pemulihan otot' },
  { day: 4, label: 'Shoulder', slug: 'shoulder', type: 'gym', goal: 'Bahu' },
  { day: 5, label: 'Leg Day', slug: 'leg_day', type: 'gym', goal: 'Kaki' },
  { day: 6, label: 'Rest / Cardio', slug: 'cardio', type: 'cardio', goal: 'Aktif ringan' },
  { day: 7, label: 'Rest / Cardio', slug: 'cardio', type: 'cardio', goal: 'Aktif ringan' }
];

const EXERCISE_LIBRARY = [
  {
    day: 1,
    routine: [
      { name: 'Barbell Bench Press', bulk: { sets: 4, reps: '8–10' }, cut: { sets: 3, reps: '10–12' } },
      { name: 'Incline Dumbbell Press', bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
      { name: 'Cable Fly', bulk: { sets: 3, reps: '12–15' }, cut: { sets: 3, reps: '15' } },
      { name: 'Triceps Rope Pushdown', bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
      { name: 'Overhead Triceps Extension', bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } }
    ]
  },
  {
    day: 2,
    routine: [
      { name: 'Deadlift atau Pull-Up', bulk: { sets: 4, reps: '6–8' }, cut: { sets: 3, reps: '8–10' } },
      { name: 'Barbell Row', bulk: { sets: 3, reps: '8–10' }, cut: { sets: 3, reps: '10–12' } },
      { name: 'Lat Pulldown', bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
      { name: 'Seated Cable Row', bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
      { name: 'Barbell Curl', bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
      { name: 'Hammer Curl', bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } }
    ]
  },
  {
    day: 4,
    routine: [
      { name: 'Overhead Press', bulk: { sets: 4, reps: '8–10' }, cut: { sets: 3, reps: '10–12' } },
      { name: 'Lateral Raise', bulk: { sets: 3, reps: '12–15' }, cut: { sets: 3, reps: '15' } },
      { name: 'Rear Delt Fly', bulk: { sets: 3, reps: '12–15' }, cut: { sets: 3, reps: '15' } },
      { name: 'Face Pull', bulk: { sets: 3, reps: '15' }, cut: { sets: 3, reps: '15' } }
    ]
  },
  {
    day: 5,
    routine: [
      { name: 'Squat', bulk: { sets: 4, reps: '8–10' }, cut: { sets: 3, reps: '10–12' } },
      { name: 'Romanian Deadlift', bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
      { name: 'Leg Press', bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
      { name: 'Leg Curl', bulk: { sets: 3, reps: '12–15' }, cut: { sets: 3, reps: '15' } },
      { name: 'Calf Raise', bulk: { sets: 4, reps: '12–15' }, cut: { sets: 4, reps: '15' } }
    ]
  }
];

const CARDIO_SUGGEST = {
  bulking: 'Kardio ringan (jalan cepat / sepeda santai / lari pelan 20–30 menit). Jangan terlalu berat supaya massa otot tetap tumbuh.',
  cutting: 'Kardio ringan–sedang (lari pelan / jalan cepat / sepeda 30–45 menit) untuk membantu defisit kalori.',
  maintenance: 'Kardio ringan 20–30 menit, santai saja.'
};

const PROGRAM_INFO = {
  bulking: {
    title: 'Bulking',
    tagline: 'Tambah massa & otot',
    desc: 'Kenaikan berat badan sehat dengan surplus kalori sedang dan latihan beban progresif.'
  },
  cutting: {
    title: 'Cutting',
    tagline: 'Ramping, bakar lemak',
    desc: 'Defisit kalori moderat dengan protein tinggi supaya lemak hilang tapi otot tetap terjaga.'
  },
  maintenance: {
    title: 'Maintenance',
    tagline: 'Jaga bentuk badan',
    desc: 'Kalori di kebutuhan harian (TDEE) untuk mempertahankan hasil yang sudah dicapai.'
  }
};

function programVariant(program) {
  return program === 'cutting' ? 'cut' : 'bulk';
}

function getSplit() {
  return WORKOUT_SPLIT;
}

function getTodaySplit(daysSinceStart) {
  const idx = ((Math.max(0, daysSinceStart) % 7) + 7) % 7; // 0..6
  return WORKOUT_SPLIT[idx];
}

function getDayRoutine(day, program) {
  const lib = EXERCISE_LIBRARY.find(e => e.day === day);
  if (!lib) return null;
  const variant = programVariant(program);
  return lib.routine.map(ex => ({
    name: ex.name,
    sets: ex[variant].sets,
    reps: ex[variant].reps
  }));
}

function getCardioSuggestion(program) {
  return CARDIO_SUGGEST[program] || CARDIO_SUGGEST.bulking;
}