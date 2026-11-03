import { measureTextWrap } from '@evenrealities/pretext'
import type { TextContainerProperty } from '@evenrealities/even_hub_sdk'
import { truncateByPixelWidth } from '../text/index.ts'
import { card } from './frame.ts'
import { face, faceHeight } from './list.ts'
import { GLASS } from './tokens.ts'

export type ConfirmInput = {
  question: string
  options: readonly string[]
  cursor: number
  /** 問いの枠の container ID。選択肢は続く連番。既定 3 (GLASS.ID.BASE) */
  idBase?: number
}

export type ConfirmLayout = {
  question: TextContainerProperty
  faces: TextContainerProperty[]
}

/** 問い + 選択肢の合計で表示面が FACE_MAX (6) に収まる上限 */
export const CONFIRM_MAX_OPTIONS = GLASS.FACE_MAX - 1

/** 選択肢が n 個のときの問いの枠の高さと行数。n が範囲外なら RangeError */
function questionBox(n: number): { qH: number; capacity: number } {
  if (!Number.isInteger(n) || n < 1 || n > CONFIRM_MAX_OPTIONS) {
    throw new RangeError(`confirm の選択肢は 1〜${CONFIRM_MAX_OPTIONS} 個 (受け取った数: ${n})`)
  }
  const G = GLASS.FACE
  const optsH = n * faceHeight(1) + (n - 1) * G.GAP
  const qH = GLASS.CARD.H - optsH - G.GAP
  return { qH, capacity: Math.floor((qH - G.FRAME_H) / G.LINE_H) }
}

/** 選択肢が n 個 (1〜5) のときに問いへ使える行数。1/2/3/4/5 個で 7/6/4/3/2 行 */
export function confirmQuestionLines(optionCount: number): number {
  return questionBox(optionCount).capacity
}

/**
 * 確認画面。本文枠を上に縮めて問いを出し、その下に選択肢を一覧と同じ枠で縦に積む。
 * 問いの枠の高さ = 本文枠 h − (選択肢の高さの合計 + 間隔)。問いが入らなければ末尾を `…` にする。
 * 折り返し・切り詰めは内寸 − `TEXT_SAFE_MARGIN` (536)。
 * 選択肢は 5 個まで (問いの枠 1 + 選択肢 5 = 表示面 6 枚)。超えたら RangeError。
 */
export function layoutConfirm(o: ConfirmInput): ConfirmLayout {
  const n = o.options.length
  const G = GLASS.FACE
  const idBase = o.idBase ?? GLASS.ID.BASE
  const { qH, capacity } = questionBox(n)
  const margin = GLASS.TEXT_SAFE_MARGIN

  const question = card(idBase, 'question', fitLines(o.question, GLASS.CARD.INNER_W - margin, capacity), {
    h: qH,
  })
  const cursor = Math.min(Math.max(o.cursor, 0), n - 1)
  let y = GLASS.CARD.Y + qH + G.GAP
  const faces = o.options.map((opt, i) => {
    const f = face(idBase + 1 + i, `opt${i}`, y, [truncateByPixelWidth(opt, G.INNER_W - margin)], i === cursor)
    y += faceHeight(1) + G.GAP
    return f
  })
  return { question, faces }
}

/** capacity 行に収まるよう、入らなければ末尾を `…` にする。 */
function fitLines(text: string, innerW: number, capacity: number): string {
  if (measureTextWrap(text, innerW).lineCount <= capacity) return text
  const chars = Array.from(text)
  let lo = 0
  let hi = chars.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    const cand = chars.slice(0, mid).join('') + GLASS.GLYPH.ELLIPSIS
    if (measureTextWrap(cand, innerW).lineCount <= capacity) lo = mid
    else hi = mid - 1
  }
  return chars.slice(0, lo).join('') + GLASS.GLYPH.ELLIPSIS
}
