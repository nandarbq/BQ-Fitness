/* Katalog latihan statis untuk program bulking/cutting.
 * Split mingguan:
 *   Day 1 Chest & Triceps · Day 2 Back & Biceps · Day 3 Rest
 *   Day 4 Shoulder · Day 5 Leg Day · Day 6 & 7 Rest/Cardio
 * Semua gerakan hanya memakai DUMBBELL (satu pasang dumbbell, bebasis per tangan).
 * Variasi:
 *   - program bulking/cutting  -> menentukan repetisi (jml set dasar)
 *   - intensitas pemula/menengah/mahir -> menggeser jumlah set, rentang beban, istirahat */

const WORKOUT_SPLIT = [
  { day: 1, label: 'Chest & Triceps', slug: 'chest_triceps', type: 'gym', goal: 'Dada & trisep' },
  { day: 2, label: 'Back & Biceps', slug: 'back_biceps', type: 'gym', goal: 'Punggung & bisep' },
  { day: 3, label: 'Rest', slug: 'rest', type: 'rest', goal: 'Pemulihan otot' },
  { day: 4, label: 'Shoulder', slug: 'shoulder', type: 'gym', goal: 'Bahu' },
  { day: 5, label: 'Leg Day', slug: 'leg_day', type: 'gym', goal: 'Kaki' },
  { day: 6, label: 'Rest / Cardio', slug: 'cardio', type: 'cardio', goal: 'Aktif ringan' },
  { day: 7, label: 'Rest / Cardio', slug: 'cardio', type: 'cardio', goal: 'Aktif ringan' }
];

const INTENSITY_LEVELS = {
  pemula: {
    label: 'Pemula',
    desc: 'Baru mulai / belum terbiasa beban',
    setsAdj: -1,
    rest: 'Istirahat ± 90 detik',
    weightNote: 'Mulai beban ringan, utamakan teknik dulu'
  },
  menengah: {
    label: 'Menengah',
    desc: 'Sudah rutin latihan beban',
    setsAdj: 0,
    rest: 'Istirahat 60–90 detik',
    weightNote: 'Beban sedang, tambah bertahap'
  },
  mahir: {
    label: 'Mahir',
    desc: 'Terbiasa beban berat & progresif',
    setsAdj: 1,
    rest: 'Istirahat ± 60 detik',
    weightNote: 'Beban berat, fokus progresi'
  }
};

