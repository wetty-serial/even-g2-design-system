import { TextContainerProperty } from '@evenrealities/even_hub_sdk'
import type { Lang } from '../i18n/index.ts'
import { pixelWidth, truncateByPixelWidth } from '../text/index.ts'
import { overlay } from './frame.ts'
import { GLASS, WORDS } from './tokens.ts'
import { position, progressBar } from './progress.ts'

export type TopBarInput = {
  /**
   * 'one' = header 1 枚に「題名 + 空白 + 位置・時計」(`layoutList` / `layoutConfirm` を使う画面。表示面は最大 6)。
   * 'two' = header + right の 2 枚 (本文枠の画面。表示面は最大 5、ID 8 は right)。
   * 画面の種類で決める。空・読み込み中・エラーなど状態では変えない。
   */
  layout: 'one' | 'two'
  /** header の文字 (画面名・一時通知・エラー)。幅に収まらなければ `…` で切る */
  left: string
  /** 位置 `03/24`。index は表示する番号 (1 始まり) */
  pos?: { index: number; total: number }
  /** 進捗バー。done は現在ページ (1 始まり) */
  bar?: { done: number; total: number }
  offline: boolean
  /** `HH:MM` */
  clock: string
  lang?: Lang
  /** header と right の textColor (0〜4)。既定 GLASS.HEADER.TEXT_COLOR / GLASS.RIGHT.TEXT_COLOR。範囲外は RangeError。'one' の header は GLASS.HEADER.TEXT_COLOR */
  textColor?: number
}

export type TopBar = {
  /** 'one' → [overlay, header]。'two' → [overlay, header, right]。アプリは `[...bar.containers, ...rest]` を padToFixedSet に通す */
  containers: TextContainerProperty[]
  /** 幅が変わる要素の組。layoutKey に混ぜて rebuild / upgrade を判定する */
  shapeKey: string
}

/**
 * 上段の形を表示面の枚数で決める。maxFaces = 今のデータでその画面が使いうる表示面の最大枚数
 * (一覧は項目数、確認は 1 + 選択肢の数。カーソル位置では数えない)。6 以上なら 'one'、5 以下なら 'two'。
 */
export function topLayout(maxFaces: number): 'one' | 'two' {
  return maxFaces >= GLASS.FACE_MAX ? 'one' : 'two'
}

/**
 * gap (px) を全角空白 f 個 + 半角空白 h 個 (この順) で埋める。
 * `|20f + h·16/3 − gap|` が最小の (f, h)、同点なら f + h が小さい方。gap ≤ 0 は半角 1 個。
 * 送り幅は GLASS.SPACE (simulator 実測)。pretext は半角を 5 と返すので pad の計算に使わない。
 */
export function fillGap(gap: number): string {
  if (gap <= 0) return ' '
  const { FULL, HALF } = GLASS.SPACE
  let best = { f: 0, h: 0, err: Infinity }
  // 半角 15 個 = 全角 4 個なので、h は 0〜14 で全ての余りを尽くす
  for (let h = 0; h < 15; h++) {
    const f = Math.max(0, Math.round((gap - HALF * h) / FULL))
    for (const ff of [f, f + 1]) {
      const err = Math.abs(FULL * ff + HALF * h - gap)
      if (err < best.err - 1e-9 || (Math.abs(err - best.err) <= 1e-9 && ff + h < best.f + best.h)) {
        best = { f: ff, h, err }
      }
    }
  }
  return '　'.repeat(best.f) + ' '.repeat(best.h)
}

/**
 * 上段。入力受け (isEventCapture 1) は中身が空の overlay (ID 1) だけで、header・right は 0。
 * 入力受けの text container は中身がスワイプのたびに上下に弾むので、文字を持つ枠には持たせない。
 * right の内容 = `[未接続　][━━━───── ][03/24　]14:32`。
 * 幅は数字を '4' に置き換えて測るので、時刻・位置の数字だけが変わるときは同じ幅 (= upgrade で済む)。
 * 'one' は header 1 枚に `題名 + 空白 + right の内容` をまとめる。SDK に右寄せが無く、空白で右へ送るので
 * 位置・時計の x は題名によって simulator で最大 3px ずれる。
 */
export function topBar(o: TopBarInput): TopBar {
  const lang = o.lang ?? 'ja'
  if (o.textColor !== undefined && (!Number.isInteger(o.textColor) || o.textColor < 0 || o.textColor > 4)) {
    throw new RangeError(`textColor は 0〜4 の整数 (受け取った値: ${o.textColor})`)
  }
  const content =
    (o.offline ? WORDS[lang].offline + GLASS.SEP.item : '') +
    (o.bar ? progressBar(o.bar.done, o.bar.total) + ' ' : '') +
    (o.pos ? position(o.pos.index, o.pos.total) + GLASS.SEP.pos : '') +
    o.clock

  const rightW = Math.ceil(pixelWidth(content.replace(/\d/g, '4'))) + GLASS.RIGHT.PAD
  const rightX = GLASS.RIGHT.EDGE_X - rightW
  const headerW = rightX - GLASS.HEADER.X - GLASS.TOP_GAP
  const left = truncateByPixelWidth(o.left, headerW)
  const tc = o.textColor === undefined ? '' : `t${o.textColor}`
  const textColor = o.textColor ?? GLASS.HEADER.TEXT_COLOR

  if (o.layout === 'one') {
    const gap = rightX - GLASS.HEADER.X - pixelWidth(left)
    const header = new TextContainerProperty({
      containerID: GLASS.ID.HEADER,
      containerName: 'header',
      xPosition: GLASS.HEADER.X,
      yPosition: GLASS.HEADER.Y,
      // 画面右端まで。空白の誤差で折り返して時計が消えないよう余裕を持たせる
      width: GLASS.SCREEN.W - GLASS.HEADER.X,
      height: GLASS.HEADER.H,
      borderWidth: 0,
      borderColor: 0,
      paddingLength: 0,
      isEventCapture: 0,
      textColor,
      content: left + fillGap(gap) + content,
    })
    return { containers: [overlay(), header], shapeKey: `L1${lang}${tc}` }
  }

  const header = new TextContainerProperty({
    containerID: GLASS.ID.HEADER,
    containerName: 'header',
    xPosition: GLASS.HEADER.X,
    yPosition: GLASS.HEADER.Y,
    width: headerW,
    height: GLASS.HEADER.H,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    isEventCapture: 0,
    textColor,
    content: left,
  })
  const right = new TextContainerProperty({
    containerID: GLASS.ID.RIGHT,
    containerName: 'right',
    xPosition: rightX,
    yPosition: GLASS.RIGHT.Y,
    width: rightW,
    height: GLASS.RIGHT.H,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    isEventCapture: 0,
    textColor: o.textColor ?? GLASS.RIGHT.TEXT_COLOR,
    content,
  })
  const shapeKey = `L2o${o.offline ? 1 : 0}b${o.bar ? 1 : 0}p${o.pos ? String(o.pos.total).length : 0}l${lang}${tc}`
  return { containers: [overlay(), header, right], shapeKey }
}
