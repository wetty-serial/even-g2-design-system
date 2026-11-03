import { describe, expect, it } from 'vitest'
import { measureTextWrap } from '@evenrealities/pretext'
import { pixelWidth } from '../text/index.ts'
import { confirmQuestionLines, layoutConfirm } from './confirm.ts'
import { GLASS } from './tokens.ts'

describe('confirmQuestionLines', () => {
  it('選択肢 1 / 2 / 3 / 4 / 5 個で 7 / 6 / 4 / 3 / 2 行', () => {
    expect([1, 2, 3, 4, 5].map(confirmQuestionLines)).toEqual([7, 6, 4, 3, 2])
  })
  it('layoutConfirm が実際に確保する行数と一致する', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const l = layoutConfirm({ question: 'q', options: Array.from({ length: n }, (_, i) => `${i}`), cursor: 0 })
      expect(Math.floor((l.question.height! - GLASS.FACE.FRAME_H) / GLASS.FACE.LINE_H)).toBe(confirmQuestionLines(n))
    }
  })
  it('0 個・6 個以上は RangeError', () => {
    expect(() => confirmQuestionLines(0)).toThrow(RangeError)
    expect(() => confirmQuestionLines(6)).toThrow(RangeError)
  })
})

describe('layoutConfirm', () => {
  for (const n of [2, 3, 4, 5]) {
    it(`選択肢 ${n} 個で全部収まる`, () => {
      const l = layoutConfirm({ question: '中断しますか', options: Array.from({ length: n }, (_, i) => `選択${i}`), cursor: 1 })
      const all = [l.question, ...l.faces]
      expect(all.length).toBeLessThanOrEqual(6)
      expect(l.question.yPosition).toBe(32)
      expect(l.question.height!).toBeGreaterThanOrEqual(62)
      for (const f of all) expect(f.yPosition! + f.height!).toBeLessThanOrEqual(284)
      // 問いの枠 + 選択肢 + 間隔 = 本文枠の下端
      const last = l.faces[n - 1]!
      expect(last.yPosition! + last.height!).toBe(284)
      expect(l.faces[1]).toMatchObject({ borderColor: 15, textColor: 4 })
      expect(l.faces[0]).toMatchObject({ borderColor: 5, textColor: 2 })
    })
  }

  it('選択肢 6 個は container 数が上限を超えるので RangeError', () => {
    expect(() => layoutConfirm({ question: 'q', options: ['1', '2', '3', '4', '5', '6'], cursor: 0 })).toThrow(RangeError)
    expect(() => layoutConfirm({ question: 'q', options: [], cursor: 0 })).toThrow(RangeError)
  })

  it('問いが長いと末尾が … で、枠に収まる', () => {
    const l = layoutConfirm({ question: 'あ'.repeat(500), options: ['はい', 'いいえ', 'やめる'], cursor: 0 })
    const text = l.question.content!
    expect(text.endsWith('…')).toBe(true)
    const cap = Math.floor((l.question.height! - 8) / 27)
    expect(measureTextWrap(text, 548).lineCount).toBeLessThanOrEqual(cap)
  })

  it('問いの折り返しは内寸 − TEXT_SAFE_MARGIN (536) で数える', () => {
    // 'あ' x80 は 548 なら 3 行 (27 字/行) に収まるが、536 では 4 行になる。capacity 3 (選択肢 4 個) を超えるので切る
    const q = 'あ'.repeat(80)
    expect(measureTextWrap(q, 548).lineCount).toBe(3)
    const l = layoutConfirm({ question: q, options: ['1', '2', '3', '4'], cursor: 0 })
    const text = l.question.content!
    expect(text.endsWith('…')).toBe(true)
    expect(measureTextWrap(text, GLASS.CARD.INNER_W - GLASS.TEXT_SAFE_MARGIN).lineCount).toBeLessThanOrEqual(3)
  })

  it('選択肢の文字も内寸 − 12 で切る', () => {
    const l = layoutConfirm({ question: 'q', options: ['あ'.repeat(27)], cursor: 0 }) // 540px
    expect(pixelWidth(l.faces[0]!.content!)).toBeLessThanOrEqual(536)
    expect(l.faces[0]!.content!.endsWith('…')).toBe(true)
  })

  it('短い問いはそのまま', () => {
    const l = layoutConfirm({ question: '削除しますか', options: ['はい', 'いいえ'], cursor: 0 })
    expect(l.question.content).toBe('削除しますか')
  })
})
