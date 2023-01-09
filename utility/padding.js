/**
 * @typedef {Map<String, Number>} BlockPaddings
 */
/**
 * @typedef {(paddings:BlockPaddings, next:Object) => BlockPaddings} PaddingReduceer
 */

/**
 * Get maximum needed paddings for properties
 * Only properties that are part of initial paddings keys
 * will be checked
 * @param {BlockPaddings} paddings
 * @param {Object} next next item to check
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

/**
 * Get maximum needed paddings for properties
 * Only properties that are part of initial paddings keys
 * will be checked
 * Recursively descend into tree for given prop, if set
 * @param {String} treeProperty property with array of descendants
 * @return {PaddingReduceer} recursive reducer
 */
export function recursivePadReducer (treeProperty) {
  const descendantAccessor = (item) => item[treeProperty]
  /**
   * @param {BlockPaddings} paddings
   * @param {Object} next next item to check
   * @returns {BlockPaddings} actual paddings
   */
  const reducer = function (paddings, next) {
    const newPaddings = padReducer(paddings, next)
    const descendants = descendantAccessor(next)
    if (descendants && descendants.length) {
      return descendants.reduce(reducer, newPaddings)
    }
    return newPaddings
  }
  return reducer
}
