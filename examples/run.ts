// 架空データによる画面定義の出力例。
// 描画は行わず、各画面のコンテナ定義 (SDK の TextContainerProperty を toJson() したもの) を
// examples/output/*.json に書き出し、標準出力に一覧を表示するだけ。
import { mkdirSync, writeFileSync } from 'node:fs'
import { GLASS, card, layoutList, padToFixedSet, topBar, topLayout } from '../src/ui/index.ts'

type Reading = { title: string; author: string; chars: number; status: string }

const items: Reading[] = [
  { title: '灯台守の手紙', author: '浜野 灯', chars: 18400, status: '12/30ページ' },
  { title: '雨の日の約束', author: '三栗 ゆず', chars: 6200, status: '読了' },
  { title: '星屑の運送屋', author: '南雲 ハル', chars: 42100, status: '未読' },
  { title: '白い栞', author: '浜野 灯', chars: 3100, status: '読了' },
  { title: '坂の上のパン屋', author: '桐谷 まい', chars: 9800, status: '3/12ページ' },
  { title: '夜行列車の窓', author: '三栗 ゆず', chars: 27500, status: '未読' },
  { title: '空き地の地図', author: '南雲 ハル', chars: 5400, status: '未読' },
]

const outDir = new URL('./output/', import.meta.url)
mkdirSync(outDir, { recursive: true })

type Screen = {
  screen: string
  layout: string
  shapeKey: string
  pageStart?: number
  pageEnd?: number
  containers: ReturnType<ReturnType<typeof card>['toJson']>[]
}

function emit(file: string, s: Screen): void {
  writeFileSync(new URL(file, outDir), JSON.stringify(s, null, 2))
  console.log(`examples/output/${file}`)
  for (const c of s.containers) {
    console.log(`  ${c.containerID}: ${c.containerName} (${c.xPosition},${c.yPosition},${c.width},${c.height})`)
  }
}

// 1. 一覧画面
{
  const cursor = 1
  const layout = topLayout(items.length)
  const bar = topBar({
    layout,
    left: '作品一覧',
    pos: { index: cursor + 1, total: items.length },
    offline: false,
    clock: '14:32',
  })
  const list = layoutList({
    items,
    cursor,
    pageStart: 0,
    renderSelected: (it) => [it.title, `${it.author}　${it.chars}字　${it.status}`],
    renderRow: (it) => it.title,
  })
  const containers = padToFixedSet([...bar.containers, ...list.faces]).map((c) => c.toJson())
  emit('list.json', {
    screen: 'list',
    layout,
    shapeKey: bar.shapeKey,
    pageStart: list.pageStart,
    pageEnd: list.pageEnd,
    containers,
  })
}

// 2. 本文画面
{
  const body = [
    '港の灯りが一つずつ消えていく夜、',
    '彼女は古い手紙を机に広げた。',
    '差出人の名前はにじんで読めない。',
    'それでも最後の一行だけは、',
    'はっきりと覚えているつもりだった。',
    '「また、灯台の下で会いましょう」',
  ].join('\n')
  const layout = topLayout(2)
  const bar = topBar({
    layout,
    left: '灯台守の手紙',
    pos: { index: 7, total: 10 },
    bar: { done: 7, total: 10 },
    offline: false,
    clock: '14:32',
  })
  const cardContainer = card(GLASS.ID.BASE, 'body', body)
  const containers = padToFixedSet([...bar.containers, cardContainer]).map((c) => c.toJson())
  emit('body.json', { screen: 'body', layout, shapeKey: bar.shapeKey, containers })
}
