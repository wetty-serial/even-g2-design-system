# 部品の API

`ui` の部品は、状態を受け取って SDK の container（`TextContainerProperty` / `MenuItemProperty`）か文字列を返す関数と、小さなタイマーです。SDK の bridge は呼びません。返した container を `rebuildPageContainer` / `textContainerUpgrade` で描画するのはアプリ側です。

引数を検証する部品では、文字色の範囲外や ID の重複などに対して `RangeError` を投げます。検証する項目は部品ごとに異なります。

## `even-g2-design-system/ui`

### 値

| export | 内容 |
|---|---|
| `GLASS` | 寸法・色・時間・記号の標準値（`as const`）。値は [layout.md](layout.md) と [interaction.md](interaction.md) |
| `WORDS` | 標準の文言（`ja` / `en`）。`loading` `end` `offline` `retry` `fetchFailed` `empty` |
| `UNHIDE_GRACE_MS` | 1500。表示を戻してから再び消さない時間 |
| `CONFIRM_TAP_GUARD_MS` | 600。確認画面を描き終えてからタップを捨てる時間（起点の管理はアプリ側） |
| `CONFIRM_MAX_OPTIONS` | 5 |
| `MENU_MAX` | 10 |

### 上段 `top.ts`

```ts
topLayout(maxFaces: number): 'one' | 'two'

topBar({
  layout: 'one' | 'two',
  left: string,                              // 題名・一時通知・エラー。幅を超えたら … で切る
  pos?: { index: number; total: number },    // index は 1 始まり
  bar?: { done: number; total: number },
  offline: boolean,
  clock: string,                             // 'HH:MM'
  lang?: 'ja' | 'en',
  textColor?: number,                        // 0〜4。header と right の両方
}): { containers: TextContainerProperty[]; shapeKey: string }

fillGap(gap: number): string                 // gap (px) を全角空白 + 半角空白で埋める
```

`containers` は `'one'` なら `[overlay, header]`、`'two'` なら `[overlay, header, right]` です。アプリは `[...bar.containers, ...表示面]` を `padToFixedSet()` に渡します。

### 枠 `frame.ts`

```ts
overlay(): TextContainerProperty                         // ID 1。入力受け
card(id, name, text, { y?, h?, borderColor?, textColor? }?): TextContainerProperty
hintLine(id, text): TextContainerProperty                // 本文枠の下の 1 行
centeredLabel(id, name, text, box: { x, y, w, h }): TextContainerProperty
padToFixedSet(containers): TextContainerProperty[]       // ID 1〜8 の 8 枚にそろえる
```

`padToFixedSet()` は ID の昇順で返します。ID の重複と範囲外は `RangeError` です。

### 一覧 `list.ts`

```ts
layoutList<T>({
  items: readonly T[],
  cursor: number,
  pageStart: number,                         // 前回返した値
  renderSelected: (item: T) => string[],     // 選択中の項目の行
  renderRow: (item: T) => string,            // ほかの項目の 1 行
  idBase?: number,                           // 既定 3
  maxFaces?: number,                         // 1〜6、既定 6
  rowTextColor?: (item: T) => number,        // ほかの項目の文字色を項目ごとに変える (0〜4)
}): { faces: TextContainerProperty[]; pageStart: number; pageEnd: number }

face(id, name, y, lines, selected, rowTextColor?): TextContainerProperty
faceHeight(lines: number): number           // ceil(lines * 27 + 8)
```

返した `pageStart` を状態に戻し、カーソルを動かしたら `cursor` だけ変えて呼び直します。項目が 0 件なら `faces` は空です。

### 確認 `confirm.ts`

```ts
layoutConfirm({ question, options, cursor, idBase? }):
  { question: TextContainerProperty; faces: TextContainerProperty[] }

confirmQuestionLines(optionCount: number): number   // 1〜5 個で 7/6/4/3/2
```

問いの ID は `idBase`、選択肢は `idBase + 1 + i` です。

### 進捗 `progress.ts`

```ts
progressBar(done: number, total: number): string    // ━ と ─ の 10 マス
position(index: number, total: number): string      // '03/24'
```

