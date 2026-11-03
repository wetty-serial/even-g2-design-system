import { MenuItemProperty } from '@evenrealities/even_hub_sdk'
import { byteLength } from '../text/index.ts'

/**
 * 1 画面の項目数の上限。simulator 0.9.1 は 10 項目を受け付け、5 項目ずつ流して表示した。
 * OS 側の項目 (画面オフ・明るさ・閉じる) が 10 に含まれるかは実機未確認。
 */
export const MENU_MAX = 10

export type MenuEntry = {
  /** 0 以外で一意 */
  id: number
  /** 32 UTF-8 バイト以内 */
  name: string
}

/**
 * OS コンテキストメニュー (`menuObject`) の項目。共通項目が先頭 (固定位置)、画面固有が後ろ。
 * ID の重複・0・名前の 32 byte 超過・MENU_MAX 超過は例外。
 */
export function buildMenu(o: {
  common: readonly MenuEntry[]
  screen: readonly MenuEntry[]
}): MenuItemProperty[] {
  const all = [...o.common, ...o.screen]
  if (all.length > MENU_MAX) {
    throw new RangeError(`OS メニューの項目は ${MENU_MAX} 個まで (受け取った数: ${all.length})`)
  }
  const seen = new Set<number>()
  for (const e of all) {
    if (!Number.isInteger(e.id) || e.id <= 0) throw new Error(`OS メニューの ID は 1 以上の整数: ${e.id}`)
    if (seen.has(e.id)) throw new Error(`OS メニューの ID が重複: ${e.id}`)
    seen.add(e.id)
    if (byteLength(e.name) > 32) throw new RangeError(`OS メニューの項目名は 32 byte まで: ${e.name}`)
  }
  return all.map((e) => new MenuItemProperty({ itemID: e.id, itemName: e.name }))
}
