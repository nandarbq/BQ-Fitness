/* Layanan AI (opsional) untuk rekomendasi menu, saran harian, dan
 * penjelasan program. Default MATI; aktifkan dengan .env:
 *   AI_PROVIDER=gemini
 *   AI_API_KEY=...
 *   AI_MODEL=gemini-2.0-flash      (opsional)
 *
 * Semua pemanggilan dari server; kunci tidak pernah dikirim ke client.
 * Gagal/error/offline -> function lempar eksepsi, pemanggil pakai fallback. */

const AI_PROVIDER = (process.env.AI_PROVIDER || 'none').toLowerCase();
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gemini-2.0-flash';

const MEAL_KEYS = ['sarapan', 'camilan_pagi', 'makan_siang', 'camilan_sore', 'makan_malam', 'camilan_malam'];
const MEAL_TIMES = {
  sarapan: '06.00-09.00',
  camilan_pagi: '09.30-11.30',
  makan_siang: '12.00-14.00',
  camilan_sore: '15.00-17.00',
  makan_malam: '18.00-20.00',
  camilan_malam: '20.30-22.00'
};

function isAiEnabled() {
  return AI_PROVIDER === 'gemini' && !!AI_API_KEY;
}

function providerLabel() {
  return AI_PROVIDER === 'gemini' ? 'Gemini Flash' : AI_PROVIDER;
}

async function geminiGenerate(systemText, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${encodeURIComponent(AI_API_KEY)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents: [{ parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      })
    });
  } catch (e) {
    clearTimeout(timer);
    throw new Error('Gagal menghubungi Gemini: ' + e.message);
  }
  clearTimeout(timer);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.candidates && data.candidates[0] && data.candidates[0].content &&
    data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) || '';
  return parseJsonSafe(text);
}

/* Ambil blok JSON dari teks model (cadangan kalau responseMimeType gagal). */
function parseJsonSafe(text) {
  if (!text) throw new Error('Respons AI kosong.');
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Respons AI bukan JSON valid.');
  }
}

/* ------------------------------------------------------------------ */
/* 1. MENU MAKAN HARIAN                                               */
/* ------------------------------------------------------------------ */
function mealSystemPrompt() {
  return `Kamu adalah ahli gizi olahraga Indonesia. Tugas: menyusun satu hari menu makan untuk pengguna aplikasi fitness dengan data yang diberikan. PENTING:
- Bahasa Indonesia, makanan sehari-hari yang terjangkau di Indonesia (nasi, ayam, telur, tahu, tempe, ikan, daging, sayur, buah, susu, kacang).
- Jumlah sesi makan 3-6 sesuai petunjuk "frequency".
- SLOT KUNCI HANYA dari daftar ini (jangan buat slot baru): ${MEAL_KEYS.join(', ')}. Setiap slot punya rentang jam tetap:
${Object.entries(MEAL_TIMES).map(([k, t]) => `- ${k}: ${t}`).join('\n')}
- Setiap item beri ALTERNATIF (1-3 pengganti yang mudah didapat) DENGAN perkiraan makro serupa — karena belum tentu semua orang punya bahan yang sama.
- Jumlahkan total kalori SEMUA item ≈ TARGET_KALORI (dalam ±10%). Protein ≈ TARGET_PROTEIN, karbohidrat ≈ TARGET_KARBO, lemak ≈ TARGET_LEMAK.
- Sesuaikan porsi dgn program: bulking = karbo & kalori lebih, cutting = porsi lean & rendah lemak, maintenance = seimbang.
- Keluarkan HANYA JSON dengan skema:
{"meals":[{"slot":"sarapan","time":"06.00-09.00","items":[{"name":"telur rebus","qty":"2 butir","kcal":140,"protein":12,"carb":1,"fat":10,"alternatives":[{"name":"tahu goreng","qty":"2 potong","kcal":120,"protein":10,"carb":2,"fat":8}]}]}]}`;
}

function mealUserPrompt(ctx) {
  return `DATA PENGGUNA:
- Gender: ${ctx.gender}, umur: ${ctx.age} tahun
- BB ${ctx.weight} kg, TB ${ctx.height} cm, aktivitas: ${ctx.activityLabel}
- Program: ${ctx.program} (${ctx.intensity})
- TARGET MAKAN hari ini: ${ctx.goals.cal} kkal, protein ${ctx.goals.protein}g, karbo ${ctx.goals.carb}g, lemak ${ctx.goals.fat}g
- Jumlah sesi makan yang disarankan: ${ctx.frequency}
- Sudah tercatat makan hari ini: ${ctx.eatenKcal} kkal (protein ${ctx.eatenProtein}g).
Susun menu 1 hari lengkap sesuai aturan.`;
}

