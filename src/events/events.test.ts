/**
 * events のテスト:
 *   1. `classify` の表テスト — eventType 0〜10 × `sysEvent` / `textEvent` / `listEvent`
 *   2. `createScrollGate` のゲート (fake timer)
 *   3. 系統優先 (object-first) と eventType 優先 (event-type-first) で結果が変わる実例
 */
import { describe, expect, it, vi } from 'vitest'
import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import {
  classify,
  createScrollGate,
  readEventType,
  type EventKind,
  type EventReadSpec,
} from './index.ts'

/** 宿主から来る生の形を組む。SDK のクラス型 (toJson 付き) を満たす必要はない。 */
const ev = (e: Record<string, unknown>): EvenHubEvent => e as unknown as EvenHubEvent

/** `sysEvent ?? textEvent ?? listEvent` を選んで `?? CLICK` する読み。 */
const SYS_FIRST: EventReadSpec = { strategy: 'object-first', chain: ['sys', 'text', 'list'] }
/** `textEvent` 先で `audioEvent` を除いた読み (`classify` は audio を先に捌く)。 */
const TEXT_FIRST: EventReadSpec = { strategy: 'object-first', chain: ['text', 'list', 'sys'] }

/** 系統優先 / eventType 優先それぞれの読み順の例。 */
const SPECS = {
  textFirstWithAudio: { strategy: 'object-first', chain: ['text', 'list', 'audio', 'sys'] },
  sysFirstNoAudio: { strategy: 'object-first', chain: ['sys', 'text', 'list'] },
  eventTypeFirst: { strategy: 'event-type-first', chain: ['sys', 'text'] },
  textFirstNoList: { strategy: 'object-first', chain: ['text', 'sys'] },
} as const satisfies Record<string, EventReadSpec>

/** `OsEventTypeList` 0〜10 と正規化後の種別の対応 (`8` = IMU なのでアプリの入力ではない)。 */
const TABLE: ReadonlyArray<[OsEventTypeList, EventKind]> = [
  [OsEventTypeList.CLICK_EVENT, 'tap'],
  [OsEventTypeList.SCROLL_TOP_EVENT, 'up'],
  [OsEventTypeList.SCROLL_BOTTOM_EVENT, 'down'],
  [OsEventTypeList.DOUBLE_CLICK_EVENT, 'double'],
  [OsEventTypeList.FOREGROUND_ENTER_EVENT, 'fg_enter'],
  [OsEventTypeList.FOREGROUND_EXIT_EVENT, 'fg_exit'],
  [OsEventTypeList.ABNORMAL_EXIT_EVENT, 'abnormal'],
  [OsEventTypeList.SYSTEM_EXIT_EVENT, 'system_exit'],
  [OsEventTypeList.IMU_DATA_REPORT, 'unknown'],
  [OsEventTypeList.LONG_PRESS_EVENT, 'hold'],
  [OsEventTypeList.LONG_PRESS_RELEASE_EVENT, 'release'],
]

const CARRIERS = ['sysEvent', 'textEvent', 'listEvent'] as const