/* bobot = kg per satu dumbbell (saran awal, sesuaikan kemampuan) */
const EXERCISE_LIBRARY = [
  {
    day: 1,
    routine: [
      {
        name: 'Dumbbell Bench Press',
        anim: 'bench',
        cue: 'Baring telentang, dorong kedua dumbbell ke atas sampai lengan lurus, turunkan pelan ke dada.',
        base: { bulk: { sets: 4, reps: '8–10' }, cut: { sets: 3, reps: '10–12' } },
        weight: { pemula: [6, 10], menengah: [10, 16], mahir: [16, 24] }
      },
      {
        name: 'Dumbbell Chest Fly',
        anim: 'fly',
        cue: 'Buka kedua lengan selebar dada lalu rapatkan di atas dada seperti memeluk benda besar.',
        base: { bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
        weight: { pemula: [4, 6], menengah: [6, 10], mahir: [10, 14] }
      },
      {
        name: 'Dumbbell Pullover',
        anim: 'pullover',
        cue: 'Luruskan kedua tangan di atas kepala, tarik dumbbell sampai sejajar kepala lalu angkat lewat atas dada.',
        base: { bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
        weight: { pemula: [8, 12], menengah: [12, 18], mahir: [18, 24] }
      },
      {
        name: 'Overhead Triceps Extension',
        anim: 'tri',
        cue: 'Genggam satu dumbbell di atas kepala, tekuk siku ke belakang, lalu luruskan ke atas lagi.',
        base: { bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
        weight: { pemula: [4, 8], menengah: [8, 12], mahir: [12, 18] }
      },
      {
        name: 'Dumbbell Kickback',
        anim: 'kickback',
        cue: 'Condong ke depan, siku menempel sisi tubuh, luruskan lengan ke belakang lalu tekuk lagi.',
        base: { bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '15' } },
        weight: { pemula: [2, 4], menengah: [4, 6], mahir: [6, 10] }
      }
    ]
  },
  {
    day: 2,
    routine: [
      {
        name: 'Dumbbell Row',
        anim: 'row',
        cue: 'Condongkan badan, tarik dumbbell ke pinggang dengan siku rapat tubuh, turunkan pelan.',
        base: { bulk: { sets: 4, reps: '8–10' }, cut: { sets: 3, reps: '10–12' } },
        weight: { pemula: [8, 12], menengah: [12, 18], mahir: [18, 24] }
      },
      {
        name: 'Dumbbell Romanian Deadlift',
        anim: 'rdl',
        cue: 'Jaga punggung lurus, condongkan badan sambil dumbbell meluncur di depan kaki, lalu tegak kembali.',
        base: { bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
        weight: { pemula: [10, 16], menengah: [16, 24], mahir: [24, 32] }
      },
      {
        name: 'Dumbbell Curl',
        anim: 'curl',
        cue: 'Siku menempel tubuh, angkat dumbbell ke bahu tanpa mengayun, turunkan pelan.',
        base: { bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
        weight: { pemula: [4, 8], menengah: [8, 12], mahir: [12, 18] }
      },
      {
        name: 'Hammer Curl',
        anim: 'hammer',
        cue: 'Sama seperti curl tapi genggaman menghadap ke dalam (telapak saling berhadapan).',
        base: { bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
        weight: { pemula: [4, 8], menengah: [8, 12], mahir: [12, 18] }
      }
    ]
  },
  {
    day: 4,
    routine: [
      {
        name: 'Dumbbell Overhead Press',
        anim: 'press',
        cue: 'Dorong kedua dumbbell ke atas kepala sampai lengan lurus, turunkan ke samping bahu.',
        base: { bulk: { sets: 4, reps: '8–10' }, cut: { sets: 3, reps: '10–12' } },
        weight: { pemula: [6, 10], menengah: [10, 16], mahir: [16, 22] }
      },
      {
        name: 'Dumbbell Lateral Raise',
        anim: 'lateral',
        cue: 'Angkat kedua lengan ke samping sampai sejajar bahu, turunkan pelan tanpa tergesa.',
        base: { bulk: { sets: 3, reps: '12–15' }, cut: { sets: 3, reps: '15' } },
        weight: { pemula: [2, 4], menengah: [4, 6], mahir: [6, 10] }
      },
      {
        name: 'Dumbbell Reverse Fly',
        anim: 'rearfly',
        cue: 'Condong ke depan, buka kedua lengan ke samping setinggi bahu, remas punggung atas.',
        base: { bulk: { sets: 3, reps: '12–15' }, cut: { sets: 3, reps: '15' } },
        weight: { pemula: [2, 4], menengah: [4, 6], mahir: [6, 10] }
      },
      {
        name: 'Dumbbell Shrug',
        anim: 'shrug',
        cue: 'Angkat bahu setinggi mungkin ke arah telinga, tahan sebentar, turunkan santai.',
        base: { bulk: { sets: 4, reps: '12–15' }, cut: { sets: 4, reps: '15' } },
        weight: { pemula: [10, 16], menengah: [16, 24], mahir: [24, 32] }
      }
    ]
  },
  {
    day: 5,
    routine: [
      {
        name: 'Goblet Squat',
        anim: 'squat',
        cue: 'Pegang satu dumbbell di depan dada, jongkok sampai paha sejajar lantai, tegak kembali.',
        base: { bulk: { sets: 4, reps: '8–10' }, cut: { sets: 3, reps: '10–12' } },
        weight: { pemula: [8, 12], menengah: [12, 20], mahir: [20, 30] }
      },
      {
        name: 'Dumbbell Romanian Deadlift',
        anim: 'rdl',
        cue: 'Jaga punggung lurus, condongkan badan sambil dumbbell meluncur di depan kaki, lalu tegak kembali.',
        base: { bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
        weight: { pemula: [10, 16], menengah: [16, 24], mahir: [24, 32] }
      },
      {
        name: 'Dumbbell Reverse Lunge',
        anim: 'lunge',
        cue: 'Melangkah mundur lalu turunkan lutut belakang sampai hampir menyentuh lantai, kembali berdiri.',
        base: { bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
        weight: { pemula: [4, 8], menengah: [8, 14], mahir: [14, 20] }
      },
      {
        name: 'Bulgarian Split Squat',
        anim: 'lunge',
        cue: 'Kaki belakang di atas kursi, turunkan tubuh lurus ke bawah lalu dorong naik memakai kaki depan.',
        base: { bulk: { sets: 3, reps: '10–12' }, cut: { sets: 3, reps: '12–15' } },
        weight: { pemula: [4, 8], menengah: [8, 14], mahir: [14, 20] }
      },
      {
        name: 'Standing Calf Raise',
        anim: 'calf',
        cue: 'Jinjit setinggi mungkin dengan dumbbell di sisi tubuh, tahan sejenak di atas, turunkan pelan.',
        base: { bulk: { sets: 4, reps: '12–15' }, cut: { sets: 4, reps: '15' } },
        weight: { pemula: [8, 12], menengah: [12, 20], mahir: [20, 28] }
      }
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

function intensityLevel(intensity) {
  return INTENSITY_LEVELS[intensity] || INTENSITY_LEVELS.menengah;
}

/* Gerakan hari tertentu yang sudah menyesuaikan program (reps) & intensitas (set + beban + istirahat). */
function getDayRoutine(day, program, intensity) {
  const lib = EXERCISE_LIBRARY.find(e => e.day === day);
  if (!lib) return null;
  const variant = programVariant(program);
  const level = intensityLevel(intensity);
  return lib.routine.map(ex => {
    const base = ex.base[variant];
    return {
      name: ex.name,
      anim: ex.anim,
      cue: ex.cue,
      sets: Math.max(2, base.sets + (level.setsAdj || 0)),
      reps: base.reps,
      weight: ex.weight[intensity] || ex.weight.menengah || ex.weight.pemula,
      rest: level.rest
    };
  });
}

function getCardioSuggestion(program) {
  return CARDIO_SUGGEST[program] || CARDIO_SUGGEST.bulking;
}