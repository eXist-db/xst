/**
 * @typedef {Map<String, Number>} BlockPaddings
 */
/**
 * @typedef {(paddings:BlockPaddings, next:Object) => BlockPaddings} PaddingReduceer
 */

/**
 * measure length of atomic value
 * @param {Number|String} value
 * @returns {Number} length of value
 */
function measure (value) {
  if (typeof value === 'number') {
    return value.toFixed(0).length
  }
  if (typeof value === 'string') {
    return value.length
  }
  throw TypeError('Cannot measure value length. Unsupported type: ' + typeof value)
}

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
    const length = measure(next[key])
    if (paddings.get(key) < length) {
      paddings.set(key, length)
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
   * named function to allow recursion
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
