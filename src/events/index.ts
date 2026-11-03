/**
 * SDK イベントの正規化。**「SDK event 1 個 → 正規化 1 個」まで**で、
 * 画面の意味付け (Input / gesture / 直呼び) はアプリに残す。
 *
 * 自作アプリごとのイベント処理は、読み順・cooldown・9/10 の扱い・離脱の扱いが全部違っていた。
 * ここではそれを**潰さない** — 差は全部引数で受ける:
 *
 * - 読み順 → `readEventType(ev, spec)` / `classify(ev, spec)` の {@link EventReadSpec}
 * - cooldown → `createScrollGate(cooldownMs)` に関数で渡す (定数 350 / 設定値 / 0)
 * - 9/10 の意味と離脱の束ね方 → `classify` は素の 11 種を返すだけ。
 *   `hold`/`release` をどう使うか、`abnormal`/`system_exit` を 1 つに束ねるかはアプリ
 *
 * 罠:
 * - `CLICK_EVENT(0)` は protobuf で `eventType` が undefined になる → `??` で補完
 * - 実機のスワイプ多重発火は cooldown で潰す。simulator では再現しない
 * - `menuItemClickEvent` は他の系統に入らないので最初に見る (SDK 0.0.14)
 * - OS メニューは**開くと `FOREGROUND_ENTER(4)`、閉じると `FOREGROUND_EXIT(5)`** (直感と逆)
 */
import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'

/** `eventType` を載せうる系統。`EvenHubEvent` のキーに 1 対 1 で対応する。 */
export type EventCarrier = 'sys' | 'text' | 'list' | 'audio'

/**
 * `eventType` の読み方。**既存の自作アプリの読み方をそのまま書けるだけの自由度**を持たせてある。
 * 名前付きの 2 モード (`'sys-first'` / `'text-first'`) では表しきれず、
 * 55 通り中 10 通りで結果が割れていた (2026-09-07 のレビュー実測)。
 *
 * - `strategy: 'object-first'` — **系統優先**。`chain` の順に見て**最初に存在した系統**を採り、
 *   その `eventType ?? CLICK_EVENT` を返す。以前の自作アプリ
 *   (`ev.textEvent ?? ev.sysEvent` のように**オブジェクトを** `??` で選んでいた形)
 * - `strategy: 'event-type-first'` — **eventType 優先**。`chain` の順に見て
 *   **最初に `eventType` が定義されている系統**の値を返す。どれも定義していなければ、
 *   `chain` 上に系統が 1 つでもあれば `CLICK_EVENT`、無ければ `null`。
 *   以前の自作アプリ (`ev.sysEvent?.eventType ?? ev.textEvent?.eventType` の形)
 *
 * `chain` は**見る系統とその順**。`listEvent` を見ない実装や `audioEvent` まで見る実装があった — その差もここで表す。
 *
 */
export type EventReadSpec = {
  strategy: 'object-first' | 'event-type-first'
  chain: readonly EventCarrier[]
}

/** `eventType` を持ちうる系統の最小面 (`audioEvent` は SDK 型に `eventType` を持たない)。 */
type Carrier = { eventType?: OsEventTypeList }

function carrierOf(ev: EvenHubEvent, c: EventCarrier): Carrier | undefined {
  switch (c) {
    case 'sys':
      return ev.sysEvent
    case 'text':
      return ev.textEvent
    case 'list':
      return ev.listEvent
    case 'audio':
      return ev.audioEvent as Carrier | undefined
  }
}

/**
 * `eventType` を 1 個読む。`chain` 上に系統がひとつも無ければ `null`。
 *
 * `menuItemClickEvent` は**見ない** (別系統なので {@link classify} が先に捌く)。
 * `audioEvent` も既定では見ないが、`chain` に `'audio'` を入れれば `audioEvent` まで見る順になる
 * (`classify` は `audioEvent` を先に `'audio'` にするので、classify 経由では効かない)。
 */
