import { describe, it, expect } from "vitest";
import {
  alignPhonemes,
  detectErrors,
  candidateErrors,
  ERROR_CATEGORIES,
  lookupIPA,
  sentenceToPhonemes,
} from "../../src/lib/phonology";

describe("Needleman–Wunsch alignment", () => {
  it("exact match → all matches", () => {
    const r = alignPhonemes(["l", "aɪ", "t"], ["l", "aɪ", "t"]);
    expect(r.matches).toBe(3);
    expect(r.substitutions + r.insertions + r.deletions).toBe(0);
  });

  it("E1: /l/→/r/ flags a substitution at position 0", () => {
    const r = alignPhonemes(["l", "aɪ", "t"], ["r", "aɪ", "t"]);
    expect(r.matches).toBe(2);
    expect(r.substitutions).toBe(1);
    expect(r.cells[0].op).toBe("substitution");
    expect(r.cells[0].target).toBe("l");
    expect(r.cells[0].spoken).toBe("r");
  });

  it("E2: cluster epenthesis flags an insertion of schwa", () => {
    // target "drive" /d r aɪ v/, spoken "da-rive" /d ə r aɪ v/
    const r = alignPhonemes(["d", "r", "aɪ", "v"], ["d", "ə", "r", "aɪ", "v"]);
    expect(r.insertions).toBe(1);
    const ins = r.cells.find((c) => c.op === "insertion");
    expect(ins?.spoken).toBe("ə");
  });

  it("E3: final-consonant deletion flags a deletion", () => {
    // target "what" /w ɒ t/, spoken "wa" /w ɒ/
    const r = alignPhonemes(["w", "ɒ", "t"], ["w", "ɒ"]);
    expect(r.deletions).toBe(1);
    expect(r.cells[r.cells.length - 1].op).toBe("deletion");
  });

  it("handles empty spoken (all deletions)", () => {
    const r = alignPhonemes(["l", "aɪ", "t"], []);
    expect(r.deletions).toBe(3);
  });

  it("handles empty target (all insertions)", () => {
    const r = alignPhonemes([], ["l", "aɪ", "t"]);
    expect(r.insertions).toBe(3);
  });
});

describe("candidateErrors lookup", () => {
  it("l→r → E1", () => {
    expect(candidateErrors("l", "r")).toContain("E1");
  });
  it("r→l → E1", () => {
    expect(candidateErrors("r", "l")).toContain("E1");
  });
  it("θ→s → E6", () => {
    expect(candidateErrors("θ", "s")).toContain("E6");
  });
  it("v→w → E8", () => {
    expect(candidateErrors("v", "w")).toContain("E8");
  });
  it("match → no errors", () => {
    expect(candidateErrors("l", "l")).toEqual([]);
  });
});

describe("detectErrors integration", () => {
  it("E1: spoken 'right' for target 'light' → E1, score < 70", () => {
    const target = lookupIPA("light")!;
    const spoken = lookupIPA("right")!;
    const r = detectErrors(target, spoken);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.some((e) => e.errorId === "E1")).toBe(true);
    expect(r.wordScore).toBeLessThan(70);
  });

  it("E3: spoken without final /t/ → E3 detected", () => {
    const target = lookupIPA("what")!;
    const spoken: any[] = ["w", "ɒ"];
    const r = detectErrors(target, spoken);
    expect(r.errors.some((e) => e.errorId === "E3")).toBe(true);
  });

  it("E2: epenthesis schwa → E2 detected", () => {
    const target = lookupIPA("drive")!;
    const spoken: any[] = ["d", "ə", "r", "aɪ", "v"];
    const r = detectErrors(target, spoken);
    expect(r.errors.some((e) => e.errorId === "E2")).toBe(true);
  });

  it("perfect match → no errors, high score", () => {
    const target = lookupIPA("light")!;
    const spoken = lookupIPA("light")!;
    const r = detectErrors(target, spoken);
    expect(r.errors).toHaveLength(0);
    expect(r.wordScore).toBeGreaterThanOrEqual(95);
  });

  it("low-confidence phoneme is not flagged (model noise guard)", () => {
    const target = lookupIPA("light")!;
    const spoken = lookupIPA("right")!; // /r aɪ t/
    // give the /r/ a confidence below MIN_CONFIDENCE
    const r = detectErrors(target, spoken, [0.2, 0.9, 0.9]);
    expect(r.errors).toHaveLength(0);
  });
});

describe("dictionary", () => {
  it("lookupIPA returns IPA for known words", () => {
    expect(lookupIPA("light")).toEqual(["l", "aɪ", "t"]);
    expect(lookupIPA("right")).toEqual(["r", "aɪ", "t"]);
  });

  it("sentenceToPhonemes builds phonemes + boundaries", () => {
    const r = sentenceToPhonemes("light right");
    expect(r.phonemes).toEqual(["l", "aɪ", "t", "r", "aɪ", "t"]);
    expect(r.boundaries).toEqual([2, 5]); // last index of each word
    expect(r.missing).toEqual([]);
  });

  it("1000 sample words: no missing for the core drill list", () => {
    const core = ["light", "right", "long", "wrong", "fly", "fry", "glass", "grass",
      "play", "pray", "drive", "smoke", "crime", "school", "street", "what", "bag",
      "nice", "have", "church", "chair", "cheese", "the", "three", "think", "bath",
      "she", "shoe", "very", "wave", "river", "show", "go", "note", "coat", "short",
      "sheep", "ship", "can", "of", "to"];
    for (const w of core) {
      expect(lookupIPA(w)).toBeDefined();
    }
  });
});

describe("error categories sanity", () => {
  it("all 15 categories present and segmental flag set", () => {
    const ids = Object.keys(ERROR_CATEGORIES);
    expect(ids).toHaveLength(15);
    for (const id of ids) {
      const cat = (ERROR_CATEGORIES as any)[id];
      expect(cat.nameEn).toBeTruthy();
      expect(cat.nameTh).toBeTruthy();
      expect(cat.explainEn).toBeTruthy();
      expect(cat.explainTh).toBeTruthy();
      expect(typeof cat.segmental).toBe("boolean");
    }
  });
});
