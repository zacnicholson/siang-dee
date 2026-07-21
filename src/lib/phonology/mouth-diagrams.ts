/**
 * Mouth position SVG diagrams for Thai-English pronunciation errors.
 * Side-view cross-section of mouth showing tongue/lip position.
 * Simple, clean, 2-color max — no medical illustration.
 */

// Reusable SVG path strings
const MOUTH_OUTLINE = "M20,80 Q20,40 60,40 Q100,40 100,80"; // upper lip/jaw line
const TEETH_LINE = "M22,42 L98,42"; // teeth line

/**
 * Generate a mouth diagram SVG for a given error category.
 * Returns an SVG string. Labels are in HTML, not in the SVG.
 */
export function mouthDiagram(errorId: string): string {
  const diagrams: Record<string, string> = {
    E1: /* l vs r */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- /l/ position: tongue tip up behind upper teeth -->
        <path d="M50,80 Q50,60 55,52 L58,52 Q60,55 60,80 Z" fill="var(--c-accent)" opacity="0.7"/>
        <text x="65" y="55" font-size="8" fill="var(--c-fg-muted)">/l/</text>
        <!-- arrow: air flows over sides -->
        <path d="M58,50 L58,45 M56,46 L58,44 L60,46" fill="none" stroke="var(--c-accent)" stroke-width="1"/>
      </svg>`,
    E2: /* consonant cluster */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- tongue in cluster position: raised mid -->
        <path d="M40,80 Q40,65 60,55 Q80,65 80,80 Z" fill="var(--c-accent)" opacity="0.7"/>
        <text x="50" y="52" font-size="7" fill="var(--c-fg-muted)">cluster</text>
        <!-- warning: no vowel insertion -->
        <circle cx="100" cy="30" r="8" fill="none" stroke="var(--c-warn)" stroke-width="1.5"/>
        <line x1="97" y1="27" x2="103" y2="33" stroke="var(--c-warn)" stroke-width="1.5"/>
      </svg>`,
    E3: /* final consonant */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- tongue reaches forward to final position -->
        <path d="M50,80 Q50,55 85,50 L88,50 Q90,55 80,80 Z" fill="var(--c-accent)" opacity="0.7"/>
        <!-- hold marker -->
        <circle cx="88" cy="44" r="3" fill="var(--c-success)"/>
        <text x="92" y="30" font-size="7" fill="var(--c-fg-muted)">hold</text>
      </svg>`,
    E4: /* final cluster */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- tongue forms two contacts -->
        <path d="M45,80 Q45,55 55,48 L60,48 Q62,55 55,80 Z" fill="var(--c-accent)" opacity="0.7"/>
        <path d="M70,80 Q70,58 82,50 L86,50 Q88,58 78,80 Z" fill="var(--c-accent)" opacity="0.5"/>
        <text x="40" y="30" font-size="7" fill="var(--c-fg-muted)">both sounds</text>
      </svg>`,
    E5: /* tʃ */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- tongue stops then releases -->
        <path d="M50,80 Q50,50 62,45 L66,45 Q68,50 60,80 Z" fill="var(--c-accent)" opacity="0.7"/>
        <!-- release puff -->
        <path d="M68,43 Q75,38 80,43" fill="none" stroke="var(--c-accent)" stroke-width="1.5" stroke-dasharray="2,2"/>
        <text x="70" y="35" font-size="8" fill="var(--c-fg-muted)">/tʃ/</text>
      </svg>`,
    E6: /* th */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- tongue between teeth -->
        <path d="M55,80 L55,38 L65,38 L65,80 Z" fill="var(--c-accent)" opacity="0.7"/>
        <line x1="55" y1="40" x2="65" y2="40" stroke="#fff" stroke-width="0.5"/>
        <text x="72" y="35" font-size="8" fill="var(--c-fg-muted)">/θ/ /ð/</text>
        <!-- air through teeth -->
        <path d="M60,36 L60,28" fill="none" stroke="var(--c-accent)" stroke-width="1"/>
        <path d="M58,30 L60,28 L62,30" fill="none" stroke="var(--c-accent)" stroke-width="1"/>
      </svg>`,
    E7: /* ʃ vs s */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- ʃ: tongue raised, lips rounded -->
        <path d="M40,80 Q40,60 60,52 Q80,60 80,80 Z" fill="var(--c-accent)" opacity="0.7"/>
        <ellipse cx="60" cy="38" rx="20" ry="4" fill="none" stroke="var(--c-accent)" stroke-width="1"/>
        <text x="70" y="35" font-size="8" fill="var(--c-fg-muted)">/ʃ/</text>
      </svg>`,
    E8: /* v vs w */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- /v/: upper teeth on lower lip -->
        <rect x="50" y="38" width="3" height="6" fill="#999"/>
        <path d="M48,48 Q48,52 55,50 L65,50 Q70,52 68,48 Z" fill="var(--c-accent)" opacity="0.7"/>
        <!-- vibration lines -->
        <path d="M40,48 L42,50 M38,50 L40,52" fill="none" stroke="var(--c-accent)" stroke-width="0.8"/>
        <text x="75" y="48" font-size="8" fill="var(--c-fg-muted)">/v/</text>
      </svg>`,
    E9: /* z devoicing */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- /z/: tongue behind teeth, voiced -->
        <path d="M50,80 Q50,60 65,55 L70,55 Q72,60 62,80 Z" fill="var(--c-accent)" opacity="0.7"/>
        <!-- vibration (voiced) -->
        <path d="M35,55 Q37,53 39,55 Q41,53 43,55" fill="none" stroke="var(--c-success)" stroke-width="1"/>
        <text x="75" y="55" font-size="8" fill="var(--c-fg-muted)">/z/ voiced</text>
      </svg>`,
    E10: /* əʊ */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- lips rounding -->
        <ellipse cx="60" cy="38" rx="12" ry="5" fill="none" stroke="var(--c-accent)" stroke-width="1.5"/>
        <path d="M50,80 Q50,65 60,60 Q70,65 70,80 Z" fill="var(--c-accent)" opacity="0.5"/>
        <text x="75" y="40" font-size="8" fill="var(--c-fg-muted)">/əʊ/ round</text>
      </svg>`,
    E11: /* vowel length */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- long vowel: same tongue, longer -->
        <path d="M45,80 Q45,55 60,50 Q75,55 75,80 Z" fill="var(--c-accent)" opacity="0.7"/>
        <!-- timing markers -->
        <line x1="45" y1="90" x2="75" y2="90" stroke="var(--c-fg-muted)" stroke-width="1"/>
        <line x1="45" y1="87" x2="45" y2="93" stroke="var(--c-fg-muted)" stroke-width="1"/>
        <line x1="75" y1="87" x2="75" y2="93" stroke="var(--c-fg-muted)" stroke-width="1"/>
        <text x="80" y="93" font-size="7" fill="var(--c-fg-muted)">long</text>
      </svg>`,
    E12: /* nasal */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <path d="${MOUTH_OUTLINE}" fill="none" stroke="#666" stroke-width="1.5"/>
        <line x1="22" y1="42" x2="98" y2="42" stroke="#ccc" stroke-width="1"/>
        <!-- velum lowered: air through nose -->
        <path d="M50,80 Q50,60 60,55 Q70,60 70,80 Z" fill="var(--c-accent)" opacity="0.5"/>
        <!-- nose air flow -->
        <path d="M60,40 L60,25 M57,28 L60,25 L63,28" fill="none" stroke="var(--c-accent)" stroke-width="1"/>
        <circle cx="60" cy="22" r="6" fill="none" stroke="var(--c-fg-muted)" stroke-width="0.5"/>
        <text x="72" y="28" font-size="7" fill="var(--c-fg-muted)">nose</text>
      </svg>`,
    E13: /* stress */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <line x1="20" y1="80" x2="100" y2="80" stroke="#666" stroke-width="1.5"/>
        <!-- intensity bars: stressed syllable taller -->
        <rect x="25" y="50" width="15" height="30" fill="var(--c-accent)" rx="2"/>
        <rect x="50" y="65" width="15" height="15" fill="var(--c-fg-muted)" rx="2"/>
        <rect x="75" y="62" width="15" height="18" fill="var(--c-fg-muted)" rx="2"/>
        <text x="28" y="45" font-size="8" font-weight="700" fill="var(--c-accent)">STRESS</text>
      </svg>`,
    E14: /* weak form */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <line x1="20" y1="80" x2="100" y2="80" stroke="#666" stroke-width="1.5"/>
        <!-- strong syllable vs reduced -->
        <rect x="25" y="50" width="20" height="30" fill="var(--c-accent)" rx="2"/>
        <rect x="60" y="70" width="25" height="10" fill="var(--c-fg-muted)" opacity="0.5" rx="2"/>
        <text x="28" y="45" font-size="7" fill="var(--c-accent)">strong</text>
        <text x="63" y="65" font-size="7" fill="var(--c-fg-muted)">reduced /ə/</text>
      </svg>`,
    E15: /* syllable timing */ `
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
        <line x1="20" y1="80" x2="100" y2="80" stroke="#666" stroke-width="1.5"/>
        <!-- evenly spaced syllables -->
        <rect x="22" y="55" width="16" height="25" fill="var(--c-accent)" rx="2"/>
        <rect x="42" y="55" width="16" height="25" fill="var(--c-accent)" rx="2" opacity="0.8"/>
        <rect x="62" y="55" width="16" height="25" fill="var(--c-accent)" rx="2" opacity="0.6"/>
        <rect x="82" y="55" width="16" height="25" fill="var(--c-accent)" rx="2" opacity="0.4"/>
        <text x="30" y="45" font-size="7" fill="var(--c-fg-muted)">even timing</text>
      </svg>`,
  };

  return diagrams[errorId] ?? diagrams.E1;
}
