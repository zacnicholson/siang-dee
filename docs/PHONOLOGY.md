# Thai→English Phonology — the scientific basis for Siang Dee's error rules

Every error category in `src/lib/phonology/errors.ts` is grounded in documented Thai phonology, not guessed. This document explains *why* each rule exists, so contributors can extend or tune the detection without breaking the science.

## Core facts about Thai phonology that drive the rules

1. **Thai has only 8 syllable-final consonant phonemes:** `/p t k ʔ m n ŋ w j/`. English has many more finals (stops, fricatives, affricates, liquids). Thai speakers therefore often **drop or alter** English word-final consonants. → drives **E3** (final deletion) and **E4** (final-cluster simplification).

2. **Thai has no word-final consonant clusters** (no /kt/, /ld/, /skt/). English final clusters are simplified by deletion. → **E4**.

3. **Thai has no /θ/ or /ð/** (the "th" fricatives). Speakers substitute /s/ or /t/ for /θ/, and /z/ or /d/ for /ð/. → **E6**.

4. **Thai has no /ʃ ʒ tʃ dʒ/** (postalveolar fricatives/affricates). /tʃ/ is replaced with /ʃ/ or /s/. → **E5**; /ʃ/ is replaced with /s/. → **E7**.

5. **Thai has no /v/** (labiodoral voiced). Speakers use /w/ instead. → **E8**.

6. **/l/ and /r/ are both in the Thai inventory but are not contrastive** in the same way and are commonly confused in English production. → **E1**.

7. **Thai has no voiced final fricatives** — final /z/ devoices to /s/. → **E9**.

8. **Thai is a syllable-timed language with no lexical stress contrast**; English is stress-timed with lexical stress. → **E13** (word stress), **E15** (rhythm/intonation), **E14** (weak-form reduction missing).

9. **Thai vowels are often nasal**; English vowels are oral. → **E12** (nasalized vowels).

10. **Thai has no tense/lax (long/short) vowel contrast** like English /iː/-/ɪ/, /uː/-/ʊ/, /ɑː/-/ʌ/. → **E11**.

11. **English diphthongs** like /əʊ/ (go, show) may collapse to a single Thai vowel /ɔ/ or /ɒ/. → **E10**.

12. **Consonant clusters** (English allows /dr sm kr str/) are broken with an epenthetic schwa. → **E2**.

## The 15 error categories

| ID | English name | Thai name | Target | Common Thai substitution | Example |
|----|--------------|-----------|--------|--------------------------|---------|
| E1 | /l/ vs /r/ confusion | สับสน ล กับ ร | /l/, /r/ | /l/→/r/, /r/→/l/ | "light"→"right" |
| E2 | Consonant-cluster epenthesis | แทรกสระในกลุ่มพยัญชนะ | CC onset | +/ə/ | "drive"→"da-rive" |
| E3 | Word-final consonant deletion | ตัดพยัญชนะท้ายคำ | final stops/fricatives | Ø | "what"→"wa" |
| E4 | Final-cluster simplification | ย่อกลุ่มพยัญชนะท้ายคำ | final CC/CCC | delete one | "asked"→"ask" |
| E5 | /tʃ/ → /ʃ/ or /s/ | ตี /tʃ/ เป็น /ʃ/ | /tʃ/ | /ʃ/, /s/ | "church"→"shurch" |
| E6 | /θ/→/s/ or /t/; /ð/→/z/ or /d/ | th | /θ/, /ð/ | /s/,/t/,/z/,/d/ | "three"→"tree" |
| E7 | /ʃ/ → /s/ | ตี /ʃ/ เป็น /s/ | /ʃ/ | /s/ | "she"→"see" |
| E8 | /v/ → /w/ | ตี /v/ เป็น /w/ | /v/ | /w/ | "very"→"wery" |
| E9 | Final /z/ devoicing | /z/ ท้ายคำเป็น /s/ | final /z/ | /s/ | "dogs"→"dos" |
| E10 | /əʊ/ → /ɔ/ or /ɒ/ | /əʊ/ เป็น /ɔ/ | /əʊ/ | /ɔː/, /ɒ/ | "show"→"shore" |
| E11 | Vowel length / tense-lax | ความยาวเสียงสระ | /iː ɪ uː ʊ ɑː ʌ/ | opposite length | "sheep"↔"ship" |
| E12 | Nasalized vowels | สระเสียงใน | oral vowels | nasal | (suprasegmental) |
| E13 | Word stress | เน้นเสียงในคำ | stressed syllable | final stress | (suprasegmental) |
| E14 | Weak-form reduction missing | ไม่ลดรูปคำสระ | /ə/ in function words | full vowel | "can"→/kæn/ |
| E15 | Syllable timing / intonation | จังหวะและท่วงทำนอง | stress-timed | syllable-timed | (suprasegmental) |

E1–E11 + E14 are **segmental** and detectable from phoneme alignment alone. E12, E13, E15 are **suprasegmental** and are surfaced as gentle notes in the MVP (not scored errors) until prosody analysis (F0/duration) is added.

## How detection works

1. The spoken phoneme sequence (from wav2vec2) is aligned against the target (from the IPA dictionary) using **Needleman–Wunsch** with a Thai-aware substitution matrix: known confusions (/l/↔/r/, /v/↔/w/, /θ/↔/s/, etc.) get a *low* cost so they still align, then get *flagged* as errors at the detection step.
2. Each non-match cell (substitution / insertion / deletion) is mapped to candidate error IDs via `candidateErrors(target, spoken)` in `errors.ts`.
3. For deletions, E3 (single final) vs E4 (cluster) is disambiguated by word-boundary context.
4. Low recognizer-confidence phonemes (< 0.45) are not penalized (avoids model-noise false positives).

## Sources

- Pronunciation Studio, "10 English Pronunciation Errors by Thai Speakers" — https://pronunciationstudio.com/thai-speakers-english-pronunciation-errors/
- Thai-accented English phonology systematic review — ERIC EJ1348382 (Thai has 8 final consonant phonemes, no final clusters, no /θ ð ʃ ʒ tʃ dʒ/).
- Consonant cluster acquisition by L2 Thai speakers — ERIC EJ1144775.
- Word-final consonant challenges for Thai learners — Wu AC library review.
- Mispronunciation detection approach (wav2vec2 + espeak + Needleman–Wunsch alignment) — `crazycloud/mispronunciation-detection-diagnosis-wav2vec2-and-llm` (the same architecture pattern Siang Dee uses, adapted to run in-browser).

## Tuning the rules

- **Substitution costs** are in `align.ts` (`KNOWN_THAI_SWAPS`, `swapCost`). Add a confusion pair here to make the aligner match it.
- **Error category definitions** (targets, substitutions, explanations) are in `errors.ts`. Add a new `E16` here + a detection case in `candidateErrors`.
- **Severity weights** for scoring are in `detect.ts` (`SEVERITY`). Higher = bigger score penalty.
- **Confidence threshold** for model-noise guard is `MIN_CONFIDENCE` in `detect.ts`.
