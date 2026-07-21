/**
 * Thai→English error categories — the scientific core of Siang Dee.
 * See SPEC.md §4. Each error has a stable id, IPA target/substitution sets,
 * and a `detect` predicate over an aligned position.
 *
 * Grounded in Thai phonology:
 *  - Thai has only 8 syllable-final consonants (/p t k ʔ m n ŋ w j/), no final clusters.
 *  - No /θ ð ʃ ʒ tʃ dʒ/ in the Thai inventory.
 *  - Syllable-timed, no lexical stress contrast.
 * Sources: pronunciationstudio.com "10 English Pronunciation Errors by Thai Speakers";
 * Thai-accented English phonology review (ERIC EJ1348382).
 */
import type { Phoneme } from "./phonemes";

export type ErrorId =
  | "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8"
  | "E9" | "E10" | "E11" | "E12" | "E13" | "E14" | "E15";

export interface ErrorCategory {
  id: ErrorId;
  nameEn: string;
  nameTh: string;
  /** target phonemes this error concerns (for quick filtering / drill selection) */
  targets: Phoneme[];
  /** phonemes a Thai speaker commonly substitutes INSTEAD of the target */
  substitutions: Phoneme[];
  /** human explanation */
  explainEn: string;
  explainTh: string;
  /** whether this is segmental (scored) or suprasegmental (note-only in MVP) */
  segmental: boolean;
}

