import { TextContainerProperty } from '@evenrealities/even_hub_sdk'
import { truncateByPixelWidth } from '../text/index.ts'
import { GLASS } from './tokens.ts'

const F = GLASS.FACE

/** 1 項目 1 枠の高さ = ceil(行数 * 27 + 8)。1 行 35 / 2 行 62 / 3 行 89 / 8 行 224。 */
export function faceHeight(lines: number): number {
  return Math.ceil(lines * F.LINE_H + F.FRAME_H)
}

/** 一覧と同じ見た目の 1 枠 (選択: 枠 15 / 文字 4、非選択: 枠 5 / 文字 2)。確認の選択肢も使う。 */
export function face(
  id: number,
  name: string,
  y: number,
  lines: readonly string[],
  selected: boolean,
  /** 非選択行の textColor を上書きする (選択行には効かない)。省略時は標準値 */
  rowTextColor?: number,
): TextContainerProperty {
  const look = selected ? F.SELECTED : F.ROW
  return new TextContainerProperty({
    containerID: id,
    containerName: name,
    xPosition: F.X,
    yPosition: y,
    width: F.W,
    height: faceHeight(lines.length),
    borderWidth: F.BORDER,
    borderColor: look.borderColor,
    borderRadius: F.RADIUS,
    paddingLength: F.PADDING,
    isEventCapture: 0,
    textColor: !selected && rowTextColor !== undefined ? rowTextColor : look.textColor,
    content: lines.join('\n'),
  })
}

export type ListInput<T> = {
  items: readonly T[]
  cursor: number
  /** 前回の pageStart。選択行が今のページに収まらなければ切り替えて返す */
  pageStart: number
  /** 選択行の行配列 (title・meta・本文…)。9 行以上なら上から 8 行を残す */
  renderSelected: (item: T) => string[]
  /** 他の行の 1 行。幅を超えたら `…` で切る */
  renderRow: (item: T) => string
  /** 最初の container ID。既定 3 (GLASS.ID.BASE) */
  idBase?: number
  /** 1 ページに出す表示面の上限 (1〜6)。既定 GLASS.FACE_MAX。範囲外は RangeError */
  maxFaces?: number
  /** 非選択行の textColor (0〜4) を項目ごとに上書きする。選択行には効かない。既定 GLASS.FACE.ROW.textColor */
  rowTextColor?: (item: T) => number
}

export type ListLayout = {
  faces: TextContainerProperty[]
  pageStart: number
  /** 最後に表示した項目の次の添字 (排他的) */
  pageEnd: number
}

/**
 * 一覧を組む。ページの切り替えは「選択行が今のページに収まるか」だけで決める:
 * - pageStart から詰めた窓に選択行が入る → pageStart のまま (選択行の高さ込みで詰める)
 * - 窓の下に出た → 選択行を先頭にしたページへ切り替える
 * - 窓の上に出た → 選択行を末尾にして後ろから詰めたページへ切り替える
 * 項目ごとに選択時の行数が違っても、1 行ずつ流れることはない。返す pageStart を state に戻す。
 * 選択行が 9 行以上のときは上から 8 行を残し、`…` は付けない (実装者裁量)。
 */
export function layoutList<T>(o: ListInput<T>): ListLayout {
  const maxFaces = o.maxFaces ?? GLASS.FACE_MAX
  if (!Number.isInteger(maxFaces) || maxFaces < 1 || maxFaces > GLASS.FACE_MAX) {
    throw new RangeError(`maxFaces は 1〜${GLASS.FACE_MAX} の整数 (受け取った値: ${maxFaces})`)
  }
  const n = o.items.length
  if (n === 0) return { faces: [], pageStart: 0, pageEnd: 0 }
  const cursor = Math.min(Math.max(o.cursor, 0), n - 1)
  const idBase = o.idBase ?? GLASS.ID.BASE

  const textW = F.INNER_W - GLASS.TEXT_SAFE_MARGIN
  const selLines = o.renderSelected(o.items[cursor]!)
    .slice(0, F.MAX_LINES)
    .map((l) => truncateByPixelWidth(l, textW))
  if (selLines.length === 0) selLines.push('')
  const heightOf = (i: number): number => (i === cursor ? faceHeight(selLines.length) : faceHeight(1))

  // start から詰めて、入った最後の次の添字を返す
  const endFrom = (start: number): number => {
    let y: number = F.TOP
    let i = start
    while (i < n && i - start < maxFaces) {
      const h = heightOf(i)
      if (y + h > F.BOTTOM) break
      y += h + F.GAP
      i++
    }
    return i
  }
  // end の手前から後ろへ詰めて、入った先頭の添字を返す
  const startBefore = (end: number): number => {
    let y: number = F.TOP
    let i = end
    while (i > 0 && end - i < maxFaces) {
      const h = heightOf(i - 1)
      if (y + h > F.BOTTOM) break
      y += h + F.GAP
      i--
    }
    return i
  }

  let start = Math.min(Math.max(o.pageStart, 0), n - 1)
  if (cursor < start) start = startBefore(cursor + 1)
  else if (cursor >= endFrom(start)) start = cursor
  const end = endFrom(start)

  const faces: TextContainerProperty[] = []
  let y: number = F.TOP
  for (let i = start; i < end; i++) {
    const sel = i === cursor
    const lines = sel ? selLines : [truncateByPixelWidth(o.renderRow(o.items[i]!), textW)]
    const slot = i - start
    let color: number | undefined
    if (!sel && o.rowTextColor) {
      color = o.rowTextColor(o.items[i]!)
      if (!Number.isInteger(color) || color < 0 || color > 4) {
        throw new RangeError(`rowTextColor は 0〜4 の整数 (受け取った値: ${color})`)
      }
    }
    faces.push(face(idBase + slot, `face${slot}`, y, lines, sel, color))
    y += heightOf(i) + F.GAP
  }
  return { faces, pageStart: start, pageEnd: end }
}