### 入力 `input.ts`

```ts
createInputPolicy({
  invert: () => boolean,
  swipeGateMs?: () => number,                // 既定 350
}): {
  accept(kind: EventKind, now: number): EventKind | null
  acceptWithReason(kind, now): { kind: EventKind | null; dropped: 'tap-guard' | 'swipe-gate' | null }
}
```

### 長押し `hold.ts`

```ts
createHoldRepeat({
  step: (dir: 'prev' | 'next') => boolean | Promise<boolean>,   // 動けなければ false
  key?: () => string,                                           // 画面が変わったら止める
}): { start(dir): void; stop(): void }
```

`intervalMs` / `maxCount` / `timeoutMs` はテスト用の上書きです。

### 一時通知・初回ヒント・再試行・メニュー

```ts
createToast({ onChange }): { show(text): void; current(): string | null }

createFirstRunHint({ kv, appKey }):
  { load(): Promise<void>; shouldShow(screen): boolean; seen(screen): Promise<void>; resetAll(): Promise<void> }

createRetry({ run: () => Promise<boolean>, onState: (s: 'idle' | 'waiting' | 'running') => void }):
  { fail(): void; tap(): void; stop(): void }

buildMenu({ common: MenuEntry[], screen: MenuEntry[] }): MenuItemProperty[]   // MenuEntry = { id, name }
```

`createFirstRunHint` の `kv` は `getLocalStorage` / `setLocalStorage` を持つもの（SDK の bridge か `storage` の `Kv`）です。

## `even-g2-design-system/text`

| export | 内容 |
|---|---|
| `pixelWidth(s)` | 表示幅（px）。`@evenrealities/pretext` の `getTextWidth` を使う |
| `truncateByPixelWidth(text, maxPx)` | 幅を超えたら末尾を `…` にする |
| `truncateChars(text, maxChars)` | サロゲートペアを分けずに文字数で切る |
| `byteLength(s)` | UTF-8 のバイト数 |
| `clampToBytes(text, maxBytes)` | バイト数に収める（text container の上限 999 byte 用） |
| `SCREEN_PX` / `FW_SPACE_PX` | 576 / 20 |

pretext は、フォントに無い文字にも幅 4px を返します。実際には何も描かれないので、表示できる文字かどうかは pretext では判定できません。

## `even-g2-design-system/events`

| export | 内容 |
|---|---|
| `classify(ev, spec)` | SDK のイベントを `EventKind`（`tap` `double` `up` `down` `hold` `release` `fg_enter` `fg_exit` `abnormal` `system_exit` `audio` `menu` `unknown`）に分類する |
| `readEventType(ev, spec)` | イベントから `OsEventTypeList` の値を読む |
| `EventReadSpec` | `{ strategy: 'object-first' \| 'event-type-first', chain: ('sys' \| 'text' \| 'list' \| 'audio')[] }`。どの系統をどの順に読むか |
| `createScrollGate(cooldownMs)` | スワイプの間引き。`cooldownMs` は呼ぶたびに読み直す |

`spec` に既定値はありません。アプリが読み順を決めて渡します。`eventType` が無いイベントは CLICK として扱います。OS メニューは開くと `fg_enter`、閉じると `fg_exit` になります。

## `even-g2-design-system/storage`

| export | 内容 |
|---|---|
| `Kv` | `getLocalStorage` / `setLocalStorage` を持つ型 |
| `createKvStore(opts)` | bridge を待ち、時間内に得られなければ `localStorage` に切り替える Kv |
| `createMirrorStore(opts)` | SDK の保存領域を永続先とし、ブラウザの `localStorage` を同期読み出し用の写しとして使うストア。`rehydrate()` で SDK の値を写し、`set()` は SDK へ非同期に書き込む |

`ui` が使うのは型 `Kv` だけです。

## `even-g2-design-system/i18n`

| export | 内容 |
|---|---|
| `Lang` | `'ja' \| 'en'` |
| `createT(translations, getLang, fallback)` | 現在の言語 → fallback → キーそのもの、の順に引く `t(key)` を作る |
