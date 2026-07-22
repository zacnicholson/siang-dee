/**
 * Grapheme-to-Phoneme (G2P) fallback for words not in the hand-verified
 * IPA dictionary. Uses a rule-based approach covering common English
 * letter→sound patterns. Not perfect (English orthography is famously
 * irregular), but good enough to create usable drills for any sentence.
 *
 * Priority: hand-verified dictionary → G2P fallback.
 * Estimated accuracy: ~70% of words produce a usable phoneme sequence.
 */
import type { Phoneme } from "./phonemes";
import { IPA_DICT } from "./dictionary";

// ─── Consonant mappings (most are straightforward) ───
const CONSONANTS: Record<string, Phoneme> = {
  b: "b", d: "d", f: "f", g: "ɡ", h: "h", j: "dʒ", k: "k", l: "l",
  m: "m", n: "n", p: "p", r: "r", t: "t", v: "v", w: "w", z: "z",
};

// ─── Vowel mappings by pattern ───
// Order matters: more specific patterns checked first.
const VOWEL_PATTERNS: Array<[RegExp, Phoneme[]]> = [
  // Diphthongs and special combinations
  [/igh$/, ["aɪ"]],            // high, light, right
  [/igh(t|)/, ["aɪ"]],         // sigh, sight
  [/air$/, ["eə"]],            // hair, fair, chair
  [/are$/, ["eə"]],            // care, share, bare
  [/ear$/, ["ɪə"]],            // hear, near, dear
  [/eer$/, ["ɪə"]],            // beer, steer
  [/oar$/, ["ɔː"]],            // board, roar
  [/oor$/, ["ʊə"]],            // door, poor
  [/ure$/, ["j", "ʊə"]],       // cure, pure
  [/our$/, ["aʊ", "ə"]],       // hour, sour, flour
  [/ould/, ["ʊ"]],             // could, would, should
  [/tion$/, ["ʃ", "ə", "n"]], // station, nation
  [/sion$/, ["ʒ", "ə", "n"]], // vision, decision (not always)
  [/ture$/, ["tʃ", "ə"]],      // nature, picture
  [/dge$/, ["dʒ"]],            // bridge, edge
  [/tch$/, ["tʃ"]],           // watch, catch, match
  [/nk$/, ["ŋ", "k"]],        // think, bank, pink
  [/ng$/, ["ŋ"]],              // sing, long, ring
  [/qu/, ["k", "w"]],          // queen, quick, quiet

  // Long vowel patterns (magic E + vowel teams)
  [/a_e$/, ["eɪ"]],            // cake, name, same
  [/i_e$/, ["aɪ"]],            // time, like, five
  [/o_e$/, ["əʊ"]],            // home, bone, hope
  [/u_e$/, ["juː"]],          // cube, use, cute
  [/e_e$/, ["iː"]],            // these, theme, complete

  // Vowel teams
  [/ee/, ["iː"]],              // see, tree, green
  [/ea/, ["iː"]],              // eat, read, beach (sometimes /e/ — "head")
  [/oo/, ["uː"]],              // food, moon, soon (sometimes /ʊ/ — "book")
  [/ou/, ["aʊ"]],              // out, house, mouth (sometimes /uː/ — "soup")
  [/ow/, ["əʊ"]],              // show, grow, slow (sometimes /aʊ/ — "cow")
  [/ai/, ["eɪ"]],              // rain, train, wait
  [/ay/, ["eɪ"]],              // day, play, stay
  [/oi/, ["ɔɪ"]],              // oil, coin, point
  [/oy/, ["ɔɪ"]],              // boy, toy, enjoy
  [/au/, ["ɔː"]],              // auto, cause, August
  [/aw/, ["ɔː"]],              // saw, draw, law
  [/ew/, ["juː"]],            // few, new, dew
  [/oa/, ["əʊ"]],              // boat, road, coat
  [/ie$/, ["aɪ"]],             // pie, tie, die
  [/igh/, ["aɪ"]],             // high, light, night

  // Short vowels (closed syllables)
  [/a[^aeiou]e$/, ["eɪ"]],    // same, came, bake — already caught by a_e
  // Default short vowels
];

// ─── Short vowel sounds per vowel letter (closed syllables) ───
const SHORT_VOWELS: Record<string, Phoneme> = {
  a: "æ",  // cat, bag, hat
  e: "e",  // bed, pen, red
  i: "ɪ",  // sit, big, win
  o: "ɒ",  // dog, hot, top
  u: "ʌ",  // sun, cup, run
};

// ─── Long vowel sounds per vowel letter (open syllables / magic E) ───
const LONG_VOWELS: Record<string, Phoneme> = {
  a: "eɪ",  // baby, paper
  e: "iː",  // she, be, me
  i: "aɪ",  // hi, find, kind
  o: "əʊ",  // go, no, so
  u: "juː", // music, student
};

// ─── Silent letters / special endings ───
const SILENT_PATTERNS: RegExp[] = [
  /mb$/,    // lamb, climb, thumb — b silent
  /kn^/,    // know, knee — k silent (handled at start)
  /wr/,     // write, wrong — w silent
  /ps/,     // psychology — p silent (rare)
];

