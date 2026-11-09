/**
 * Spam Detection Utility
 *
 * Scores a text comment from 0 (clean) to 100+ (likely spam).
 * Default rejection threshold: spamScore >= 60.
 *
 * Design goals (production-grade):
 * - All regexes compiled once at module load (no per-call compilation cost)
 * - Unicode-aware repeated-char detection (covers tiếng Việt)
 * - Leet-speak / separator-obfuscation normalisation before keyword scan
 * - Structured result with per-rule breakdown for logging / debugging
 * - Pure functions — no side effects, fully unit-testable
 * - No external dependencies
 */

// ---------------------------------------------------------------------------
// Configuration — adjust scores without touching logic
// ---------------------------------------------------------------------------

/** Minimum content length considered "real" input (chars after trim). */
export const MIN_CONTENT_LENGTH = 2

/** Default threshold above which a comment is considered spam. */
export const DEFAULT_SPAM_THRESHOLD = 60

/**
 * Exact banned phrases (Vietnamese / English).
 * Keep sorted by specificity (longer/more-specific first) to aid readability.
 */
export const BANNED_KEYWORDS: readonly string[] = [
  // Gambling / betting
  'kích hoạt vip miễn phí',
  'kiếm tiền online nhanh',
  'đầu tư uy tín',
  'giveaway xu',
  'free xu',
  'link hack',
  'hack game',
  'cá cược',
  'cờ bạc',
  'casino',
  'bet',
  'mmo',
  // Phishing / scam phrases common in VN comments
  'nhắn tin zalo',
  'inbox ngay',
  'kết bạn zalo',
  'tải app nhận',
  'đăng ký nhận thưởng',
  'nạp tiền nhận',
  'rút tiền nhanh',
]

// ---------------------------------------------------------------------------
// Pre-compiled patterns (module-level — compiled once)
// ---------------------------------------------------------------------------

