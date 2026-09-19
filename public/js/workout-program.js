/* Katalog latihan statis untuk program bulking/cutting.
 * Jadwal mingguan menempel nama hari (Senin=1 … Minggu=7):
 *   default latihan Senin/Selasa/Kamis/Jumat, rest Rabu/Sabtu/Minggu.
 * User bisa mengatur 1–6 hari rest -> rutinitas latihan & rotasi sesi auto menyesuaikan.
 * Semua gerakan hanya memakai DUMBBELL (satu pasang dumbbell, beban per tangan).
 * Variasi:
 *   - program bulking/cutting  -> menentukan repetisi (jml set dasar)
 *   - intensitas pemula/menengah/mahir -> menggeser jumlah set, rentang beban, istirahat */

const WEEKDAYS = [
  { num: 1, long: 'Senin', short: 'Sen' },
  { num: 2, long: 'Selasa', short: 'Sel' },
  { num: 3, long: 'Rabu', short: 'Rab' },
  { num: 4, long: 'Kamis', short: 'Kam' },
  { num: 5, long: 'Jumat', short: 'Jum' },
  { num: 6, long: 'Sabtu', short: 'Sab' },
  { num: 7, long: 'Minggu', short: 'Min' }
];

const DEFAULT_REST_DAYS = [3, 6, 7];

/* Urutan latihan mengikuti urutan hari latihan dalam sepekan:
 * latihan ke-1 = Chest & Triceps, ke-2 = Back & Biceps,
 * ke-3 = Shoulder, ke-4 = Leg Day. */
const ROUTINE_ORDER = [
  { order: 1, label: 'Chest & Triceps', slug: 'chest_triceps', goal: 'Dada & trisep', libDay: 1 },
  { order: 2, label: 'Back & Biceps', slug: 'back_biceps', goal: 'Punggung & bisep', libDay: 2 },
  { order: 3, label: 'Shoulder', slug: 'shoulder', goal: 'Bahu', libDay: 4 },
  { order: 4, label: 'Leg Day', slug: 'leg_day', goal: 'Kaki', libDay: 5 }
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

function parseRestDays(str) {
  if (Array.isArray(str)) str = str.join(',');
  const arr = String(str || '')
    .split(',')
    .map(s => parseInt(s, 10))
    .filter(n => !Number.isNaN(n) && n >= 1 && n <= 7);
  return arr.length ? [...new Set(arr)].sort((a, b) => a - b) : DEFAULT_REST_DAYS.slice();
}

function weekdayName(num) {
  return WEEKDAYS.find(d => d.num === num) || WEEKDAYS[6];
}

/* ISO -> nomor hari Senin=1 … Minggu=7 */
function weekdayNumber(iso) {
  const js = new Date(iso + 'T00:00:00').getDay(); // 0=Minggu … 6=Sabtu
  return js === 0 ? 7 : js;
}

function toISO(d) {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return new Date(utc).toISOString().slice(0, 10);
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}

function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/* Jadwal 7 hari (Senin..Minggu). Setiap sel:
 * { num, long, short, date, kind, order, label, slug, goal, libDay }
 * - kind 'gym'  : hari latihan, rutinitas mengikuti ROUTINE_ORDER berurutan.
 * - kind 'cardio': rest day paling akhir urutan (satu-satunya label Rest / Kardio).
 * - kind 'rest' : 2 rest day lainnya. */
function buildWeekSchedule(restDays, iso) {
  const rest = parseRestDays(restDays);
  const monday = mondayOf(iso || new Date().toISOString().slice(0, 10));
  const gym = [];
  for (let num = 1; num <= 7; num++) if (!rest.includes(num)) gym.push(num);
  const cardioDay = Math.max(...rest);
  const routineMap = {};
  gym.forEach((num, i) => { routineMap[num] = ROUTINE_ORDER[i % ROUTINE_ORDER.length]; });
  return WEEKDAYS.map(w => {
    const date = addDaysISO(monday, w.num - 1);
    const r = routineMap[w.num];
    if (r) return { ...w, date, kind: 'gym', order: r.order, label: r.label, slug: r.slug, goal: r.goal, libDay: r.libDay };
    const cardio = w.num === cardioDay;
    return {
      ...w, date, kind: cardio ? 'cardio' : 'rest', order: null,
      label: cardio ? 'Rest / Kardio' : 'Rest',
      slug: cardio ? 'cardio' : 'rest',
      goal: cardio ? 'Aktif ringan' : 'Pemulihan otot',
      libDay: null
    };
  });
}

/* Sesi sebuah hari (default: hari ini) dengan jadwal user. */
function getTodaySession(restDays, iso) {
  const day = weekdayNumber(iso || new Date().toISOString().slice(0, 10));
  return buildWeekSchedule(restDays, iso).find(c => c.num === day) || null;
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