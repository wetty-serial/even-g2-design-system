/**
 * グラス画面デザインシステムの値 (`even-g2-design-system/ui`)。
 *
 * このライブラリは「既定値を置かない」方針だが、その例外: `ui` を使うこと自体が「標準の見た目にする」選択。
 */
import type { Lang } from '../i18n/index.ts'

export const GLASS = {
  SCREEN: { W: 576, H: 288 },
  TOP_H: 28,

  /**
   * container ID の割り当て。overlay 1 (入力受け。中身は空) / header 2 / 表示面は 3 から連番 /
   * right 8 ('two' のときだけ。'one' では表示面が 8 まで使える)
   */
  ID: { OVERLAY: 1, HEADER: 2, BASE: 3, RIGHT: 8 },

  HEADER: { X: 12, Y: 0, H: 28, TEXT_COLOR: 3 },
  /** 右端 x = 564 (header の x12 と左右対称)。幅 = pixelWidth(数字を '4' に置換した内容) + PAD */
  RIGHT: { EDGE_X: 564, Y: 0, H: 28, TEXT_COLOR: 3, PAD: 4 },
  /** header の w = right の x − HEADER.X − GAP */
  TOP_GAP: 8,

  /** 本文枠。内寸 548 × 240 → 8 行 */
  CARD: {
    X: 8,
    Y: 32,
    W: 560,
    H: 252,
    BORDER: 2,
    BORDER_COLOR: 15,
    RADIUS: 12,
    PADDING: 4,
    INNER_W: 548,
    INNER_H: 240,
    MAX_LINES: 8,
  },

  /** 一覧の 1 項目 1 枠。高さ = ceil(行数 * LINE_H + FRAME_H) */
  FACE: {
    X: 8,
    W: 560,
    BORDER: 2,
    RADIUS: 12,
    PADDING: 2,
    LINE_H: 27,
    FRAME_H: 8,
    GAP: 3,
    TOP: 32,
    BOTTOM: 284,
    INNER_W: 548,
    MAX_LINES: 8,
    SELECTED: { borderColor: 15, textColor: 4 },
    ROW: { borderColor: 5, textColor: 2 },
  },
  /** overlay + header + 6 = 8 (text container の上限)。'one' のとき 6。'two' は right (ID 8) があるので 5 */
  FACE_MAX: 6,

  /** text container は全画面で ID 1〜8 の 8 枚に揃える (`padToFixedSet`)。使わない ID は埋め草にする */
  TEXT_MAX: 8,
  /** 埋め草の矩形。位置は固定 (裁量なし) */
  FILLER: { X: 12, Y: 0, W: 552, H: 28 },
  /**
   * 空白の送り幅 (px)。'one' の上段が位置・時計を右へ送るのに使う。simulator の描画実測で、
   * pretext は半角を 5 と返すので pad の計算には使わない
   */
  SPACE: { FULL: 20, HALF: 16 / 3 },
  /** 中央寄せの label (`centeredLabel`)。幅 = 実測幅 + PAD (実測との誤差で折り返さないための余白) */
  LABEL: { PAD: 4 },

  CONFIRM: { MIN_QUESTION_LINES: 2 },

  /**
   * 折り返し・切り詰めの幅は「内寸 − この値」(本文枠・一覧の枠とも 548 − 12 = 536)。
   * pretext の見積もりは実機より狭く、内寸ちょうどで折ると実機で再折り返しされる (以前の自作アプリの実機での観測)。
   * `centeredLabel` は幅を文字の実測から決めるので対象外
   */
  TEXT_SAFE_MARGIN: 12,

  /** 本文枠を H に縮め、その下に 1 行 */
  HINT: { CARD_H: 220, X: 12, Y: 256, W: 552, H: 28, TEXT_COLOR: 2 },

  IMAGE: { W: 400, H: 200, X: 88, Y: 58 },

  BAR: { CELLS: 10, FILLED: '━', EMPTY: '─' },

  TIMING: {
    swipeGate: 350,
    tapGuard: 200,
    /** 確認画面のタップを捨てる時間。確認画面を描き終えた時点から数える (起点はアプリ側) */
    confirmTapGuard: 600,
    holdRepeat: 400,
    holdRepeatMax: 60,
    holdRepeatTimeout: 30_000,
    toast: 1500,
    unhideGrace: 1500,
    retry: 30_000,
    hintCount: 3,
  },

  GLYPH: {
    RUNNING: '●',
    IDLE: '○',
    ATTENTION: '◆',
    DONE: '─',
    PIN: '★',
    MORE_UP: '▲',
    MORE_DOWN: '▼',
    ELLIPSIS: '…',
  },

  SEP: { item: '　', pos: '　' },
} as const

/** 消灯からの復帰後、この間は消灯しない (判定はアプリ側の hideScreen の手前) */
export const UNHIDE_GRACE_MS = GLASS.TIMING.unhideGrace

/** 確認画面を描き終えてから、この間のタップを捨てる (連打・タップの連鎖が確定まで貫通するのを防ぐ) */
export const CONFIRM_TAP_GUARD_MS = GLASS.TIMING.confirmTapGuard

export type Words = {
  loading: string
  end: string
  offline: string
  retry: string
  fetchFailed: string
  empty: string
}

export const WORDS: Record<Lang, Words> = {
  ja: {
    loading: '読み込み中…',
    end: 'これ以上ありません',
    offline: '未接続',
    retry: 'タップで再試行',
    fetchFailed: '取得に失敗',
    empty: '該当なし',
  },
  en: {
    loading: 'Loading…',
    end: 'No more',
    offline: 'Offline',
    retry: 'Tap to retry',
    fetchFailed: 'Failed to load',
    empty: 'Nothing here',
  },
}