/** HTTP/HTTPS URLs */
const URL_FULL_RE = /https?:\/\/[^\s<>"]+/gi

/**
 * Bare-domain short links that often appear without a scheme
 * e.g. "bit.ly/xxx", "tinyurl.com/xxx", "t.me/xxx"
 */
const URL_SHORT_RE =
  /\b(?:bit\.ly|tinyurl\.com|t\.me|fb\.me|goo\.gl|ow\.ly|is\.gd|buff\.ly|adf\.ly)\/\S+/gi

/**
 * Unicode-aware repeated-char: any character (including composed Vietnamese)
 * repeated 8+ times consecutively.
 */
const REPEATED_CHAR_RE = /(.)\1{7,}/u

/**
 * Excessive punctuation: 4+ consecutive identical punctuation characters
 * e.g. "!!!!", "????", "....."
 */
const EXCESSIVE_PUNCT_RE = /([!?.])\1{3,}/

/**
 * Vietnamese / international phone numbers:
 *   - 10-digit VN mobile: 0[35789]xxxxxxxx
 *   - 11-digit with country code: +84...
 *   - Generic digit runs of 9-11 digits with optional separators
 */
const PHONE_RE =
  /(?:\+84|0)(?:[35789]\d{8}|\d{8,10})|(?<!\d)\d{3}[-.\s]\d{3,4}[-.\s]\d{4}(?!\d)/g

/**
 * Leet-speak substitution map — applied before keyword matching.
 * Covers the most common obfuscation tricks seen in VN spam comments.
 */
const LEET_MAP: [RegExp, string][] = [
  [/4/g, 'a'],
  [/3/g, 'e'],
  [/1/g, 'i'],
  [/0/g, 'o'],
  [/5/g, 's'],
  [/7/g, 't'],
  [/\$/g, 's'],
  [/@/g, 'a'],
  [/\+/g, 't'],
]

/** Separator noise inserted between letters to evade substring matching */
const SEPARATOR_RE = /[-_.=*|,;:\s]+/g

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalise text for keyword matching:
 * 1. Lowercase
 * 2. Leet-speak substitution
 * 3. Collapse separator noise (keeps words concatenated for matching)
 */
function normalise(text: string): string {
  let s = text.toLowerCase()
  for (const [pattern, replacement] of LEET_MAP) {
    s = s.replace(pattern, replacement)
  }
  // Remove separators so "c-a-s-i-n-o" → "casino"
  s = s.replace(SEPARATOR_RE, '')
  return s
}

/**
 * Count non-overlapping regex matches (resets lastIndex between calls).
 */
function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0
  const matches = text.match(re)
  return matches ? matches.length : 0
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SpamRule {
  /** Machine-readable rule identifier */
  rule: string
  /** Points added by this rule (0 if rule did not fire) */
  score: number
  /** Human-readable explanation */
  reason: string
}

export interface SpamResult {
  /** Total clamped score (0–100) */
  score: number
  /** Whether score meets the rejection threshold */
  isSpam: boolean
  /** Detailed per-rule breakdown — useful for logging/debugging */
  rules: SpamRule[]
}

// ---------------------------------------------------------------------------
// Core scoring function
// ---------------------------------------------------------------------------

/**
 * Analyse `content` and return a structured spam result.
 *
 * @param content   Raw comment text from the user.
 * @param threshold Score at or above which `isSpam` is `true`. Default: 60.
 */
export function analyseSpam(content: string, threshold = DEFAULT_SPAM_THRESHOLD): SpamResult {
  const trimmed = content.trim()
  const lower = trimmed.toLowerCase()
  const normalised = normalise(trimmed)
  const rules: SpamRule[] = []

  // --- Rule 1: Extremely short content ---
  if (trimmed.length < MIN_CONTENT_LENGTH) {
    rules.push({ rule: 'SHORT_CONTENT', score: 30, reason: `Content too short (${trimmed.length} chars)` })
  }

  // --- Rule 2: URL flooding ---
  const fullUrls = countMatches(lower, URL_FULL_RE)
  const shortUrls = countMatches(lower, URL_SHORT_RE)
  const totalUrls = fullUrls + shortUrls

  if (totalUrls >= 3) {
    rules.push({ rule: 'URL_FLOOD', score: 40, reason: `${totalUrls} URLs detected` })
  } else if (totalUrls === 2) {
    rules.push({ rule: 'URL_MULTIPLE', score: 20, reason: '2 URLs detected' })
  } else if (totalUrls === 1) {
    rules.push({ rule: 'URL_SINGLE', score: 5, reason: '1 URL detected' })
  }

  // --- Rule 3: Banned keyword (normalised — leet/separator aware) ---
  for (const kw of BANNED_KEYWORDS) {
    // Normalise the keyword in the same way as the text
    const normKw = normalise(kw)
    if (normalised.includes(normKw)) {
      rules.push({ rule: 'BANNED_KEYWORD', score: 35, reason: `Banned keyword matched: "${kw}"` })
      break // one match is enough — avoid double-scoring
    }
  }

  // --- Rule 4: Repeated characters (Unicode-safe) ---
  if (REPEATED_CHAR_RE.test(trimmed)) {
    rules.push({ rule: 'REPEATED_CHARS', score: 20, reason: 'Character repeated 8+ times consecutively' })
  }

  // --- Rule 5: ALL_CAPS dominance ---
  const letters = trimmed.replace(/[^a-zA-Z]/g, '')
  if (letters.length > 10) {
    const upperRatio = (letters.replace(/[^A-Z]/g, '').length) / letters.length
    if (upperRatio > 0.6) {
      rules.push({
        rule: 'ALL_CAPS',
        score: 15,
        reason: `${Math.round(upperRatio * 100)}% uppercase letters`,
      })
    }
  }

  // --- Rule 6: Excessive punctuation (e.g. "!!!!????") ---
  if (EXCESSIVE_PUNCT_RE.test(trimmed)) {
    rules.push({ rule: 'EXCESSIVE_PUNCT', score: 10, reason: '4+ consecutive identical punctuation characters' })
  }

  // --- Rule 7: Phone number spam ---
  const phoneMatches = countMatches(trimmed, PHONE_RE)
  if (phoneMatches >= 2) {
    rules.push({ rule: 'PHONE_FLOOD', score: 25, reason: `${phoneMatches} phone numbers detected` })
  } else if (phoneMatches === 1) {
    rules.push({ rule: 'PHONE_SINGLE', score: 10, reason: '1 phone number detected' })
  }

  const totalScore = Math.min(
    rules.reduce((acc, r) => acc + r.score, 0),
    100,
  )

  return {
    score: totalScore,
    isSpam: totalScore >= threshold,
    rules,
  }
}

// ---------------------------------------------------------------------------
// Convenience shims — backward-compatible with existing call sites
// ---------------------------------------------------------------------------

/**
 * Returns a spam score 0–100.
 * Prefer `analyseSpam()` for structured results.
 */
export function calculateSpamScore(content: string): number {
  return analyseSpam(content).score
}

/** Returns `true` if the comment should be rejected. */
export function isSpam(content: string, threshold = DEFAULT_SPAM_THRESHOLD): boolean {
  return analyseSpam(content, threshold).isSpam
}