describe('classify の表 (eventType 0〜10 × sysEvent / textEvent / listEvent)', () => {
  it('11 行 × 3 系統 × 2 読み順すべてが表どおり (系統が 1 つなら読み順で変わらない)', () => {
    for (const carrier of CARRIERS) {
      for (const [eventType, kind] of TABLE) {
        const e = ev({ [carrier]: { eventType } })
        expect(classify(e, SYS_FIRST).kind, `${carrier} ${eventType} sys-first`).toBe(kind)
        expect(classify(e, TEXT_FIRST).kind, `${carrier} ${eventType} text-first`).toBe(kind)
        expect(readEventType(e, SYS_FIRST)).toBe(eventType)
      }
    }
  })

  it('表は 0〜10 を隙間なく覆う', () => {
    expect(TABLE.map(([t]) => t)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('eventType 無しは CLICK に補完する (protobuf の 0 潰し)', () => {
    for (const carrier of CARRIERS) {
      const e = ev({ [carrier]: {} })
      expect(readEventType(e, SYS_FIRST)).toBe(OsEventTypeList.CLICK_EVENT)
      expect(classify(e, SYS_FIRST).kind).toBe('tap')
      expect(classify(e, TEXT_FIRST).kind).toBe('tap')
    }
  })

  it('系統がひとつも無ければ unknown / readEventType は null', () => {
    expect(readEventType(ev({}), SYS_FIRST)).toBeNull()
    expect(readEventType(ev({}), TEXT_FIRST)).toBeNull()
    expect(classify(ev({}), SYS_FIRST).kind).toBe('unknown')
  })

  it('menuItemClickEvent が最優先。itemID は素通し (0 も undefined も落とさない)', () => {
    const withId = ev({
      menuItemClickEvent: { itemID: 3 },
      sysEvent: { eventType: OsEventTypeList.FOREGROUND_ENTER_EVENT },
    })
    expect(classify(withId, SYS_FIRST)).toMatchObject({ kind: 'menu', itemID: 3 })
    // protobuf は 0 を undefined に潰す。`?? 0` を kit で当てないので undefined のまま出る
    expect(classify(ev({ menuItemClickEvent: {} }), SYS_FIRST)).toMatchObject({
      kind: 'menu',
      itemID: undefined,
    })
  })

  it('audioEvent は audio (PCM は voice が別経路で受ける)', () => {
    const e = ev({ audioEvent: { audioPcm: new Uint8Array(4) }, sysEvent: {} })
    expect(classify(e, SYS_FIRST).kind).toBe('audio')
    expect(classify(e, TEXT_FIRST).kind).toBe('audio')
  })

  it('raw は元のイベントをそのまま返す (eventSource 等をアプリが見るため)', () => {
    const e = ev({ sysEvent: { eventType: OsEventTypeList.CLICK_EVENT, eventSource: 2 } })
    expect(classify(e, SYS_FIRST).raw).toBe(e)
  })
})

describe('系統の順 (sys 先 / text 先) で結果が変わる実例', () => {
  it('textEvent が eventType なしで同梱されると FOREGROUND_EXIT(5) が CLICK に化ける', () => {
    // 実機で観測された形 (2026-08-26): container 由来の textEvent が
    // eventType なしで sysEvent に同梱される
    const mixed = ev({
      textEvent: { containerID: 1, containerName: 'overlay' },
      sysEvent: { eventType: OsEventTypeList.FOREGROUND_EXIT_EVENT },
    })
    expect(readEventType(mixed, SYS_FIRST)).toBe(OsEventTypeList.FOREGROUND_EXIT_EVENT)
    expect(readEventType(mixed, TEXT_FIRST)).toBe(OsEventTypeList.CLICK_EVENT)
    expect(classify(mixed, SYS_FIRST).kind).toBe('fg_exit')
    expect(classify(mixed, TEXT_FIRST).kind).toBe('tap')
  })

  it('strategy が違うと「sysEvent に eventType 無し + textEvent に有り」で割れる', () => {
    // 系統優先は CLICK に落ち、eventType 優先は 5 を採る
    const mixed = ev({
      sysEvent: { eventSource: 1 },
      textEvent: { containerID: 1, eventType: OsEventTypeList.FOREGROUND_EXIT_EVENT },
    })
    expect(readEventType(mixed, SPECS.sysFirstNoAudio)).toBe(OsEventTypeList.CLICK_EVENT)
    expect(readEventType(mixed, SPECS.eventTypeFirst)).toBe(OsEventTypeList.FOREGROUND_EXIT_EVENT)
  })

  it('chain が違うと listEvent だけのイベントで割れる (listEvent を chain に含めない読みでは null)', () => {
    const listOnly = ev({ listEvent: { eventType: OsEventTypeList.SCROLL_TOP_EVENT } })
    expect(readEventType(listOnly, SPECS.textFirstWithAudio)).toBe(OsEventTypeList.SCROLL_TOP_EVENT)
    expect(readEventType(listOnly, SPECS.textFirstNoList)).toBeNull()
  })
})

describe('createScrollGate', () => {
  it('cooldown 内の 2 発目を落とし、越えたら通す', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1_000_000)
      const gate = createScrollGate(() => 350)
      expect(gate.allow(Date.now())).toBe(true)
      vi.advanceTimersByTime(349)
      expect(gate.allow(Date.now())).toBe(false)
      vi.advanceTimersByTime(1)
      expect(gate.allow(Date.now())).toBe(true) // 通算 350ms
      vi.advanceTimersByTime(349)
      expect(gate.allow(Date.now())).toBe(false) // 直前に通した時刻から測る
    } finally {
      vi.useRealTimers()
    }
  })

  it('間隔は毎回読み直す (ユーザー設定が途中で変わる)', () => {
    let cooldown = 1000
    const gate = createScrollGate(() => cooldown)
    expect(gate.allow(10_000)).toBe(true)
    expect(gate.allow(10_500)).toBe(false)
    cooldown = 100
    expect(gate.allow(10_500)).toBe(true)
  })

  it('cooldown 0 は素通し (間隔 0 の設定)', () => {
    const gate = createScrollGate(() => 0)
    expect(gate.allow(10_000)).toBe(true)
    expect(gate.allow(10_000)).toBe(true)
    expect(gate.allow(10_000)).toBe(true)
  })

  it('reset で控えた時刻を捨てる', () => {
    const gate = createScrollGate(() => 350)
    expect(gate.allow(1000)).toBe(true)
    expect(gate.allow(1100)).toBe(false)
    gate.reset()
    expect(gate.allow(1100)).toBe(true)
  })
})
