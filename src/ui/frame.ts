import { TextContainerProperty } from '@evenrealities/even_hub_sdk'
import { pixelWidth, truncateByPixelWidth } from '../text/index.ts'
import { GLASS } from './tokens.ts'

export type CardOpts = {
  /** 既定 CARD.Y (32) */
  y?: number
  /** 既定 CARD.H (252)。確認・ヒントで縮めるときに渡す */
  h?: number
  /** 既定 CARD.BORDER_COLOR (15)。textColor は SDK 既定 (4) */
  borderColor?: number
  textColor?: number
}

/** 本文枠 (x8 y32 w560 h252、border 2 / 15 / radius 12 / padding 4)。 */
export function card(
  id: number,
  name: string,
  text: string,
  opts: CardOpts = {},
): TextContainerProperty {
  return new TextContainerProperty({
    containerID: id,
    containerName: name,
    xPosition: GLASS.CARD.X,
    yPosition: opts.y ?? GLASS.CARD.Y,
    width: GLASS.CARD.W,
    height: opts.h ?? GLASS.CARD.H,
    borderWidth: GLASS.CARD.BORDER,
    borderColor: opts.borderColor ?? GLASS.CARD.BORDER_COLOR,
    borderRadius: GLASS.CARD.RADIUS,
    paddingLength: GLASS.CARD.PADDING,
    isEventCapture: 0,
    ...(opts.textColor !== undefined ? { textColor: opts.textColor } : {}),
    content: text,
  })
}

/** 本文枠の下端の 1 行ヒント。本文枠は `card(..., { h: GLASS.HINT.CARD_H })` で縮めて併用する。 */
export function hintLine(id: number, text: string): TextContainerProperty {
  return new TextContainerProperty({
    containerID: id,
    containerName: 'hint',
    xPosition: GLASS.HINT.X,
    yPosition: GLASS.HINT.Y,
    width: GLASS.HINT.W,
    height: GLASS.HINT.H,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    isEventCapture: 0,
    textColor: GLASS.HINT.TEXT_COLOR,
    content: truncateByPixelWidth(text, GLASS.HINT.W),
  })
}

export type Box = { x: number; y: number; w: number; h: number }

/**
 * 箱の中央に置く 1 行の label。SDK に text-align が無く、空白でずらす（先頭の改行・全角空白）のは
 * 禁止なので、文字の実測幅ぴったり (+ GLASS.LABEL.PAD) の
 * container を作り、x・y を計算して箱の中央に置く。
 * 読み込み中の画面は 本文枠 (中身は空) + 中央の label の 2 枚で組む。
 */
export function centeredLabel(id: number, name: string, text: string, box: Box): TextContainerProperty {
  const w = Math.ceil(pixelWidth(text)) + GLASS.LABEL.PAD
  const h = GLASS.FACE.LINE_H
  return new TextContainerProperty({
    containerID: id,
    containerName: name,
    xPosition: box.x + Math.round((box.w - w) / 2),
    yPosition: box.y + Math.round((box.h - h) / 2),
    width: w,
    height: h,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    isEventCapture: 0,
    content: text,
  })
}

/**
 * 入力受け (ID 1)。全面 x0 y0 w576 h288、枠 0、content は空。画面の最背面で、isEventCapture 1 は全画面でこの 1 枚だけ。
 * 中身が空なので、スワイプで文字が弾むことが無い。消灯・空・読み込み中でも同じ形で残す。
 */
export function overlay(): TextContainerProperty {
  return new TextContainerProperty({
    containerID: GLASS.ID.OVERLAY,
    containerName: 'overlay',
    xPosition: 0,
    yPosition: 0,
    width: GLASS.SCREEN.W,
    height: GLASS.SCREEN.H,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    isEventCapture: 1,
    content: '',
  })
}

/** 使わない ID を埋める見えない面。content は半角空白 1 字 (空文字は contentLength=0 になる)、枠 0、入力を受けない。 */
function filler(id: number): TextContainerProperty {
  return new TextContainerProperty({
    containerID: id,
    containerName: `fill${id}`,
    xPosition: GLASS.FILLER.X,
    yPosition: GLASS.FILLER.Y,
    width: GLASS.FILLER.W,
    height: GLASS.FILLER.H,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    isEventCapture: 0,
    content: ' ',
  })
}

/**
 * text container の集合を全画面で ID 1〜8 の 8 枚に揃える。足りない ID は埋め草にする。
 * rebuild で枚数が減ると、消えた面に前の画面の文字が残る (消灯でも container の枚数を減らさない)。
 * アプリ側の `buildContainers` が SDK に渡す前に必ず通す。
 * ID が 1〜8 の外・重複なら RangeError。返す配列は ID 昇順 (overlay = 1 が先頭 = 最背面)。
 */
export function padToFixedSet(containers: readonly TextContainerProperty[]): TextContainerProperty[] {
  const byId = new Map<number, TextContainerProperty>()
  for (const c of containers) {
    const id = c.containerID ?? 0
    if (!Number.isInteger(id) || id < 1 || id > GLASS.TEXT_MAX) {
      throw new RangeError(`containerID は 1〜${GLASS.TEXT_MAX} (受け取った値: ${id})`)
    }
    if (byId.has(id)) throw new RangeError(`containerID ${id} が重複している`)
    byId.set(id, c)
  }
  const out: TextContainerProperty[] = []
  for (let id = 1; id <= GLASS.TEXT_MAX; id++) out.push(byId.get(id) ?? filler(id))
  return out
}
