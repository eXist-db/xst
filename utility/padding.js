/**
 * @typedef {Map<String, Number>} BlockPaddings
 */

/**
 * Get maximum needed paddings for properties
 * Only properties that are part of initial paddings keys
 * will be checked
 * @param {BlockPaddings} paddings
 * @param {ListResultItem} next
 * @returns {BlockPaddings} actual paddings
 */
export function padReducer (paddings, next) {
  for (const key of paddings.keys()) {
    if (paddings.get(key) < next[key].length) {
      paddings.set(key, next[key].length)
    }
  }
  return paddings
}