export const ERROR_CATEGORIES: Record<ErrorId, ErrorCategory> = {
  E1: {
    id: "E1", nameEn: "/l/ vs /r/ confusion", nameTh: "สับสน ล กับ ร",
    targets: ["l", "r"], substitutions: ["r", "l"],
    explainEn: "You pronounced /l/ as /r/ (or vice-versa). For /l/, touch your tongue tip to the ridge behind your upper teeth and let air flow around the sides. For /r/, curl the tongue tip back without touching.",
    explainTh: "คุณออกเสียง /l/ เป็น /r/ (หรือกลับกัน) สำหรับ /l/ ให้แตะปลายลิ้นที่เพดานปากแล้วปล่อยลมออกข้างๆ สำหรับ /r/ ให้ม้วนปลายลิ้นขึ้นเล็กน้อยโดยไม่แตะ",
    segmental: true,
  },
  E2: {
    id: "E2", nameEn: "Consonant-cluster epenthesis", nameTh: "แทรกสระในกลุ่มพยัญชนะ",
    targets: [], substitutions: ["ə"],
    explainEn: "You inserted an extra vowel between consonants in a cluster (e.g., 'drive' → 'da-rive'). Keep the consonants together — don't break them with a vowel.",
    explainTh: "คุณแทรกสระเสียงเข้าไประหว่างพยัญชนะในกลุ่ม (เช่น drive → da-rive) ให้พยัญชนะอยู่ติดกันโดยไม่มีสระคั่น",
    segmental: true,
  },
  E3: {
    id: "E3", nameEn: "Word-final consonant deletion", nameTh: "ตัดพยัญชนะท้ายคำ",
    targets: ["t", "d", "k", "g", "s", "z", "θ", "ð", "f", "v", "l", "r", "tʃ", "dʒ"],
    substitutions: [],
    explainEn: "You dropped the final consonant. Thai allows only a few finals, so English word-final consonants are often omitted. Hold the final sound clearly.",
    explainTh: "คุณตัดเสียงพยัญชนะตัวสุดท้าย ภาษาไทยมีเสียงสะกดท้ายได้ไม่มาก เสียงสะกดท้ายภาษาอังกฤษจึงมักถูกตัด ให้ถือเสียงสะกดท้ายให้ชัด",
    segmental: true,
  },
  E4: {
    id: "E4", nameEn: "Final-cluster simplification", nameTh: "ย่อกลุ่มพยัญชนะท้ายคำ",
    targets: ["t", "d", "k", "s", "z", "l", "r"],
    substitutions: [],
    explainEn: "You simplified a word-final cluster by dropping a consonant (e.g., 'asked' → 'ask'). Pronounce every consonant in the final cluster.",
    explainTh: "คุณย่อกลุ่มพยัญชนะท้ายคำโดยตัดบางเสียงทิ้ง (เช่น asked → ask) ให้ออกเสียงพยัญชนะทุกตัวในกลุ่มท้ายคำ",
    segmental: true,
  },
  E5: {
    id: "E5", nameEn: "/tʃ/ → /ʃ/ or /s/", nameTh: "ตี /tʃ/ เป็น /ʃ/ หรือ /s/",
    targets: ["tʃ"], substitutions: ["ʃ", "s"],
    explainEn: "You replaced /tʃ/ (as in 'church') with /ʃ/ ('shurch') or /s/. Start with a /t/ stop on the ridge, then glide to /ʃ/.",
    explainTh: "คุณออกเสียง /tʃ/ (เช่นใน church) เป็น /ʃ/ หรือ /s/ ให้เริ่มด้วยเสียง /t/ ที่เพดานปากแล้วเลื่อนไป /ʃ/",
    segmental: true,
  },
  E6: {
    id: "E6", nameEn: "/θ/ → /s/ or /t/; /ð/ → /z/ or /d/", nameTh: "ตี /θ/ เป็น /s/ หรือ /t/; /ð/ เป็น /z/ หรือ /d/",
    targets: ["θ", "ð"], substitutions: ["s", "t", "z", "d"],
    explainEn: "You replaced /θ/ or /ð/ (the 'th' sounds) with /s/, /t/, /z/, or /d/. Put your tongue tip lightly between your teeth and push air through.",
    explainTh: "คุณออกเสียง /θ/ หรือ /ð/ (เสียง th) เป็น /s/ /t/ /z/ หรือ /d/ ให้เอาปลายลิ้นแตะฟันหน้าเบาๆ แล้วเป่าลมผ่าน",
    segmental: true,
  },
  E7: {
    id: "E7", nameEn: "/ʃ/ → /s/", nameTh: "ตี /ʃ/ เป็น /s/",
    targets: ["ʃ"], substitutions: ["s"],
    explainEn: "You replaced /ʃ/ ('sh') with /s/. Round your lips and push air through a narrow gap with the tongue blade raised.",
    explainTh: "คุณออกเสียง /ʃ/ (เสียง ช) เป็น /s/ ให้ปากเป็นรูปวงกลมแล้วเป่าลมผ่านช่องแคบที่ปลายลิ้น",
    segmental: true,
  },
  E8: {
    id: "E8", nameEn: "/v/ → /w/", nameTh: "ตี /v/ เป็น /w/",
    targets: ["v"], substitutions: ["w"],
    explainEn: "You replaced /v/ with /w/. Touch your upper teeth to your lower lip and vibrate for /v/.",
    explainTh: "คุณออกเสียง /v/ เป็น /w/ ให้ฟันบนแตะริมฝีปากล่างแล้วสั่นสำหรับ /v/",
    segmental: true,
  },
  E9: {
    id: "E9", nameEn: "Word-final /z/ devoicing", nameTh: "/z/ ท้ายคำเป็น /s/",
    targets: ["z"], substitutions: ["s"],
    explainEn: "You devoiced final /z/ to /s/. Add voice (vibration in your throat) to keep the buzz on /z/.",
    explainTh: "คุณเปลี่ยน /z/ ท้ายคำเป็น /s/ ให้เพิ่มเสียงก้อง (สั่นที่คอ) เพื่อให้ได้เสียง /z/",
    segmental: true,
  },
  E10: {
    id: "E10", nameEn: "/əʊ/ → /ɔ/ or /ɒ/", nameTh: "/əʊ/ เป็น /ɔ/ หรือ /ɒ/",
    targets: ["əʊ"], substitutions: ["ɔː", "ɒ"],
    explainEn: "You collapsed the diphthong /əʊ/ into a single vowel. Glide from /ə/ to /ʊ/ — the tongue moves.",
    explainTh: "คุณยุ่เสียงสองเสียง /əʊ/ เป็นเสียงเดียว ให้เลื่อนจาก /ə/ ไป /ʊ/ — ลิ้นขยับ",
    segmental: true,
  },
  E11: {
    id: "E11", nameEn: "Vowel length / tense-lax", nameTh: "ความยาวเสียงสระ",
    targets: ["iː", "ɪ", "uː", "ʊ", "ɑː", "ʌ"],
    substitutions: ["ɪ", "iː", "ʊ", "uː", "ʌ", "ɑː"],
    explainEn: "You confused a tense/long vowel with its lax/short counterpart (e.g., 'sheep'/'ship'). Hold the long vowel longer; keep the short vowel short and relaxed.",
    explainTh: "คุณสับสนสระเสียงยาวกับเสียงสั้น (เช่น sheep/ship) ให้ถือสระเสียงยาวให้นานขึ้น และสระเสียงสั้นให้สั้นและคลาย",
    segmental: true,
  },
  E12: {
    id: "E12", nameEn: "Nasalized vowels", nameTh: "สระเสียงใน",
    targets: [], substitutions: [],
    explainEn: "Your vowels sound nasal (air through the nose). Keep airflow through the mouth for oral vowels.",
    explainTh: "เสียงสระของคุณมีเสียงใน (ลมออกทางจมูก) ให้ปล่อยลมออกทางปากสำหรับสระปกติ",
    segmental: false,
  },
  E13: {
    id: "E13", nameEn: "Word stress", nameTh: "เน้นเสียงในคำ",
    targets: [], substitutions: [],
    explainEn: "English words have a stressed syllable — check you're not always stressing the final syllable.",
    explainTh: "คำภาษาอังกฤษมีพยางค์ที่เน้น — ตรวจดูว่าไม่ได้เน้นพยางค์สุดท้ายตลอด",
    segmental: false,
  },
  E14: {
    id: "E14", nameEn: "Weak-form reduction missing", nameTh: "ไม่ลดรูปคำสระ",
    targets: ["ə"], substitutions: ["æ", "ʌ", "ɒ", "e"],
    explainEn: "Function words like 'can/of/to' reduce to a schwa /ə/ in natural speech. You used a full vowel.",
    explainTh: "คำสระเช่น can/of/to จะลดเป็น /ə/ ในการพูดตามธรรมชาติ คุณใช้สระเต็ม",
    segmental: true,
  },
  E15: {
    id: "E15", nameEn: "Syllable timing / intonation", nameTh: "จังหวะและท่วงทำนอง",
    targets: [], substitutions: [],
    explainEn: "English is stress-timed — some syllables longer, others shorter. You gave every syllable equal weight.",
    explainTh: "ภาษาอังกฤษมีจังหวะตามเน้นเสียง — พยางค์บางเสียงยาว เสียงอื่นสั้น คุณให้น้ำหนักเท่ากันทุกพยางค์",
    segmental: false,
  },
};

