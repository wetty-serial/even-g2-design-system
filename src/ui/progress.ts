import { GLASS } from './tokens.ts'

/** `━` × 済 + `─` × 残 の 10 マス。`done` は「読んだページ数」(1 始まりの現在ページ)。
 *  1 ページでも読んでいれば最低 1 マス埋める (切り上げ)。 */
export function progressBar(done: number, total: number): string {
  const cells = GLASS.BAR.CELLS
  const filled =
    total <= 0 ? 0 : Math.min(cells, Math.max(0, Math.ceil((done / total) * cells)))
  return GLASS.BAR.FILLED.repeat(filled) + GLASS.BAR.EMPTY.repeat(cells - filled)
}

/** `03/24`。index は表示する番号 (1 始まり)。総数の桁までゼロ埋め。 */
export function position(index: number, total: number): string {
  const digits = String(total).length
  return `${String(index).padStart(digits, '0')}/${total}`
}
