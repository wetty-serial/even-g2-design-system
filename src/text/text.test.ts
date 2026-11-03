import { describe, expect, it } from 'vitest'
import { byteLength, clampToBytes, pixelWidth, truncateByPixelWidth } from './index.ts'

describe('measure', () => {
  it('CJK は ASCII より広い', () => {
    expect(pixelWidth('あ')).toBeGreaterThan(pixelWidth('a'))
  })

  it('truncateByPixelWidth は maxPx を超えない', () => {
    const out = truncateByPixelWidth('あ'.repeat(100), 504)
    expect(pixelWidth(out)).toBeLessThanOrEqual(504)
    expect(out.endsWith('…')).toBe(true)
  })

  it('収まる文字列はそのまま返す', () => {
    expect(truncateByPixelWidth('短い', 504)).toBe('短い')
  })

  it('clampToBytes は 999 byte 上限を守る', () => {
    const out = clampToBytes('あ'.repeat(1000), 999)
    expect(byteLength(out)).toBeLessThanOrEqual(999)
  })

  // 公式 `@evenrealities/pretext` に委譲していることの回帰。
  // 自前テーブルに戻すと mixed text でカーニングを取りこぼす (最大 23px ずれた実績あり)。
  it('代表文字の幅が公式ライブラリと一致する', () => {
    expect(pixelWidth('あ')).toBe(20)
    expect(pixelWidth('　')).toBe(20)
    expect(pixelWidth('─')).toBe(20) // 見た目は細いが全角送り
    expect(pixelWidth('M')).toBe(16)
    expect(pixelWidth('l')).toBe(4)
    expect(pixelWidth('@')).toBe(17)
  })

  it('カーニングが効いている (1 文字ずつの和より狭い)', () => {
    // これが等しくなったら per-char 加算に退化している
    expect(pixelWidth('AA')).toBeLessThan(pixelWidth('A') * 2)
  })

  it('罫線は 576px の container に 28 本まで', () => {
    expect(pixelWidth('─'.repeat(28))).toBeLessThanOrEqual(576)
    expect(pixelWidth('─'.repeat(29))).toBeGreaterThan(576)
  })

  it('大文字だけの行を過小評価しない', () => {
    // 旧実装は ASCII を一律 12px と見ていたため 48 字が収まる判定になっていた
    expect(pixelWidth('M'.repeat(48))).toBeGreaterThan(576)
  })
})
