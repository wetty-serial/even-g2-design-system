import { describe, expect, it } from 'vitest'
import { measureTextWrap } from '@evenrealities/pretext'
import { CONFIRM_TAP_GUARD_MS, GLASS, WORDS } from './tokens.ts'
import { faceHeight } from './list.ts'
import { position, progressBar } from './progress.ts'

describe('tokens', () => {
  it('CARD の内寸は 548 x 240', () => {
    const c = GLASS.CARD
    expect(c.W - c.BORDER * 2 - c.PADDING * 2).toBe(548)
    expect(c.H - c.BORDER * 2 - c.PADDING * 2).toBe(240)
    expect(c.INNER_W).toBe(548)
    expect(c.INNER_H).toBe(240)
  })

  it('CARD に 8 行は入り、9 行は入らない', () => {
    const rows = (n: number) => Array.from({ length: n }, () => 'あ').join('\n')
    expect(measureTextWrap(rows(8), GLASS.CARD.INNER_W).height).toBeLessThanOrEqual(GLASS.CARD.INNER_H)
    expect(measureTextWrap(rows(9), GLASS.CARD.INNER_W).height).toBeGreaterThan(GLASS.CARD.INNER_H)
  })

  it('FACE の高さの式: 1 行 35 / 2 行 62 / 3 行 89 / 8 行 224', () => {
    expect(faceHeight(1)).toBe(35)
    expect(faceHeight(2)).toBe(62)
    expect(faceHeight(3)).toBe(89)
    expect(faceHeight(8)).toBe(224)
  })

  it('TEXT_SAFE_MARGIN = 12 / CONFIRM_TAP_GUARD_MS = 600', () => {
    expect(GLASS.TEXT_SAFE_MARGIN).toBe(12)
    expect(GLASS.CARD.INNER_W - GLASS.TEXT_SAFE_MARGIN).toBe(536)
    expect(GLASS.FACE.INNER_W - GLASS.TEXT_SAFE_MARGIN).toBe(536)
    expect(CONFIRM_TAP_GUARD_MS).toBe(600)
    expect(GLASS.TIMING.confirmTapGuard).toBe(600)
  })

  it('WORDS は ja / en が同じキー', () => {
    expect(Object.keys(WORDS.en).sort()).toEqual(Object.keys(WORDS.ja).sort())
  })
})

describe('progress', () => {
  it('バーは常に 10 マス', () => {
    expect(progressBar(0, 10)).toBe('──────────')
    expect(progressBar(5, 10)).toBe('━━━━━─────')
    expect(progressBar(10, 10)).toBe('━━━━━━━━━━')
    expect(progressBar(1, 24)).toBe('━─────────')
    expect(progressBar(3, 0)).toBe('──────────')
    expect(Array.from(progressBar(7, 13))).toHaveLength(10)
  })
  it('位置は総数の桁までゼロ埋め', () => {
    expect(position(3, 24)).toBe('03/24')
    expect(position(3, 100)).toBe('003/100')
    expect(position(1, 5)).toBe('1/5')
  })
})
