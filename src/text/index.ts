/**
 * グラス描画の純粋計算関数 (`even-g2-design-system/text`)。
 *
 * 出自は既存の自作アプリの描画計算。
 * **関数の本体は 1 文字も変えずに移してある**。
 *
 * G2 の LVGL フォントは proportional。文字数 truncate は必ず溢れるので、
 * 表示に載せるテキストは全部ここの pixel 幅ベース関数を通す。
 */

import { getTextWidth } from '@evenrealities/pretext'

export const SCREEN_PX = 576
export const FW_SPACE_PX = 20 // U+3000

/**
 * 文字列の表示幅 (px)。
 *
 * **公式の `@evenrealities/pretext` に委譲する。自前の文字幅テーブルを持たない。**
 * LVGL フォントは proportional なうえ **カーニングがある**ので、1 文字ずつの幅を
 * 足し合わせる方式では原理的に正しく測れない (同じ `A` でも `AA` と `An` で送りが違う)。
 * 2026-08-07 に自前テーブルを実測で作ったが、同一文字の連続で測ったため
 * その組み合わせのカーニングを焼き込んでしまい、実文字列で最大 23px ずれた。
 *
 * simulator が実際に描いた幅の実測では、pretext と 173/200 が ±0.6px で一致した。
 *
 * **pretext の盲点**: glyph が無い文字にも 4px を返す。実際の描画は 0px (何も出ない)。
 * どの文字が表示できるかは pretext では分からないので、実機・simulator で確かめること。
 */
export function pixelWidth(s: string): number {
  return getTextWidth(s)
}

/** pixel 幅で truncate (list / menu の 1 行用)。超過したら末尾を `…` に置換。
 *
 *  幅の計算は公式 `getTextWidth` に任せるが、切り詰めは自前で持つ。
 *  公式の `pxTruncate` は末尾が **`...` (ASCII 3 点)** で、既存 UI の `…` (1 文字) と
 *  見た目も幅も変わってしまうため (`...` は 15px、`…` は 10px)。 */
export function truncateByPixelWidth(text: string, maxPx: number): string {
  if (getTextWidth(text) <= maxPx) return text
  const chars = Array.from(text)
  const budget = maxPx - getTextWidth('…')
  let lo = 0
  let hi = chars.length
  // カーニングがあるので 1 文字ずつの加算では測れない。都度全体を測って二分探索する
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (getTextWidth(chars.slice(0, mid).join('')) <= budget) lo = mid
    else hi = mid - 1
  }
  return chars.slice(0, lo).join('') + '…'
}

/** UTF-16 サロゲート境界を尊重した文字数 truncate (絵文字を半分で切らない) */
export function truncateChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return Array.from(text).slice(0, maxChars).join('')
}

/** byte 長 (text container 999 byte 上限チェック用)。 */
export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

/** text container の 999 byte 上限に収める。
 *  byte 超過分を文字単位で末尾から落とす。日本語は 3byte/char なので ~333 char が上限。 */
export function clampToBytes(text: string, maxBytes: number): string {
  if (byteLength(text) <= maxBytes) return text
  let out = ''
  let bytes = 0
  for (const c of text) {
    const cb = byteLength(c)
    if (bytes + cb > maxBytes) break
    out += c
    bytes += cb
  }
  return out
}
