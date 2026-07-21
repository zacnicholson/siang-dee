/**
 * Template-based feedback (SPEC §5.6). One template per errorId, fills in
 * the target/spoken phonemes. Thai-primary + English in parens.
 */
import { ERROR_CATEGORIES, type ErrorId, type Phoneme } from "../phonology";
import { sentenceToPhonemes } from "../phonology/dictionary";

export interface Feedback {
  errorId: ErrorId;
  th: string;   // Thai coaching text (also spoken via TTS)
  en: string;   // English short label
  iconHint: string; // emoji mnemonic
}

const IPAClose: Record<string, string> = {
  l: "l", r: "r", θ: "th", ð: "th", ʃ: "sh", tʃ: "ch", ʒ: "zh", dʒ: "j",
  ə: "uh", ɜː: "er", ɑː: "ah", ɔː: "aw", ɒ: "o", uː: "oo", ʊ: "u",
  iː: "ee", ɪ: "i", eɪ: "ay", aɪ: "eye", ɔɪ: "oy", əʊ: "oh", aʊ: "ow", ɪə: "ear",
};

function readable(p?: Phoneme): string { return p ? (IPAClose[p] ?? p) : "—"; }

export function buildFeedback(errorId: ErrorId, target?: Phoneme, spoken?: Phoneme, prompt?: string): Feedback {
  const cat = ERROR_CATEGORIES[errorId];
  // inject the specific phoneme pair into the Thai explanation where it helps
  let th = cat.explainTh;
  let en = cat.explainEn;

  // === Plural-specific coaching ===
  // When a word ends in /z/ (plural, possessive, or 3rd-person verb)
  // and the user drops it (E3 deletion) or devoices it to /s/ (E9),
  // give a more specific coaching message about plurals.
  if (prompt && (errorId === "E3" || errorId === "E9") && target === "z") {
    // Find which word in the sentence contains the deleted/devoiced /z/
    const words = prompt.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    const { phonemes, boundaries } = sentenceToPhonemes(prompt);
    // The error position tells us which word — but we don't have the exact
    // position here, so just check if the sentence has plural words.
    const pluralWords = words.filter(w => {
      const p = sentenceToPhonemes(w).phonemes;
      return p.length > 0 && p[p.length - 1] === "z";
    });
    if (pluralWords.length > 0) {
      if (errorId === "E3") {
        th = `คุณตัดเสียง /z/ ท้ายคำ — คำพหูพจน์เช่น "${pluralWords[0]}" ต้องมีเสียง /z/ ท้าย ให้ถือเสียงสั่นที่คอให้ชัด`;
        en = `You dropped the /z/ on "${pluralWords[0]}" — plurals need the buzzing /z/ at the end`;
      } else if (errorId === "E9") {
        th = `คุณออกเสียง /s/ แทน /z/ ท้ายคำ — คำพหูพจน์เช่น "${pluralWords[0]}" ต้องมีเสียงสั่น /z/ ไม่ใช่เสียงสั้น /s/ ให้เพิ่มเสียงก้องที่คอ`;
        en = `You said /s/ instead of /z/ on "${pluralWords[0]}" — plurals need a buzzing /z/, not a hissing /s/`;
      }
    }
  }

  const iconHint = emojiFor(errorId, target, spoken);
  return { errorId, th, en, iconHint };
}

function emojiFor(id: ErrorId, target?: Phoneme, spoken?: Phoneme): string {
  switch (id) {
    case "E1": return target === "l" ? "🗣️ ล→ร" : target === "r" ? "🗣️ ร→ล" : "🗣️ l/r";
    case "E2": return "➕ สระเกิน";
    case "E3": return "✂️ ตัดท้าย";
    case "E4": return "✂️ ย่อท้าย";
    case "E5": return "🔀 ch→sh";
    case "E6": return "👅 th";
    case "E7": return "🔀 sh→s";
    case "E8": return "👄 v→w";
    case "E9": return "🔊 z→s";
    case "E10": return "➡️ สระเดียว";
    case "E11": return "⏱️ ยาว/สั้น";
    case "E14": return "🔻 ลดรูป";
    default: return "🎵";
  }
}

/** summary line for the score reveal (Thai, spoken + shown) */
export function summaryTh(score: number, errorCount: number): string {
  if (score >= 85) return `เก่งมาก! ${score} คะแนน`;
  if (score >= 70) return `ดีแล้ว! ${score} คะแนน${errorCount > 0 ? ` มีเสียงที่แก้ ${errorCount} จุด` : ""}`;
  if (score >= 55) return `ใกล้แล้ว! ${score} คะแนน ลองอีกครั้ง`;
  return `ลองอีกครั้งนะ ${score} คะแนน — ฟังตัวอย่างแล้วพูดตาม`;
}
