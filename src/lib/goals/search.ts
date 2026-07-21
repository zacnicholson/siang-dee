/**
 * Word search — lets the user find any English word and practice it.
 * Looks up the IPA dictionary and creates a one-off exercise on demand.
 */

import { lookupIPA, IPA_DICT } from "../phonology/dictionary";
import type { Exercise } from "../../data/exercises";
import type { ErrorId } from "../phonology/errors";

/** Thai translations for common English words (fallback for search results). */
const THAI_TRANSLATIONS: Record<string, string> = {
  // Common words — expand as the dictionary grows
  light: "แสงสว่าง", right: "ขวา", long: "ยาว", wrong: "ผิด",
  fly: "บิน", fry: "ทอด", glass: "แก้ว", grass: "หญ้า",
  play: "เล่น", pray: "อธิษฐาน", drive: "ขับรถ", smoke: "ควัน",
  school: "โรงเรียน", street: "ถนน", what: "อะไร", bag: "กระเป๋า",
  nice: "ดี", have: "มี", church: "โบสถ์", chair: "เก้าอี้",
  the: "คำนำหน้า", three: "สาม", think: "คิด", very: "มาก",
  river: "แม่น้ำ", show: "แสดง", ship: "เรือ", go: "ไป",
  water: "น้ำ", warm: "อบอุ่น", home: "บ้าน", food: "อาหาร",
  rice: "ข้าว", chicken: "ไก่", fish: "ปลา", tea: "ชา",
  coffee: "กาแฟ", phone: "โทรศัพท์", road: "ถนน", hope: "หวัง",
  book: "หนังสือ", cat: "แมว", dog: "หมา", clock: "นาฬิกา",
  red: "แดง", blue: "น้ำเงิน", green: "เขียว", yellow: "เหลือง",
  big: "ใหญ่", small: "เล็ก", good: "ดี", bad: "เลว",
  hello: "สวัสดี", goodbye: "ลาก่อน", please: "กรุณา", sorry: "ขอโทษ",
  one: "หนึ่ง", two: "สอง", three_: "สาม", ten: "สิบ",
  day: "วัน", week: "สัปดาห์", month: "เดือน", year: "ปี",
  love: "รัก", happy: "มีความสุข", sad: "เศร้า", angry: "โกรธ",
  time: "เวลา", money: "เงิน", work: "งาน", study: "เรียน",
  teacher: "ครู", student: "นักเรียน", doctor: "หมอ", friend: "เพื่อน",
};

/** Search the IPA dictionary for words matching the query. */
export function searchWords(query: string): Array<{
  word: string;
  phonemes: string[];
  thai: string | null;
}> {
  if (!query || query.trim().length === 0) return [];
  const q = query.toLowerCase().trim();

  // Direct match first
  const direct = lookupIPA(q);
  if (direct) {
    return [{ word: q, phonemes: direct, thai: THAI_TRANSLATIONS[q] ?? null }];
  }

  // Prefix search in the dictionary
  const results: Array<{ word: string; phonemes: string[]; thai: string | null }> = [];

  for (const [word, phonemes] of Object.entries(IPA_DICT)) {
    if (word.startsWith(q) || word.includes(q)) {
      results.push({
        word,
        phonemes: phonemes as string[],
        thai: THAI_TRANSLATIONS[word] ?? null,
      });
    }
    if (results.length >= 20) break;
  }

  return results;
}

/** Create a one-off exercise from a searched word. */
export function makeExerciseFromWord(word: string, phonemes: string[]): Exercise {
  return {
    id: `search-${word}`,
    errorIds: ["E1" as ErrorId], // generic — the detection layer will figure out errors
    type: "word",
    prompt: word,
    promptThai: THAI_TRANSLATIONS[word] ?? word,
    targetPhonemes: phonemes,
    difficulty: 2,
  };
}
