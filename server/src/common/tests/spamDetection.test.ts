import { describe, it, expect } from 'vitest'
import {
  analyseSpam,
  calculateSpamScore,
  isSpam,
  DEFAULT_SPAM_THRESHOLD,
} from '../spamDetection.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const clean = (text: string) => expect(isSpam(text)).toBe(false)
const spam = (text: string, threshold = DEFAULT_SPAM_THRESHOLD) =>
  expect(isSpam(text, threshold)).toBe(true)

// ---------------------------------------------------------------------------
describe('Spam Detection Utility', () => {
  // ── Baseline ──────────────────────────────────────────────────────────────
  describe('clean comments', () => {
    it('scores a genuine comment as 0', () => {
      const text = 'Truyện đọc rất hay và lôi cuốn, tác giả viết chắc tay quá!'
      expect(calculateSpamScore(text)).toBe(0)
      clean(text)
    })

    it('allows a single URL without triggering spam', () => {
      const text = 'Xem thêm tại https://example.com nhé'
      const result = analyseSpam(text)
      expect(result.score).toBeLessThan(DEFAULT_SPAM_THRESHOLD)
      expect(result.rules.some(r => r.rule === 'URL_SINGLE')).toBe(true)
    })
  })

  // ── Rule 1: Short content ─────────────────────────────────────────────────
  describe('Rule: SHORT_CONTENT', () => {
    it('flags empty string', () => {
      const result = analyseSpam('')
      expect(result.rules.some(r => r.rule === 'SHORT_CONTENT')).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(30)
    })

    it('flags single-char content', () => {
      expect(analyseSpam('a').rules.some(r => r.rule === 'SHORT_CONTENT')).toBe(true)
    })

    it('does NOT flag 2-char content', () => {
      expect(analyseSpam('ok').rules.some(r => r.rule === 'SHORT_CONTENT')).toBe(false)
    })
  })

  // ── Rule 2: URL flooding ──────────────────────────────────────────────────
  describe('Rule: URL_FLOOD / URL_MULTIPLE', () => {
    it('scores 40+ for 3+ full URLs', () => {
      const text =
        'Xem tại https://spam1.com và https://spam2.com và https://spam3.com'
      const result = analyseSpam(text)
      expect(result.rules.some(r => r.rule === 'URL_FLOOD')).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(40)
    })

    it('scores 20 for exactly 2 URLs', () => {
      const text = 'Xem https://a.com và https://b.com'
      const result = analyseSpam(text)
      expect(result.rules.some(r => r.rule === 'URL_MULTIPLE')).toBe(true)
    })

    it('detects short-link domains (bit.ly)', () => {
      const text = 'Click ngay bit.ly/abc123 và bit.ly/def456 và bit.ly/ghi789'
      const result = analyseSpam(text)
      expect(result.score).toBeGreaterThanOrEqual(40)
    })

    it('detects mixed full + short URLs', () => {
      const text = 'Vào https://spam.com hoặc bit.ly/abc hoặc t.me/spam'
      const result = analyseSpam(text)
      expect(result.score).toBeGreaterThanOrEqual(40)
    })
  })

  // ── Rule 3: Banned keywords ───────────────────────────────────────────────
  describe('Rule: BANNED_KEYWORD', () => {
    it('flags plain keyword "casino"', () => {
      const result = analyseSpam('Đăng ký casino tặng ngay 100k')
      expect(result.rules.some(r => r.rule === 'BANNED_KEYWORD')).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(35)
    })

    it('flags Vietnamese keyword "cờ bạc"', () => {
      const result = analyseSpam('Chơi cờ bạc online uy tín 2024')
      expect(result.rules.some(r => r.rule === 'BANNED_KEYWORD')).toBe(true)
    })

    it('flags leet-speak obfuscation "c4s1n0"', () => {
      const result = analyseSpam('Vào c4s1n0 trúng lớn ngay!')
      expect(result.rules.some(r => r.rule === 'BANNED_KEYWORD')).toBe(true)
    })

    it('flags separator-obfuscated "c-a-s-i-n-o"', () => {
      const result = analyseSpam('Chơi c-a-s-i-n-o kiếm tiền nhanh')
      expect(result.rules.some(r => r.rule === 'BANNED_KEYWORD')).toBe(true)
    })

    it('flags "bet" keyword', () => {
      const result = analyseSpam('Trang bet uy tín nhất VN đây nha')
      expect(result.rules.some(r => r.rule === 'BANNED_KEYWORD')).toBe(true)
    })
  })

  // ── Rule 4: Repeated characters ───────────────────────────────────────────
  describe('Rule: REPEATED_CHARS', () => {
    it('flags ASCII repeated chars (aaaaaaaaaaa)', () => {
      const result = analyseSpam('Hay quá điiiiiiiiii')
      expect(result.rules.some(r => r.rule === 'REPEATED_CHARS')).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(20)
    })

    it('does NOT flag normal repeated chars (e.g. "oo" in "book")', () => {
      const result = analyseSpam('This is a good book, cool story!')
      expect(result.rules.some(r => r.rule === 'REPEATED_CHARS')).toBe(false)
    })
  })

  // ── Rule 5: ALL_CAPS ──────────────────────────────────────────────────────
  describe('Rule: ALL_CAPS', () => {
    it('flags predominantly uppercase text', () => {
      const result = analyseSpam('TRUYEN NAY HAY QUA MOI NGUOI OI VAO DOC NGAY DI')
      expect(result.rules.some(r => r.rule === 'ALL_CAPS')).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(15)
    })

    it('ignores short text with uppercase', () => {
      // "OK" is only 2 letters — below the 10-char floor
      const result = analyseSpam('OK')
      expect(result.rules.some(r => r.rule === 'ALL_CAPS')).toBe(false)
    })
  })

  // ── Rule 6: Excessive punctuation ─────────────────────────────────────────
  describe('Rule: EXCESSIVE_PUNCT', () => {
    it('flags 4+ consecutive "!"', () => {
      const result = analyseSpam('Hay quá trời ơi!!!!!')
      expect(result.rules.some(r => r.rule === 'EXCESSIVE_PUNCT')).toBe(true)
    })

    it('flags 4+ consecutive "?"', () => {
      const result = analyseSpam('Sao vậy????????')
      expect(result.rules.some(r => r.rule === 'EXCESSIVE_PUNCT')).toBe(true)
    })

    it('does NOT flag normal punctuation', () => {
      const result = analyseSpam('Hay quá! Thích lắm.')
      expect(result.rules.some(r => r.rule === 'EXCESSIVE_PUNCT')).toBe(false)
    })
  })

  // ── Rule 7: Phone number spam ─────────────────────────────────────────────
  describe('Rule: PHONE_SINGLE / PHONE_FLOOD', () => {
    it('flags single VN phone number', () => {
      const result = analyseSpam('Liên hệ 0912345678 để được tư vấn')
      expect(result.rules.some(r => r.rule === 'PHONE_SINGLE')).toBe(true)
    })

    it('flags multiple phone numbers as PHONE_FLOOD', () => {
      const result = analyseSpam('Gọi 0912345678 hoặc 0987654321 để đặt hàng')
      expect(result.rules.some(r => r.rule === 'PHONE_FLOOD')).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(25)
    })
  })

  // ── Combined / isSpam ─────────────────────────────────────────────────────
  describe('Combined violations & isSpam()', () => {
    it('rejects a heavily spammy comment (multiple rules triggered)', () => {
      const text =
        'LINK CASINO TAI HTTP://SPAM.COM VA HTTP://SPAM2.COM AAAAAAAAAAAAA'
      spam(text)
    })

    it('rejects URL flood + banned keyword combination', () => {
      // 3 URLs (score +40) + "cá cược" keyword (score +35) = 75 → spam
      const text =
        'Đăng ký cá cược tại https://betwin.com và https://casinovip.com và https://vip88.com'
      spam(text)
    })

    it('accepts a borderline comment with only 1 URL', () => {
      const text = 'Theo dõi kênh mình tại https://youtube.com/channel/abc nhé!'
      clean(text)
    })
  })

  // ── analyseSpam() structured result ───────────────────────────────────────
  describe('analyseSpam() structured result', () => {
    it('returns score, isSpam and rules array', () => {
      const result = analyseSpam('casino spam')
      expect(result).toHaveProperty('score')
      expect(result).toHaveProperty('isSpam')
      expect(Array.isArray(result.rules)).toBe(true)
      result.rules.forEach(r => {
        expect(r).toHaveProperty('rule')
        expect(r).toHaveProperty('score')
        expect(r).toHaveProperty('reason')
      })
    })

    it('score is clamped to 100', () => {
      // Very spammy text — many rules fire simultaneously
      const text =
        'CASINO BET CỜ BẠC https://a.com https://b.com https://c.com AAAAAAAAAAAAA!!!!! 0912345678 0987654321'
      const result = analyseSpam(text)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('custom threshold is respected', () => {
      // Score should be >= 5 but < 60 for a single URL comment
      const text = 'Xem tại https://example.com'
      expect(isSpam(text, 1)).toBe(true)   // very low threshold → spam
      expect(isSpam(text, 60)).toBe(false) // default threshold → clean
    })
  })
})
