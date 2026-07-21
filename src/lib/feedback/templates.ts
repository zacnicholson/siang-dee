/**
 * Template-based feedback (SPEC §5.6). One template per errorId, fills in
 * the target/spoken phonemes. Thai-primary + English in parens.
 */
import { ERROR_CATEGORIES, type ErrorId, type Phoneme } from "../phonology";

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

export function buildFeedback(errorId: ErrorId, target?: Phoneme, spoken?: Phoneme): Feedback {
  const cat = ERROR_CATEGORIES[errorId];
  // inject the specific phoneme pair into the Thai explanation where it helps
  const th = cat.explainTh;
  const en = cat.explainEn;
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