/** Quick lookup: target phoneme -> errors that target it (segmental only). */
const targetIndex: Map<Phoneme, ErrorId[]> = new Map();
for (const [id, cat] of Object.entries(ERROR_CATEGORIES) as [ErrorId, ErrorCategory][]) {
  if (!cat.segmental) continue;
  for (const t of cat.targets) {
    if (!targetIndex.has(t)) targetIndex.set(t, []);
    targetIndex.get(t)!.push(id);
  }
}

/**
 * Given a target phoneme and what was actually spoken, return candidate ErrorIds.
 * Pure function — the alignment layer calls this per-position.
 */
export function candidateErrors(target: Phoneme | undefined, spoken: Phoneme | undefined): ErrorId[] {
  const out: ErrorId[] = [];
  if (!target && spoken === "ə") out.push("E2"); // epenthesis insertion of schwa
  if (target && !spoken) {
    // deletion — E3 (final) vs E4 (cluster) decided by the alignment layer (word boundary context)
    out.push("E3", "E4");
  }
  if (target && spoken && target !== spoken) {
    // direct substitution matches
    const byTarget = targetIndex.get(target) ?? [];
    for (const id of byTarget) {
      const cat = ERROR_CATEGORIES[id];
      if (cat.substitutions.includes(spoken)) out.push(id);
    }
  }
  return out;
}
