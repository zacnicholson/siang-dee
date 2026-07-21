/**
 * Curated exercise bank (SPEC §8). ~15 drills across the error categories,
 * weighted toward E1–E3 (the wife's pain points). Each exercise links to
 * one or more ErrorIds and has a target word/sentence + Thai gloss.
 */
import type { ErrorId } from "../lib/phonology/errors";
import { ERROR_CATEGORIES } from "../lib/phonology/errors";

export type ExerciseType = "word" | "sentence" | "minimalpair";

export interface Exercise {
  id: string;
  errorIds: ErrorId[];
  type: ExerciseType;
  prompt: string;        // the English word/sentence to say
  promptThai: string;    // Thai meaning
  targetPhonemes: string[];
  pairId?: string;       // for minimal pairs
  difficulty: 1 | 2 | 3;
  modelAudioUrl?: string; // pre-rendered model audio (optional; falls back to TTS)
}

export const EXERCISES: Exercise[] = [
  // E1 l/r (her main pain point — most drills here)
  { id: "e1-light", errorIds: ["E1"], type: "word", prompt: "light", promptThai: "แสงสว่าง", targetPhonemes: ["l","aɪ","t"], pairId: "e1-right", difficulty: 1 },
  { id: "e1-right", errorIds: ["E1"], type: "word", prompt: "right", promptThai: "ขวา", targetPhonemes: ["r","aɪ","t"], pairId: "e1-light", difficulty: 1 },
  { id: "e1-long", errorIds: ["E1"], type: "word", prompt: "long", promptThai: "ยาว", targetPhonemes: ["l","ɒ","ŋ"], pairId: "e1-wrong", difficulty: 1 },
  { id: "e1-wrong", errorIds: ["E1"], type: "word", prompt: "wrong", promptThai: "ผิด", targetPhonemes: ["r","ɒ","ŋ"], pairId: "e1-long", difficulty: 1 },
  { id: "e1-glass", errorIds: ["E1"], type: "word", prompt: "glass", promptThai: "แก้ว", targetPhonemes: ["ɡ","l","ɑː","s"], pairId: "e1-grass", difficulty: 2 },
  { id: "e1-grass", errorIds: ["E1"], type: "word", prompt: "grass", promptThai: "หญ้า", targetPhonemes: ["ɡ","r","ɑː","s"], pairId: "e1-glass", difficulty: 2 },
  { id: "e1-play", errorIds: ["E1"], type: "word", prompt: "play", promptThai: "เล่น", targetPhonemes: ["p","l","eɪ"], pairId: "e1-pray", difficulty: 2 },
  { id: "e1-pray", errorIds: ["E1"], type: "word", prompt: "pray", promptThai: "อธิษฐาน", targetPhonemes: ["p","r","eɪ"], pairId: "e1-play", difficulty: 2 },
  { id: "e1-flyfry", errorIds: ["E1"], type: "minimalpair", prompt: "fly / fry", promptThai: "บิน / ทอด", targetPhonemes: ["f","l","aɪ"], pairId: "e1-fry", difficulty: 2 },
  { id: "e1-fry", errorIds: ["E1"], type: "word", prompt: "fry", promptThai: "ทอด", targetPhonemes: ["f","r","aɪ"], pairId: "e1-flyfry", difficulty: 2 },
  // E2 clusters
  { id: "e2-drive", errorIds: ["E2"], type: "word", prompt: "drive", promptThai: "ขับรถ", targetPhonemes: ["d","r","aɪ","v"], difficulty: 2 },
  { id: "e2-smoke", errorIds: ["E2"], type: "word", prompt: "smoke", promptThai: "ควัน", targetPhonemes: ["s","m","əʊ","k"], difficulty: 2 },
  { id: "e2-school", errorIds: ["E2"], type: "word", prompt: "school", promptThai: "โรงเรียน", targetPhonemes: ["s","k","uː","l"], difficulty: 2 },
  { id: "e2-street", errorIds: ["E2"], type: "word", prompt: "street", promptThai: "ถนน", targetPhonemes: ["s","t","r","iː","t"], difficulty: 3 },
  // E3 final deletion
  { id: "e3-what", errorIds: ["E3"], type: "word", prompt: "what", promptThai: "อะไร", targetPhonemes: ["w","ɒ","t"], difficulty: 1 },
  { id: "e3-bag", errorIds: ["E3"], type: "word", prompt: "bag", promptThai: "กระเป๋า", targetPhonemes: ["b","æ","ɡ"], difficulty: 1 },
  { id: "e3-nicebag", errorIds: ["E3"], type: "sentence", prompt: "What a nice bag", promptThai: "กระเป๋าสวยจัง", targetPhonemes: ["w","ɒ","t","ə","n","aɪ","s","b","æ","ɡ"], difficulty: 2 },
  // E5 tʃ
  { id: "e5-church", errorIds: ["E5"], type: "word", prompt: "church", promptThai: "โบสถ์", targetPhonemes: ["tʃ","ɜː","tʃ"], difficulty: 2 },
  { id: "e5-chair", errorIds: ["E5"], type: "word", prompt: "chair", promptThai: "เก้าอี้", targetPhonemes: ["tʃ","eə"], difficulty: 1 },
  // E6 th
  { id: "e6-the", errorIds: ["E6"], type: "word", prompt: "the", promptThai: "คำนำหน้า", targetPhonemes: ["ð","ə"], difficulty: 1 },
  { id: "e6-three", errorIds: ["E6"], type: "word", prompt: "three", promptThai: "สาม", targetPhonemes: ["θ","r","iː"], difficulty: 2 },
  { id: "e6-think", errorIds: ["E6"], type: "word", prompt: "think", promptThai: "คิด", targetPhonemes: ["θ","ɪ","ŋ","k"], difficulty: 2 },
  // E8 v/w
  { id: "e8-very", errorIds: ["E8"], type: "word", prompt: "very", promptThai: "มาก", targetPhonemes: ["v","e","r","i"], difficulty: 1 },
  { id: "e8-river", errorIds: ["E8"], type: "word", prompt: "river", promptThai: "แม่น้ำ", targetPhonemes: ["r","ɪ","v","ə"], difficulty: 2 },
  // E10 əʊ
  { id: "e10-show", errorIds: ["E10"], type: "word", prompt: "show", promptThai: "แสดง", targetPhonemes: ["ʃ","əʊ"], difficulty: 2 },
  { id: "e10-go", errorIds: ["E10"], type: "word", prompt: "go", promptThai: "ไป", targetPhonemes: ["ɡ","əʊ"], difficulty: 1 },
  // E11 vowel length
  { id: "e11-sheepship", errorIds: ["E11"], type: "minimalpair", prompt: "sheep / ship", promptThai: "แกะ / เรือ", targetPhonemes: ["ʃ","iː","p"], pairId: "e11-ship", difficulty: 2 },
  { id: "e11-ship", errorIds: ["E11"], type: "word", prompt: "ship", promptThai: "เรือ", targetPhonemes: ["ʃ","ɪ","p"], pairId: "e11-sheepship", difficulty: 2 },
  // combined sentence drill
  { id: "sent-smoke-drive", errorIds: ["E2"], type: "sentence", prompt: "Smoking while driving isn't a crime", promptThai: "สูบบุหรี่ขณะขับรถไม่ใช่อาชญากรรม", targetPhonemes: ["s","m","əʊ","k","ɪ","ŋ","w","aɪ","l","d","r","aɪ","v","ɪ","ŋ","ɪ","z","ə","n","t","k","r","aɪ","m"], difficulty: 3 },

  // === EXPANDED EXERCISES ===
  // E1 l/r (additional drills)
  { id: "e1-lock", errorIds: ["E1"], type: "word", prompt: "lock", promptThai: "ล็อก", targetPhonemes: ["l","ɒ","k"], pairId: "e1-rock", difficulty: 1 },
  { id: "e1-rock", errorIds: ["E1"], type: "word", prompt: "rock", promptThai: "หิน", targetPhonemes: ["r","ɒ","k"], pairId: "e1-lock", difficulty: 1 },
  { id: "e1-lead", errorIds: ["E1"], type: "word", prompt: "lead", promptThai: "นำ", targetPhonemes: ["l","iː","d"], pairId: "e1-read", difficulty: 2 },
  { id: "e1-read", errorIds: ["E1"], type: "word", prompt: "read", promptThai: "อ่าน", targetPhonemes: ["r","iː","d"], pairId: "e1-lead", difficulty: 2 },
  { id: "e1-climb", errorIds: ["E1"], type: "word", prompt: "climb", promptThai: "ปีน", targetPhonemes: ["k","l","aɪ","m"], pairId: "e1-crime", difficulty: 2 },
  { id: "e1-crime", errorIds: ["E1"], type: "word", prompt: "crime", promptThai: "อาชญากรรม", targetPhonemes: ["k","r","aɪ","m"], pairId: "e1-climb", difficulty: 2 },
  { id: "e1-slow", errorIds: ["E1"], type: "word", prompt: "slow", promptThai: "ช้า", targetPhonemes: ["s","l","əʊ"], pairId: "e1-grow", difficulty: 2 },
  { id: "e1-grow", errorIds: ["E1"], type: "word", prompt: "grow", promptThai: "เติบโต", targetPhonemes: ["ɡ","r","əʊ"], pairId: "e1-slow", difficulty: 2 },
  { id: "e1-lockrock", errorIds: ["E1"], type: "minimalpair", prompt: "lock / rock", promptThai: "ล็อก / หิน", targetPhonemes: ["l","ɒ","k"], pairId: "e1-rock2", difficulty: 2 },
  { id: "e1-bluebrew", errorIds: ["E1"], type: "minimalpair", prompt: "blue / brew", promptThai: "สีฟ้า / ชง", targetPhonemes: ["b","l","uː"], pairId: "e1-brew", difficulty: 3 },

  // E2 clusters (additional)
  { id: "e2-scream", errorIds: ["E2"], type: "word", prompt: "scream", promptThai: "กรีดร้อง", targetPhonemes: ["s","k","r","iː","m"], difficulty: 3 },
  { id: "e2-screen", errorIds: ["E2"], type: "word", prompt: "screen", promptThai: "จอ", targetPhonemes: ["s","k","r","iː","n"], difficulty: 3 },
  { id: "e2-spring", errorIds: ["E2"], type: "word", prompt: "spring", promptThai: "ฤดูใบไม้ผลิ", targetPhonemes: ["s","p","r","ɪ","ŋ"], difficulty: 3 },
  { id: "e2-string", errorIds: ["E2"], type: "word", prompt: "string", promptThai: "เชือก", targetPhonemes: ["s","t","r","ɪ","ŋ"], difficulty: 3 },
  { id: "e2-sweet", errorIds: ["E2"], type: "word", prompt: "sweet", promptThai: "หวาน", targetPhonemes: ["s","w","iː","t"], difficulty: 2 },

  // E3 final deletion (additional)
  { id: "e3-cat", errorIds: ["E3"], type: "word", prompt: "cat", promptThai: "แมว", targetPhonemes: ["k","æ","t"], difficulty: 1 },
  { id: "e3-dog", errorIds: ["E3"], type: "word", prompt: "dog", promptThai: "หมา", targetPhonemes: ["d","ɒ","ɡ"], difficulty: 1 },
  { id: "e3-book", errorIds: ["E3"], type: "word", prompt: "book", promptThai: "หนังสือ", targetPhonemes: ["b","ʊ","k"], difficulty: 1 },
  { id: "e3-clock", errorIds: ["E3"], type: "word", prompt: "clock", promptThai: "นาฬิกา", targetPhonemes: ["k","l","ɒ","k"], difficulty: 2 },
  { id: "e3-lamp", errorIds: ["E3"], type: "word", prompt: "lamp", promptThai: "โคมไฟ", targetPhonemes: ["l","æ","m","p"], difficulty: 2 },
  { id: "e3-cup", errorIds: ["E3"], type: "word", prompt: "cup", promptThai: "ถ้วย", targetPhonemes: ["k","ʌ","p"], difficulty: 1 },
  { id: "e3-map", errorIds: ["E3"], type: "word", prompt: "map", promptThai: "แผนที่", targetPhonemes: ["m","æ","p"], difficulty: 1 },
  { id: "e3-gooddog", errorIds: ["E3"], type: "sentence", prompt: "I have a good dog", promptThai: "ฉันมีหมาน่ารัก", targetPhonemes: ["aɪ","h","æ","v","ə","ɡ","ʊ","d","d","ɒ","ɡ"], difficulty: 2 },

  // E4 final cluster
  { id: "e4-asked", errorIds: ["E4"], type: "word", prompt: "asked", promptThai: "ถูกถาม", targetPhonemes: ["ɑː","s","k","t"], difficulty: 2 },
  { id: "e4-best", errorIds: ["E4"], type: "word", prompt: "best", promptThai: "ดีที่สุด", targetPhonemes: ["b","e","s","t"], difficulty: 1 },
  { id: "e4-last", errorIds: ["E4"], type: "word", prompt: "last", promptThai: "ล่าสุด", targetPhonemes: ["l","ɑː","s","t"], difficulty: 1 },
  { id: "e4-must", errorIds: ["E4"], type: "word", prompt: "must", promptThai: "ต้อง", targetPhonemes: ["m","ʌ","s","t"], difficulty: 2 },
  { id: "e4-fact", errorIds: ["E4"], type: "word", prompt: "fact", promptThai: "ข้อเท็จจริง", targetPhonemes: ["f","æ","k","t"], difficulty: 2 },
  { id: "e4-next", errorIds: ["E4"], type: "word", prompt: "next", promptThai: "ถัดไป", targetPhonemes: ["n","e","k","s","t"], difficulty: 2 },
  { id: "e4-world", errorIds: ["E4"], type: "word", prompt: "world", promptThai: "โลก", targetPhonemes: ["w","ɜː","l","d"], difficulty: 3 },
  { id: "e4-hold", errorIds: ["E4"], type: "word", prompt: "hold", promptThai: "จับ", targetPhonemes: ["h","əʊ","l","d"], difficulty: 2 },
  { id: "e4-hand", errorIds: ["E4"], type: "word", prompt: "hand", promptThai: "มือ", targetPhonemes: ["h","æ","n","d"], difficulty: 2 },
  { id: "e4-stand", errorIds: ["E4"], type: "word", prompt: "stand", promptThai: "ยืน", targetPhonemes: ["s","t","æ","n","d"], difficulty: 3 },

  // E5 tʃ (additional)
  { id: "e5-cheese", errorIds: ["E5"], type: "word", prompt: "cheese", promptThai: "ชีส", targetPhonemes: ["tʃ","iː","z"], difficulty: 1 },
  { id: "e5-chime", errorIds: ["E5"], type: "word", prompt: "chime", promptThai: "เสียงกระดิ่ง", targetPhonemes: ["tʃ","aɪ","m"], difficulty: 2 },
  { id: "e5-watch", errorIds: ["E5"], type: "word", prompt: "watch", promptThai: "ดู", targetPhonemes: ["w","ɒ","tʃ"], difficulty: 2 },
  { id: "e5-catch", errorIds: ["E5"], type: "word", prompt: "catch", promptThai: "จับ", targetPhonemes: ["k","æ","tʃ"], difficulty: 2 },
  { id: "e5-kitchen", errorIds: ["E5"], type: "word", prompt: "kitchen", promptThai: "ครัว", targetPhonemes: ["ˈ","k","ɪ","tʃ","ɪ","n"], difficulty: 3 },
  { id: "e5-chipship", errorIds: ["E5"], type: "minimalpair", prompt: "chip / ship", promptThai: "ชิป / เรือ", targetPhonemes: ["tʃ","ɪ","p"], pairId: "e5-ship2", difficulty: 2 },
  { id: "e5-cheapsheep", errorIds: ["E5"], type: "minimalpair", prompt: "cheap / sheep", promptThai: "ถูก / แกะ", targetPhonemes: ["tʃ","iː","p"], pairId: "e5-sheep2", difficulty: 2 },

  // E6 th (additional)
  { id: "e6-bath", errorIds: ["E6"], type: "word", prompt: "bath", promptThai: "อาบน้ำ", targetPhonemes: ["b","ɑː","θ"], difficulty: 2 },
  { id: "e6-both", errorIds: ["E6"], type: "word", prompt: "both", promptThai: "ทั้งคู่", targetPhonemes: ["b","əʊ","θ"], difficulty: 2 },
  { id: "e6-month", errorIds: ["E6"], type: "word", prompt: "month", promptThai: "เดือน", targetPhonemes: ["m","ʌ","n","θ"], difficulty: 2 },
  { id: "e6-thumb", errorIds: ["E6"], type: "word", prompt: "thumb", promptThai: "นิ้วหัวแม่มือ", targetPhonemes: ["θ","ʌ","m"], difficulty: 2 },
  { id: "e6-through", errorIds: ["E6"], type: "word", prompt: "through", promptThai: "ผ่าน", targetPhonemes: ["θ","r","uː"], difficulty: 3 },
  { id: "e6-birthday", errorIds: ["E6"], type: "word", prompt: "birthday", promptThai: "วันเกิด", targetPhonemes: ["ˈ","b","ɜː","θ","d","eɪ"], difficulty: 3 },
  { id: "e6-thank", errorIds: ["E6"], type: "word", prompt: "thank", promptThai: "ขอบคุณ", targetPhonemes: ["θ","æ","ŋ","k"], difficulty: 2 },
  { id: "e6-truth", errorIds: ["E6"], type: "word", prompt: "truth", promptThai: "ความจริง", targetPhonemes: ["t","r","uː","θ"], difficulty: 3 },

  // E7 ʃ
  { id: "e7-shoe", errorIds: ["E7"], type: "word", prompt: "shoe", promptThai: "รองเท้า", targetPhonemes: ["ʃ","uː"], difficulty: 1 },
  { id: "e7-wash", errorIds: ["E7"], type: "word", prompt: "wash", promptThai: "ล้าง", targetPhonemes: ["w","ɒ","ʃ"], difficulty: 2 },
  { id: "e7-sugar", errorIds: ["E7"], type: "word", prompt: "sugar", promptThai: "น้ำตาล", targetPhonemes: ["ˈ","ʃ","ʊ","ɡ","ə"], difficulty: 2 },
  { id: "e7-ocean", errorIds: ["E7"], type: "word", prompt: "ocean", promptThai: "มหาสมุทร", targetPhonemes: ["ˈ","əʊ","ʃ","ə","n"], difficulty: 3 },
  { id: "e7-washwatch", errorIds: ["E7"], type: "minimalpair", prompt: "wash / watch", promptThai: "ล้าง / ดู", targetPhonemes: ["w","ɒ","ʃ"], pairId: "e7-watch2", difficulty: 2 },

  // E8 v/w (additional)
  { id: "e8-vest", errorIds: ["E8"], type: "word", prompt: "vest", promptThai: "เสื้อกั๊ก", targetPhonemes: ["v","e","s","t"], pairId: "e8-west", difficulty: 2 },
  { id: "e8-west", errorIds: ["E8"], type: "word", prompt: "west", promptThai: "ตะวันตก", targetPhonemes: ["w","e","s","t"], pairId: "e8-vest", difficulty: 2 },
  { id: "e8-vet", errorIds: ["E8"], type: "word", prompt: "vet", promptThai: "สัตวแพทย์", targetPhonemes: ["v","e","t"], pairId: "e8-wet", difficulty: 1 },
  { id: "e8-wet", errorIds: ["E8"], type: "word", prompt: "wet", promptThai: "เปียก", targetPhonemes: ["w","e","t"], pairId: "e8-vet", difficulty: 1 },
  { id: "e8-wine", errorIds: ["E8"], type: "word", prompt: "wine", promptThai: "ไวน์", targetPhonemes: ["w","aɪ","n"], pairId: "e8-vine", difficulty: 2 },
  { id: "e8-vine", errorIds: ["E8"], type: "word", prompt: "vine", promptThai: "เถาวัลย์", targetPhonemes: ["v","aɪ","n"], pairId: "e8-wine", difficulty: 2 },
  { id: "e8-voice", errorIds: ["E8"], type: "word", prompt: "voice", promptThai: "เสียง", targetPhonemes: ["v","ɔɪ","s"], difficulty: 2 },
  { id: "e8-vote", errorIds: ["E8"], type: "word", prompt: "vote", promptThai: "โหวต", targetPhonemes: ["v","əʊ","t"], difficulty: 2 },
  { id: "e8-vestwest", errorIds: ["E8"], type: "minimalpair", prompt: "vest / west", promptThai: "เสื้อกั๊ก / ตะวันตก", targetPhonemes: ["v","e","s","t"], pairId: "e8-west2", difficulty: 2 },

  // E9 final z
  { id: "e9-boys", errorIds: ["E9"], type: "word", prompt: "boys", promptThai: "เด็กผู้ชาย", targetPhonemes: ["b","ɔɪ","z"], difficulty: 1 },
  { id: "e9-dogs", errorIds: ["E9"], type: "word", prompt: "dogs", promptThai: "หมา", targetPhonemes: ["d","ɒ","ɡ","z"], difficulty: 2 },
  { id: "e9-cars", errorIds: ["E9"], type: "word", prompt: "cars", promptThai: "รถยนต์", targetPhonemes: ["k","ɑː","z"], difficulty: 2 },
  { id: "e9-goes", errorIds: ["E9"], type: "word", prompt: "goes", promptThai: "ไป", targetPhonemes: ["ɡ","əʊ","z"], difficulty: 2 },
  { id: "e9-plays", errorIds: ["E9"], type: "word", prompt: "plays", promptThai: "เล่น", targetPhonemes: ["p","l","eɪ","z"], difficulty: 2 },
  { id: "e9-shoes", errorIds: ["E9"], type: "word", prompt: "shoes", promptThai: "รองเท้า", targetPhonemes: ["ʃ","uː","z"], difficulty: 2 },
  { id: "e9-eyes", errorIds: ["E9"], type: "word", prompt: "eyes", promptThai: "ตา", targetPhonemes: ["aɪ","z"], difficulty: 1 },

  // E10 əʊ (additional)
  { id: "e10-phone", errorIds: ["E10"], type: "word", prompt: "phone", promptThai: "โทรศัพท์", targetPhonemes: ["f","əʊ","n"], difficulty: 2 },
  { id: "e10-home", errorIds: ["E10"], type: "word", prompt: "home", promptThai: "บ้าน", targetPhonemes: ["h","əʊ","m"], difficulty: 1 },
  { id: "e10-road", errorIds: ["E10"], type: "word", prompt: "road", promptThai: "ถนน", targetPhonemes: ["r","əʊ","d"], difficulty: 2 },
  { id: "e10-hope", errorIds: ["E10"], type: "word", prompt: "hope", promptThai: "หวัง", targetPhonemes: ["h","əʊ","p"], difficulty: 2 },
  { id: "e10-boat", errorIds: ["E10"], type: "word", prompt: "boat", promptThai: "เรือ", targetPhonemes: ["b","əʊ","t"], difficulty: 2 },
  { id: "e10-stone", errorIds: ["E10"], type: "word", prompt: "stone", promptThai: "หิน", targetPhonemes: ["s","t","əʊ","n"], difficulty: 3 },

  // E11 vowel length (additional)
  { id: "e11-feetfit", errorIds: ["E11"], type: "minimalpair", prompt: "feet / fit", promptThai: "เท้า / เหมาะ", targetPhonemes: ["f","iː","t"], pairId: "e11-fit", difficulty: 2 },
  { id: "e11-fit", errorIds: ["E11"], type: "word", prompt: "fit", promptThai: "เหมาะ", targetPhonemes: ["f","ɪ","t"], pairId: "e11-feetfit", difficulty: 2 },
  { id: "e11-foodgood", errorIds: ["E11"], type: "minimalpair", prompt: "food / good", promptThai: "อาหาร / ดี", targetPhonemes: ["f","uː","d"], pairId: "e11-good", difficulty: 2 },
  { id: "e11-seatsit", errorIds: ["E11"], type: "minimalpair", prompt: "seat / sit", promptThai: "ที่นั่ง / นั่ง", targetPhonemes: ["s","iː","t"], pairId: "e11-sit", difficulty: 2 },
  { id: "e11-pullpool", errorIds: ["E11"], type: "minimalpair", prompt: "pull / pool", promptThai: "ดึง / สระ", targetPhonemes: ["p","ʊ","l"], pairId: "e11-pool", difficulty: 3 },

  // E12 nasalized vowels
  { id: "e12-man", errorIds: ["E12"], type: "word", prompt: "man", promptThai: "ผู้ชาย", targetPhonemes: ["m","æ","n"], difficulty: 1 },
  { id: "e12-sand", errorIds: ["E12"], type: "word", prompt: "sand", promptThai: "ทราย", targetPhonemes: ["s","æ","n","d"], difficulty: 2 },
  { id: "e12-bank", errorIds: ["E12"], type: "word", prompt: "bank", promptThai: "ธนาคาร", targetPhonemes: ["b","æ","ŋ","k"], difficulty: 2 },
  { id: "e12-song", errorIds: ["E12"], type: "word", prompt: "song", promptThai: "เพลง", targetPhonemes: ["s","ɒ","ŋ"], difficulty: 2 },
  { id: "e12-sing", errorIds: ["E12"], type: "word", prompt: "sing", promptThai: "ร้องเพลง", targetPhonemes: ["s","ɪ","ŋ"], difficulty: 2 },
  { id: "e12-morning", errorIds: ["E12"], type: "word", prompt: "morning", promptThai: "ตอนเช้า", targetPhonemes: ["ˈ","m","ɔː","n","ɪ","ŋ"], difficulty: 3 },
  { id: "e12-thing", errorIds: ["E12"], type: "word", prompt: "thing", promptThai: "สิ่งของ", targetPhonemes: ["θ","ɪ","ŋ"], difficulty: 2 },

  // E13 word stress
  { id: "e13-record", errorIds: ["E13"], type: "word", prompt: "record (noun)", promptThai: "บันทึก (คำนาม)", targetPhonemes: ["ˈ","r","e","k","ɔː","d"], difficulty: 3 },
  { id: "e13-present", errorIds: ["E13"], type: "word", prompt: "present (noun)", promptThai: "ของขวัญ (คำนาม)", targetPhonemes: ["ˈ","p","r","e","z","ə","n","t"], difficulty: 3 },
  { id: "e13-object", errorIds: ["E13"], type: "word", prompt: "object (noun)", promptThai: "วัตถุ (คำนาม)", targetPhonemes: ["ˈ","ɒ","b","dʒ","ɪ","k","t"], difficulty: 3 },
  { id: "e13-photo", errorIds: ["E13"], type: "word", prompt: "photograph", promptThai: "ภาพถ่าย", targetPhonemes: ["ˈ","f","əʊ","t","ə","ɡ","r","ɑː","f"], difficulty: 3 },

  // E14 weak forms
  { id: "e14-can", errorIds: ["E14"], type: "word", prompt: "can", promptThai: "สามารถ", targetPhonemes: ["k","ə","n"], difficulty: 2 },
  { id: "e14-of", errorIds: ["E14"], type: "word", prompt: "of", promptThai: "ของ", targetPhonemes: ["ə","v"], difficulty: 1 },
  { id: "e14-to", errorIds: ["E14"], type: "word", prompt: "to", promptThai: "ถึง", targetPhonemes: ["t","ə"], difficulty: 1 },
  { id: "e14-from", errorIds: ["E14"], type: "word", prompt: "from", promptThai: "จาก", targetPhonemes: ["f","r","ə","m"], difficulty: 2 },
  { id: "e14-for", errorIds: ["E14"], type: "word", prompt: "for", promptThai: "สำหรับ", targetPhonemes: ["f","ə"], difficulty: 1 },
  { id: "e14-sentence", errorIds: ["E14"], type: "sentence", prompt: "I can see a cup of tea", promptThai: "ฉันเห็นถ้วยชา", targetPhonemes: ["aɪ","k","ə","n","s","iː","ə","k","ʌ","p","ə","v","t","iː"], difficulty: 3 },

  // E15 syllable timing
  { id: "e15-beautiful", errorIds: ["E15"], type: "word", prompt: "beautiful", promptThai: "สวยงาม", targetPhonemes: ["ˈ","b","juː","t","ɪ","f","ə","l"], difficulty: 3 },
  { id: "e15-computer", errorIds: ["E15"], type: "word", prompt: "computer", promptThai: "คอมพิวเตอร์", targetPhonemes: ["k","ə","m","ˈ","p","juː","t","ə"], difficulty: 3 },
  { id: "e15-yesterday", errorIds: ["E15"], type: "word", prompt: "yesterday", promptThai: "เมื่อวาน", targetPhonemes: ["ˈ","j","e","s","t","ə","d","eɪ"], difficulty: 3 },
  { id: "e15-family", errorIds: ["E15"], type: "word", prompt: "family", promptThai: "ครอบครัว", targetPhonemes: ["ˈ","f","æ","m","ə","l","i"], difficulty: 2 },
  { id: "e15-interesting", errorIds: ["E15"], type: "word", prompt: "interesting", promptThai: "น่าสนใจ", targetPhonemes: ["ˈ","ɪ","n","t","r","ə","s","t","ɪ","ŋ"], difficulty: 3 },
  { id: "e15-comfortable", errorIds: ["E15"], type: "word", prompt: "comfortable", promptThai: "สบาย", targetPhonemes: ["ˈ","k","ʌ","m","f","t","ə","b","ə","l"], difficulty: 3 },
  { id: "e15-vegetable", errorIds: ["E15"], type: "word", prompt: "vegetable", promptThai: "ผัก", targetPhonemes: ["ˈ","v","e","dʒ","t","ə","b","ə","l"], difficulty: 3 },

  // === Sentence drills: L/R-heavy + common Thai mix-ups ===
  // Longer sentences give Whisper more context (fewer hallucinations)
  // and train real-world pronunciation in connected speech.
  { id: "sent-red-light", errorIds: ["E1","E3"], type: "sentence", prompt: "The red light is on the right", promptThai: "ไฟแดงอยู่ทางขวา", targetPhonemes: ["ð","ə","r","e","d","l","aɪ","t","ɪ","z","ɒ","n","ð","ə","r","aɪ","t"], difficulty: 2 },
  { id: "sent-play-record", errorIds: ["E1","E2"], type: "sentence", prompt: "Please play the record on the long table", promptThai: "ช่วยเล่นแผ่นเสียงบนโต๊ะยาวด้วย", targetPhonemes: ["p","l","iː","z","p","l","eɪ","ð","ə","ˈ","r","e","k","ɔː","d","ɒ","n","ð","ə","l","ɒ","ŋ","ˈ","t","eɪ","b","ə","l"], difficulty: 3 },
  { id: "sent-river-flows", errorIds: ["E1","E2","E6"], type: "sentence", prompt: "The blue river flows slowly through the grass", promptThai: "แม่น้ำสีฟ้าไหลผ่านหญ้าช้าๆ", targetPhonemes: ["ð","ə","b","l","uː","ˈ","r","ɪ","v","ə","f","l","əʊ","z","ˈ","s","l","əʊ","l","i","θ","r","uː","ð","ə","ɡ","r","ɑː","s"], difficulty: 3 },
  { id: "sent-fried-rice", errorIds: ["E1","E2"], type: "sentence", prompt: "I really like fried rice and fresh milk", promptThai: "ฉันชอบข้าวผัดและนมสดจริงๆ", targetPhonemes: ["aɪ","ˈ","r","iː","ə","l","i","l","aɪ","k","f","r","aɪ","d","r","aɪ","s","æ","n","d","f","r","e","ʃ","m","ɪ","l","k"], difficulty: 2 },
  { id: "sent-blue-flowers", errorIds: ["E1","E2"], type: "sentence", prompt: "The little girl picked blue flowers in spring", promptThai: "เด็กหญิงตัวน้อยเด็ดดอกไม้สีฟ้าในฤดูใบไม้ผลิ", targetPhonemes: ["ð","ə","ˈ","l","ɪ","t","ə","l","ɡ","ɜː","l","p","ɪ","k","t","b","l","uː","ˈ","f","l","aʊ","ə","z","ɪ","n","s","p","r","ɪ","ŋ"], difficulty: 3 },
  { id: "sent-brother-drives", errorIds: ["E1","E2","E8"], type: "sentence", prompt: "My brother drives to school every morning", promptThai: "พี่ชายขับรถไปโรงเรียนทุกเช้า", targetPhonemes: ["m","aɪ","ˈ","b","r","ʌ","ð","ə","d","r","aɪ","v","z","t","ə","s","k","uː","l","ˈ","e","v","r","i","ˈ","m","ɔː","n","ɪ","ŋ"], difficulty: 3 },
  { id: "sent-weather-cold", errorIds: ["E8","E10"], type: "sentence", prompt: "The weather is very cold in winter", promptThai: "อากาศหนาวมากในฤดูหนาว", targetPhonemes: ["ð","ə","ˈ","w","e","ð","ə","ɪ","z","ˈ","v","e","r","i","k","əʊ","l","d","ɪ","n","ˈ","w","ɪ","n","t","ə"], difficulty: 2 },
  { id: "sent-glass-water", errorIds: ["E1","E3"], type: "sentence", prompt: "Please bring me a glass of cold water", promptThai: "ช่วยเอาน้ำเย็นมาให้หน่อย", targetPhonemes: ["p","l","iː","z","b","r","ɪ","ŋ","m","iː","ə","ɡ","l","ɑː","s","ə","v","k","əʊ","l","d","ˈ","w","ɒ","t","ə"], difficulty: 2 },
  { id: "sent-clown-threw", errorIds: ["E1","E2","E6"], type: "sentence", prompt: "The clown threw a blue ball to the crowd", promptThai: "ตัวตลกขว้างลูกบอลสีฟ้าให้ฝูงชน", targetPhonemes: ["ð","ə","k","l","aʊ","n","θ","r","uː","ə","b","l","uː","b","ɔː","l","t","ə","ð","ə","k","r","aʊ","d"], difficulty: 3 },
  { id: "sent-three-children", errorIds: ["E1","E2","E6"], type: "sentence", prompt: "I think three children are playing in the street", promptThai: "ฉันคิดว่ามีเด็กสามคนกำลังเล่นอยู่บนถนน", targetPhonemes: ["aɪ","θ","ɪ","ŋ","k","θ","r","iː","ˈ","tʃ","ɪ","l","d","r","ə","n","ɑː","ˈ","p","l","eɪ","ɪ","ŋ","ɪ","n","ð","ə","s","t","r","iː","t"], difficulty: 3 },
  { id: "sent-small-dog", errorIds: ["E1","E2"], type: "sentence", prompt: "The small dog ran through the long grass", promptThai: "หมาตัวเล็กวิ่งผ่านหญ้ายาว", targetPhonemes: ["ð","ə","s","m","ɔː","l","d","ɒ","ɡ","r","æ","n","θ","r","uː","ð","ə","l","ɒ","ŋ","ɡ","r","ɑː","s"], difficulty: 2 },
  { id: "sent-blond-hair", errorIds: ["E1"], type: "sentence", prompt: "She has long blond hair and blue eyes", promptThai: "เธอมีผมยาวสีบลอนด์และตาสีฟ้า", targetPhonemes: ["ʃ","iː","h","æ","z","l","ɒ","ŋ","b","l","ɒ","n","d","h","eə","æ","n","d","b","l","uː","aɪ","z"], difficulty: 2 },
  { id: "sent-train-late", errorIds: ["E1","E2"], type: "sentence", prompt: "The train is late because of the rain", promptThai: "รถไฟมาสายเพราะฝนตก", targetPhonemes: ["ð","ə","t","r","eɪ","n","ɪ","z","l","eɪ","t","b","ɪ","ˈ","k","ɒ","z","ə","v","ð","ə","r","eɪ","n"], difficulty: 2 },
  { id: "sent-correct-spelling", errorIds: ["E1"], type: "sentence", prompt: "Please correct the spelling on the board", promptThai: "ช่วยแก้การสะกดคำบนกระดานด้วย", targetPhonemes: ["p","l","iː","z","k","ə","ˈ","r","e","k","t","ð","ə","ˈ","s","p","e","l","ɪ","ŋ","ɒ","n","ð","ə","b","ɔː","d"], difficulty: 3 },
  { id: "sent-friend-prefers", errorIds: ["E1","E8","E10"], type: "sentence", prompt: "My friend prefers tea to coffee in the morning", promptThai: "เพื่อนของฉันชอบชามากกว่ากาแฟในตอนเช้า", targetPhonemes: ["m","aɪ","f","r","e","n","d","p","r","ɪ","ˈ","f","ɜː","z","t","iː","t","ə","ˈ","k","ɒ","f","i","ɪ","n","ð","ə","ˈ","m","ɔː","n","ɪ","ŋ"], difficulty: 3 },
];

export function exercisesByError(eid: ErrorId): Exercise[] {
  return EXERCISES.filter((e) => e.errorIds.includes(eid));
}

/** Check if an exercise is purely suprasegmental (E12/E13/E15 — not detectable
 *  from phonemes alone). These show a coach note instead of a score. */
export function isSuprasegmentalOnly(exercise: Exercise): boolean {
  return exercise.errorIds.length > 0 && exercise.errorIds.every(
    (eid) => !ERROR_CATEGORIES[eid]?.segmental
  );
}

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}
