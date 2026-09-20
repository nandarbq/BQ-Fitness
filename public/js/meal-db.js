/* Basis bahan makanan: untuk PICKER di halaman Makan (pilih makanan) dan
 * untuk rekomendasi MENU LURING (fallback) bila AI tidak tersedia. */

const MEAL_TIMES = {
  sarapan: '06.00-09.00',
  camilan_pagi: '09.30-11.30',
  makan_siang: '12.00-14.00',
  camilan_sore: '15.00-17.00',
  makan_malam: '18.00-20.00',
  camilan_malam: '20.30-22.00'
};

const FOODS = {
  telur: { cat: 'protein', name: 'Telur rebus', unit: '2 butir', kcal: 140, protein: 12, carb: 1, fat: 10, also: ['tahu', 'tempe'] },
  dada_ayam: { cat: 'protein', name: 'Dada ayam', unit: '100 g', kcal: 165, protein: 31, carb: 0, fat: 4, also: ['telur', 'ikan_kembung', 'sapi'] },
  ayam_paha: { cat: 'protein', name: 'Paha ayam tanpa kulit', unit: '100 g', kcal: 160, protein: 19, carb: 0, fat: 9, also: ['dada_ayam', 'ikan_kembung'] },
  ikan_kembung: { cat: 'protein', name: 'Ikan kembung', unit: '100 g', kcal: 165, protein: 20, carb: 0, fat: 9, also: ['telur', 'dada_ayam', 'tahu'] },
  sapi: { cat: 'protein', name: 'Daging sapi tanpa lemak', unit: '100 g', kcal: 187, protein: 26, carb: 0, fat: 9, also: ['dada_ayam', 'tempe'] },
  udang: { cat: 'protein', name: 'Udang', unit: '100 g', kcal: 99, protein: 24, carb: 0, fat: 0, also: ['ikan_kembung', 'tahu'] },
  tahu: { cat: 'protein', name: 'Tahu', unit: '100 g', kcal: 80, protein: 8, carb: 1, fat: 5, also: ['tempe', 'telur'] },
  tempe: { cat: 'protein', name: 'Tempe', unit: '100 g', kcal: 195, protein: 20, carb: 8, fat: 11, also: ['tahu', 'telur'] },
  susu: { cat: 'protein', name: 'Susu UHT', unit: '250 ml', kcal: 150, protein: 8, carb: 12, fat: 6, also: ['yogurt', 'almond'] },
  yogurt: { cat: 'protein', name: 'Yogurt tawar', unit: '150 g', kcal: 100, protein: 6, carb: 10, fat: 2, also: ['susu', 'almond'] },
  nasi_putih: { cat: 'karbo', name: 'Nasi putih', unit: '1 porsi (150 g)', kcal: 195, protein: 4, carb: 42, fat: 0, also: ['nasi_merah', 'kentang', 'ubi'] },
  nasi_merah: { cat: 'karbo', name: 'Nasi merah', unit: '1 porsi (150 g)', kcal: 170, protein: 4, carb: 36, fat: 1, also: ['nasi_putih', 'ubi'] },
  kentang: { cat: 'karbo', name: 'Kentang rebus', unit: '200 g', kcal: 172, protein: 4, carb: 39, fat: 0, also: ['nasi_putih', 'ubi', 'roti_gandum'] },
  ubi: { cat: 'karbo', name: 'Ubi jalar', unit: '200 g', kcal: 180, protein: 4, carb: 42, fat: 0, also: ['kentang', 'nasi_putih', 'jagung'] },
  jagung: { cat: 'karbo', name: 'Jagung manis', unit: '1 bonggol', kcal: 155, protein: 5, carb: 34, fat: 2, also: ['ubi', 'nasi_putih'] },
  roti_gandum: { cat: 'karbo', name: 'Roti gandum', unit: '2 potong', kcal: 150, protein: 6, carb: 27, fat: 3, also: ['oatmeal', 'kentang'] },
  oatmeal: { cat: 'karbo', name: 'Oatmeal', unit: '50 g', kcal: 190, protein: 7, carb: 32, fat: 4, also: ['roti_gandum', 'nasi_putih'] },
  alpukat: { cat: 'lemak', name: 'Alpukat', unit: '½ buah', kcal: 160, protein: 2, carb: 9, fat: 15, also: ['almond', 'selai_kacang'] },
  almond: { cat: 'lemak', name: 'Kacang almond', unit: '15 g', kcal: 86, protein: 3, carb: 3, fat: 7, also: ['selai_kacang', 'alpukat'] },
  selai_kacang: { cat: 'lemak', name: 'Selai kacang', unit: '20 g', kcal: 118, protein: 5, carb: 4, fat: 10, also: ['almond', 'alpukat'] },
  minyak_zaitun: { cat: 'lemak', name: 'Minyak zaitun', unit: '15 g (1 sdm)', kcal: 132, protein: 0, carb: 0, fat: 15, also: ['almond', 'selai_kacang'] },
  pisang: { cat: 'sayurbuah', name: 'Pisang', unit: '1 buah', kcal: 105, protein: 1, carb: 27, fat: 0, also: ['apel', 'jeruk'] },
  apel: { cat: 'sayurbuah', name: 'Apel', unit: '1 buah', kcal: 95, protein: 0, carb: 25, fat: 0, also: ['pisang', 'jeruk'] },
  jeruk: { cat: 'sayurbuah', name: 'Jeruk', unit: '1 buah', kcal: 62, protein: 1, carb: 15, fat: 0, also: ['apel', 'pisang'] },
  brokoli: { cat: 'sayurbuah', name: 'Brokoli kukus', unit: '100 g', kcal: 34, protein: 3, carb: 7, fat: 0, also: ['bayam', 'kacang_panjang'] },
  bayam: { cat: 'sayurbuah', name: 'Bayam tumis', unit: '100 g', kcal: 23, protein: 3, carb: 4, fat: 0, also: ['brokoli', 'kacang_panjang'] },
  kacang_panjang: { cat: 'sayurbuah', name: 'Kacang panjang', unit: '100 g', kcal: 47, protein: 3, carb: 8, fat: 0, also: ['bayam', 'brokoli'] },
  wortel: { cat: 'sayurbuah', name: 'Wortel', unit: '1 buah', kcal: 41, protein: 1, carb: 10, fat: 0, also: ['kacang_panjang', 'brokoli'] },
  tomat: { cat: 'sayurbuah', name: 'Tomat', unit: '1 buah', kcal: 18, protein: 1, carb: 4, fat: 0, also: ['wortel', 'bayam'] }
};