function validateMealPlan(plan, goals) {
  if (!plan || !Array.isArray(plan.meals) || !plan.meals.length) throw new Error('Menu tidak valid.');
  const allowed = new Set(MEAL_KEYS);
  const seen = new Set();
  let kcalTotal = 0, proteinTotal = 0, carbTotal = 0, fatTotal = 0;
  for (const meal of plan.meals) {
    if (!allowed.has(meal.slot) || seen.has(meal.slot)) throw new Error(`Slot "${meal.slot}" tidak valid/duplikat.`);
    seen.add(meal.slot);
    if (!meal.time) meal.time = MEAL_TIMES[meal.slot] || '';
    if (!Array.isArray(meal.items) || !meal.items.length) throw new Error(`Slot "${meal.slot}" kosong.`);
    for (const it of meal.items) {
      if (!it.name) throw new Error('Item tanpa nama.');
      it.kcal = Math.max(0, Number(it.kcal) || 0);
      it.protein = Math.max(0, Number(it.protein) || 0);
      it.carb = Math.max(0, Number(it.carb) || 0);
      it.fat = Math.max(0, Number(it.fat) || 0);
      kcalTotal += it.kcal; proteinTotal += it.protein; carbTotal += it.carb; fatTotal += it.fat;
      if (!Array.isArray(it.alternatives)) it.alternatives = [];
    }
  }
  const target = goals.cal || 2000;
  if (kcalTotal > target * 1.3 || kcalTotal < target * 0.6) {
    throw new Error(`Total kkal AI (${Math.round(kcalTotal)}) di luar ±30% target (${target}).`);
  }
  plan.frequency = seen.size;
  plan.total = { kcal: Math.round(kcalTotal), protein: Math.round(proteinTotal), carb: Math.round(carbTotal), fat: Math.round(fatTotal) };
  return plan;
}

async function generateMealPlan(ctx) {
  const plan = await geminiGenerate(mealSystemPrompt(), mealUserPrompt(ctx));
  return validateMealPlan(plan, ctx.goals);
}

/* ------------------------------------------------------------------ */
/* 2. SARAN HARIAN                                                    */
/* ------------------------------------------------------------------ */
async function generateDailyAdvice(ctx) {
  const system = `Kamu asisten kebugaran yang ringkas. Dari data pengguna, beri SARAN HARI INI yang praktis (makan, latihan, istirahat). Bahasa Indonesia, maksimal 150 kata. Keluarkan HANYA JSON: {"title":"...","points":["...","..."],"summary":"..."}`;
  const user = `Gender ${ctx.gender}, ${ctx.age} th, BB ${ctx.weight}, TB ${ctx.height}, program ${ctx.program} (${ctx.intensity}), target makan ${ctx.goals.cal} kkal (P${ctx.goals.protein} K${ctx.goals.carb} L${ctx.goals.fat}), sudah makan ${ctx.eatenKcal} kkal hari ini, latihan hari ini: ${ctx.todayWorkout}.`;
  const advice = await geminiGenerate(system, user);
  if (!advice || !Array.isArray(advice.points)) throw new Error('Saran tidak valid.');
  advice.title = advice.title || 'Saran hari ini';
  return advice;
}

/* ------------------------------------------------------------------ */
/* 3. ALASAN REKOMENDASI PROGRAM                                      */
/* ------------------------------------------------------------------ */
async function generateProgramRationale(ctx) {
  const system = `Kamu ahli gizi & pelatih. Jelaskan ringkas (maks 160 kata, Bahasa Indonesia) KENAPA program ini direkomendasikan untuk pengguna dan apa fokusnya. Keluarkan HANYA JSON: {"text":"..."}`;
  const user = `BMI ${ctx.bmi} (${ctx.bmiStatus}), gender ${ctx.gender}, umur ${ctx.age}, BB ${ctx.weight}, TB ${ctx.height}, aktivitas ${ctx.activityLabel}, program direkomendasikan: ${ctx.program} (intensitas ${ctx.intensity}), target BB ${ctx.targetWeight} kg dalam ${ctx.durationWeeks} minggu, target makan ${ctx.goals.cal} kkal.`;
  const out = await geminiGenerate(system, user);
  if (!out || !out.text) throw new Error('Penjelasan tidak valid.');
  return out.text;
}

module.exports = {
  isAiEnabled,
  providerLabel,
  AI_MODEL,
  MEAL_KEYS,
  MEAL_TIMES,
  generateMealPlan,
  generateDailyAdvice,
  generateProgramRationale
};