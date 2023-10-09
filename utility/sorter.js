/**
 * @typedef {(itemA:ListResultItem, itemB:ListResultItem) => Number} ItemSorter
 */

/**
 * sort items by multiple data points
 * order of sorters defines priority
 * can be reversed
 * @param {*} a item A to compare
 * @param {*} b item B to compare
 * @param {ItemSorter[]} sorters item sorting functions
 * @param {Boolean} reverse reverse sorting order?
 */
export function multiSort (a, b, sorters, reverse) {
  let v = 0
  let i = 0
  let sf = sorters[i]
  while (v === 0 && sf) {
    v = reverse ? sf(b, a) : sf(a, b)
    sf = sorters[++i]
  }
  return v
}