/* Katalog untuk Picker: urutan grup & anggota. Opsi "AI" ditandai pada
 * elemen yang jadi rekomendasi menu AI hari ini. */
const FOOD_CATALOG = {
  groups: [
    { key: 'protein', label: 'Protein', note: 'bangun & jaga otot', ids: ['telur', 'dada_ayam', 'ayam_paha', 'ikan_kembung', 'sapi', 'udang', 'tahu', 'tempe', 'susu', 'yogurt'] },
    { key: 'karbo', label: 'Karbohidrat', note: 'sumber energi utama', ids: ['nasi_putih', 'nasi_merah', 'roti_gandum', 'oatmeal', 'kentang', 'ubi', 'jagung'] },
    { key: 'lemak', label: 'Lemak', note: 'hormon & rasa kenyang', ids: ['alpukat', 'almond', 'selai_kacang', 'minyak_zaitun'] },
    { key: 'sayurbuah', label: 'Sayur & Buah', note: 'serat, vitamin & antioksidan', ids: ['brokoli', 'bayam', 'kacang_panjang', 'wortel', 'tomat', 'pisang', 'apel', 'jeruk'] }
  ]
};

function recommendationFrequency(cal) {
  if (cal < 1600) return 3;
  if (cal < 2200) return 4;
  if (cal < 2900) return 5;
  return 6;
}

function slotKeys(freq) {
  const base = ['sarapan', 'makan_siang', 'makan_malam'];
  if (freq >= 4) base.splice(2, 0, 'camilan_sore');
  if (freq >= 5) base.splice(1, 0, 'camilan_pagi');
  if (freq >= 6) base.push('camilan_malam');
  return base;
}

const MEAL_PLAN = {
  sarapan: [['telur', 1.2], ['oatmeal', 1], ['pisang', 1]],
  camilan_pagi: [['yogurt', 1.2], ['almond', 1]],
  makan_siang: [['dada_ayam', 1.3], ['nasi_putih', 1.2], ['brokoli', 1.5]],
  camilan_sore: [['apel', 1], ['selai_kacang', 0.6]],
  makan_malam: [['ikan_kembung', 1.3], ['kentang', 1.2], ['bayam', 1.5]],
  camilan_malam: [['susu', 1]]
};

function scaleItem(item, factor) {
  return {
    name: item.name,
    qty: item.unit,
    kcal: Math.round(item.kcal * factor),
    protein: Math.round(item.protein * factor * 10) / 10,
    carb: Math.round(item.carb * factor * 10) / 10,
    fat: Math.round(item.fat * factor * 10) / 10,
    alternatives: (item.also || []).slice(0, 3).map(k => {
      const alt = FOODS[k];
      return {
        name: alt.name,
        qty: alt.unit,
        kcal: Math.round(alt.kcal * factor),
        protein: Math.round(alt.protein * factor * 10) / 10,
        carb: Math.round(alt.carb * factor * 10) / 10,
        fat: Math.round(alt.fat * factor * 10) / 10
      };
    })
  };
}

function buildFallbackPlan(goals) {
  const cal = (goals && goals.cal) || 2000;
  const freq = recommendationFrequency(cal);
  const keys = slotKeys(freq);
  let baseTotal = 0;
  const baseBySlot = {};
  Object.entries(MEAL_PLAN).forEach(([slot, defs]) => {
    const tot = defs.reduce((s, [id, mult]) => s + FOODS[id].kcal * (mult || 1), 0);
    baseBySlot[slot] = { defs, tot };
    if (keys.includes(slot)) baseTotal += tot;
  });
  const factor = Math.min(1.6, Math.max(0.7, cal / baseTotal));

  const meals = keys.map(slot => {
    const { defs } = baseBySlot[slot];
    return {
      slot,
      time: MEAL_TIMES[slot],
      items: defs.map(([id, mult]) => scaleItem(FOODS[id], (mult || 1) * factor))
    };
  });

  const totals = meals.reduce((acc, m) => {
    m.items.forEach(it => {
      acc.kcal += it.kcal; acc.protein += it.protein; acc.carb += it.carb; acc.fat += it.fat;
    });
    return acc;
  }, { kcal: 0, protein: 0, carb: 0, fat: 0 });

  return {
    frequency: freq,
    total: { kcal: Math.round(totals.kcal), protein: Math.round(totals.protein), carb: Math.round(totals.carb), fat: Math.round(totals.fat) },
    meals
  };
}

window.MEAL_RECOMMEND = { recommendationFrequency, slotKeys, buildFallbackPlan };
window.FOOD_CATALOG = FOOD_CATALOG;
window.FOODS = FOODS;