export function readEventType(ev: EvenHubEvent, spec: EventReadSpec): OsEventTypeList | null {
  if (spec.strategy === 'object-first') {
    for (const c of spec.chain) {
      const carrier = carrierOf(ev, c)
      if (carrier) return carrier.eventType ?? OsEventTypeList.CLICK_EVENT
    }
    return null
  }
  let present = false
  for (const c of spec.chain) {
    const carrier = carrierOf(ev, c)
    if (!carrier) continue
    present = true
    if (carrier.eventType !== undefined) return carrier.eventType
  }
  return present ? OsEventTypeList.CLICK_EVENT : null
}

/** 正規化した種別。**ここまでが kit の担当**で、意味付けはアプリ。 */
export type EventKind =
  | 'tap'
  | 'double'
  | 'up'
  | 'down'
  | 'hold'
  | 'release'
  | 'fg_enter'
  | 'fg_exit'
  | 'abnormal'
  | 'system_exit'
  | 'audio'
  | 'menu'
  | 'unknown'

export type Classified = {
  kind: EventKind
  /** `kind === 'menu'` のときの項目 ID。**protobuf で 0 が undefined に潰れるので素通し** —
   *  `?? 0` に落とすか無視するかはアプリが決める。 */
  itemID?: number
  /** 元のイベント。アプリが `eventSource` 等を追加で見るため。 */
  raw: EvenHubEvent
}

/**
 * SDK イベント 1 個 → 正規化 1 個。分岐の順は
 * menu → audio → eventType。表に無い eventType (`IMU_DATA_REPORT(8)` を含む) は `unknown`。
 *
 * `spec` は**必須** — 「よい既定値」を置かないため。
 */
export function classify(ev: EvenHubEvent, spec: EventReadSpec): Classified {
  if (ev.menuItemClickEvent) {
    return { kind: 'menu', itemID: ev.menuItemClickEvent.itemID, raw: ev }
  }
  // 音声 PCM は voice が別経路で受ける
  if (ev.audioEvent) return { kind: 'audio', raw: ev }

  const eventType = readEventType(ev, spec)
  if (eventType === null) return { kind: 'unknown', raw: ev }

  switch (eventType) {
    case OsEventTypeList.CLICK_EVENT:
      return { kind: 'tap', raw: ev }
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      return { kind: 'double', raw: ev }
    case OsEventTypeList.SCROLL_TOP_EVENT:
      return { kind: 'up', raw: ev }
    case OsEventTypeList.SCROLL_BOTTOM_EVENT:
      return { kind: 'down', raw: ev }
    // 長押し (SDK 0.0.14 + Even App 2.2.9)。押した 9 / 離した 10 の 2 発だけ
    case OsEventTypeList.LONG_PRESS_EVENT:
      return { kind: 'hold', raw: ev }
    case OsEventTypeList.LONG_PRESS_RELEASE_EVENT:
      return { kind: 'release', raw: ev }
    case OsEventTypeList.FOREGROUND_ENTER_EVENT:
      return { kind: 'fg_enter', raw: ev }
    case OsEventTypeList.FOREGROUND_EXIT_EVENT:
      return { kind: 'fg_exit', raw: ev }
    case OsEventTypeList.ABNORMAL_EXIT_EVENT:
      return { kind: 'abnormal', raw: ev }
    case OsEventTypeList.SYSTEM_EXIT_EVENT:
      return { kind: 'system_exit', raw: ev }
    default:
      return { kind: 'unknown', raw: ev }
  }
}

/** スワイプの多重発火よけ。 */
export type ScrollGate = {
  /** 通してよければ true (通した時刻を控える)。cooldown 中なら false。 */
  allow(nowMs: number): boolean
  /** テスト用。控えた時刻を捨てる。 */
  reset(): void
}

/**
 * cooldown のゲート。**間隔は毎回 `cooldownMs()` で読み直す** — ユーザー設定の実装、
 * 定数 350 の実装、0 (= 素通し) の実装があったから。
 *
 * 時計は持たない。`nowMs` は呼び側が渡す。
 */
export function createScrollGate(cooldownMs: () => number): ScrollGate {
  let lastAt = 0
  return {
    allow(nowMs: number): boolean {
      if (nowMs - lastAt < cooldownMs()) return false
      lastAt = nowMs
      return true
    },
    reset(): void {
      lastAt = 0
    },
  }
}