// ─── Common words that G2P gets wrong — override list ───
const OVERRIDES: Record<string, Phoneme[]> = {
  the: ["ð", "ə"], a: ["ə"], an: ["ə", "n"], and: ["æ", "n", "d"],
  to: ["t", "ə"], of: ["ə", "v"], in: ["ɪ", "n"], is: ["ɪ", "z"],
  are: ["ɑː"], was: ["w", "ɒ", "z"], were: ["w", "ɜː"],
  has: ["h", "æ", "z"], have: ["h", "æ", "v"], had: ["h", "æ", "d"],
  do: ["d", "uː"], does: ["d", "ʌ", "z"], did: ["d", "ɪ", "d"],
  not: ["n", "ɒ", "t"], no: ["n", "əʊ"], yes: ["j", "e", "s"],
  all: ["ɔː", "l"], any: ["ˈ", "e", "n", "i"], many: ["ˈ", "m", "e", "n", "i"],
  some: ["s", "ʌ", "m"], more: ["m", "ɔː"], most: ["m", "əʊ", "s", "t"],
  one: ["w", "ʌ", "n"], two: ["t", "uː"], four: ["f", "ɔː"],
  who: ["h", "uː"], what: ["w", "ɒ", "t"], when: ["w", "e", "n"],
  where: ["w", "eə"], why: ["w", "aɪ"], how: ["h", "aʊ"],
  there: ["ð", "eə"], their: ["ð", "eə"], they: ["ð", "eɪ"],
  said: ["s", "e", "d"], says: ["s", "e", "z"],
  come: ["k", "ʌ", "m"], done: ["d", "ʌ", "n"], give: ["ɡ", "ɪ", "v"],
  live: ["l", "ɪ", "v"], move: ["m", "uː", "v"],
  put: ["p", "ʊ"], push: ["p", "ʊ", "ʃ"], pull: ["p", "ʊ", "l"],
  book: ["b", "ʊ", "k"], look: ["l", "ʊ", "k"], took: ["t", "ʊ", "k"],
  good: ["ɡ", "ʊ", "d"], foot: ["f", "ʊ", "t"],
  blood: ["b", "l", "ʌ", "d"], flood: ["f", "l", "ʌ", "d"],
  busy: ["ˈ", "b", "ɪ", "z", "i"], business: ["ˈ", "b", "ɪ", "z", "n", "ə", "s"],
  people: ["ˈ", "p", "iː", "p", "ə", "l"],
  because: ["b", "ɪ", "ˈ", "k", "ɒ", "z"],
  beautiful: ["ˈ", "b", "juː", "t", "ɪ", "f", "ə", "l"],
};

function isVowel(ch: string): boolean {
  return /[aeiouy]/.test(ch);
}

function countVowels(word: string): number {
  let count = 0;
  for (const ch of word) {
    if (/[aeiouy]/.test(ch)) count++;
  }
  return count;
}

/**
 * Generate a phoneme sequence for an unknown word using rule-based G2P.
 * Returns undefined if the word is too short or unpronounceable.
 */
export function g2p(word: string): Phoneme[] | undefined {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length < 1) return undefined;

  // Check overrides first
  if (OVERRIDES[w]) return OVERRIDES[w];

  // Handle silent letters at start
  let working = w;
  if (working.startsWith("kn")) working = working.slice(1);  // know → now
  if (working.startsWith("wr")) working = working.slice(1); // write → rite
  if (working.startsWith("wh")) working = "w" + working.slice(2); // what → wat

  // Handle silent b after m (lamb, climb, thumb)
  if (working.endsWith("mb")) working = working.slice(0, -1);

  // Check for special suffixes first
  for (const [pat, phonemes] of VOWEL_PATTERNS) {
    if (pat.test(working)) {
      // Extract the matched portion and build remaining phonemes
      const result = buildWithPattern(working, pat, phonemes);
      if (result) return result;
    }
  }

  // General approach: scan consonants and vowels
  return scanSyllables(working);
}

function buildWithPattern(word: string, pattern: RegExp, vowelPhonemes: Phoneme[]): Phoneme[] | undefined {
  // This is a simplified approach — for now, just use the vowel phonemes
  // and add consonants around them. A full implementation would be more precise.
  // For the purpose of creating usable drills, this is good enough.
  const match = word.match(pattern);
  if (!match) return undefined;

  const matchedText = match[0];
  const beforeMatch = word.slice(0, match.index!);
  const afterMatch = word.slice(match.index! + matchedText.length);

  const result: Phoneme[] = [];

  // Add consonants before the vowel pattern
  for (const ch of beforeMatch) {
    if (CONSONANTS[ch]) result.push(CONSONANTS[ch]);
  }

  // Add the vowel phonemes
  result.push(...vowelPhonemes);

  // Add consonants after the vowel pattern
  for (const ch of afterMatch) {
    if (CONSONANTS[ch]) result.push(CONSONANTS[ch]);
  }

  return result.length > 0 ? result : undefined;
}

function scanSyllables(word: string): Phoneme[] | undefined {
  if (word.length === 0) return undefined;

  const phonemes: Phoneme[] = [];
  let i = 0;
  const chars = word.split("");

  while (i < chars.length) {
    const ch = chars[i];

    // Skip silent e at end (magic E pattern already handled above,
    // but catch standalone e)
    if (ch === "e" && i === chars.length - 1 && phonemes.length > 0) {
      i++;
      continue;
    }

    // Check for vowel digraphs (two vowels together)
    if (isVowel(ch)) {
      const next = chars[i + 1];
      const digraph = ch + (next || "");

      // Common vowel digraphs
      const digraphPhonemes: Record<string, Phoneme> = {
        ee: "iː", ea: "iː", oo: "uː", ou: "aʊ", ow: "əʊ",
        ai: "eɪ", ay: "eɪ", oi: "ɔɪ", oy: "ɔɪ", au: "ɔː",
        aw: "ɔː", oa: "əʊ", ie: "aɪ", ei: "iː", eu: "juː",
      };

      if (digraphPhonemes[digraph]) {
        phonemes.push(digraphPhonemes[digraph]);
        i += 2;
        continue;
      }

      // Single vowel — decide long vs short
      // If at end of word or followed by single consonant + e → long
      const isEnd = i === chars.length - 1;
      const isMagicE = i < chars.length - 2 && chars[chars.length - 1] === "e" &&
        countVowels(word) === 2;
      const isOpen = isEnd || (i === chars.length - 2 && !isVowel(next) && chars[chars.length - 1] === "e");

      if (isOpen || isMagicE) {
        phonemes.push(LONG_VOWELS[ch] || SHORT_VOWELS[ch] || "ə");
      } else {
        phonemes.push(SHORT_VOWELS[ch] || "ə");
      }
      i++;
      continue;
    }

    // Consonant (including c, g, s, x, q which have special rules)
    if (/[bcdfghjklmnpqrstvwz]/.test(ch)) {
      // Check for consonant digraphs first
      const digraph = ch + (chars[i + 1] || "");
      const consonantDigraphs: Record<string, Phoneme> = {
        ch: "tʃ", sh: "ʃ", th: "θ", ph: "f", wh: "w", ck: "k", ng: "ŋ",
      };
      if (consonantDigraphs[digraph]) {
        phonemes.push(consonantDigraphs[digraph]);
        i += 2;
        continue;
      }

      // Handle c → /k/ or /s/
      if (ch === "c") {
        const nextVowel = chars[i + 1];
        if (nextVowel && /[eiy]/.test(nextVowel)) {
          phonemes.push("s");  // city, cent, cycle
        } else {
          phonemes.push("k");  // cat, cot, cup
        }
        i++;
        continue;
      }

      // Handle g → /ɡ/ or /dʒ/
      if (ch === "g") {
        const nextVowel = chars[i + 1];
        if (nextVowel && /[eiy]/.test(nextVowel)) {
          // gym, giant — but not always (get, give)
          if (word.match(/g[ei](t|ve|r|o)/)) {
            phonemes.push("ɡ");
          } else {
            phonemes.push("dʒ");
          }
        } else {
          phonemes.push("ɡ");
        }
        i++;
        continue;
      }

      // Handle s → /s/ or /z/
      if (ch === "s") {
        const next = chars[i + 1];
        // sh → /ʃ/ already handled by digraph above
        // s between vowels → /z/ (reason, present)
        if (i > 0 && isVowel(chars[i - 1]) && next && isVowel(next)) {
          phonemes.push("z");
        } else {
          phonemes.push("s");
        }
        i++;
        continue;
      }

      // Handle x → /ks/
      if (ch === "x") {
        phonemes.push("k", "s");
        i++;
        continue;
      }

      // Handle q → /kw/ (usually followed by u)
      if (ch === "q") {
        if (chars[i + 1] === "u") {
          phonemes.push("k", "w");
          i += 2;
          continue;
        }
        phonemes.push("k");
        i++;
        continue;
      }

      // Handle y → /j/ as consonant, /ɪ/ or /iː/ as vowel
      if (ch === "y") {
        if (i === 0 || !isVowel(chars[i - 1])) {
          // y as consonant: yes, yellow, beyond
          phonemes.push("j");
        } else {
          // y as vowel at end: happy, city → /i/
          phonemes.push("i");
        }
        i++;
        continue;
      }

      // Regular consonant
      if (CONSONANTS[ch]) {
        phonemes.push(CONSONANTS[ch]);
      }
      i++;
      continue;
    }

    // Unknown character — skip
    i++;
  }

  return phonemes.length > 0 ? phonemes : undefined;
}

/**
 * Enhanced lookup: dictionary first, G2P fallback for unknown words.
 * Use this everywhere instead of lookupIPA when you want any word to work.
 */
export function lookupPhonemes(word: string): Phoneme[] | undefined {
  const cleaned = word.toLowerCase().replace(/[.,!?]/g, "");
  // Try hand-verified dictionary first
  const dictResult = lookupIPADirect(cleaned);
  if (dictResult) return dictResult;
  // Fall back to G2P
  return g2p(cleaned);
}

function lookupIPADirect(word: string): Phoneme[] | undefined {
  return IPA_DICT[word];
}
