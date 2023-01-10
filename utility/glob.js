/**
 * transform globbing pattern to regular expression
 * @param {String} glob globbing pattern
 * @returns {String} regular expression
 */
export function toRegExpPattern (glob) {
  const converted = glob
    .replace(/\\/g, '\\\\') // escape backslashes
    .replace(/\./g, '\\.') // make . literals
    .replace(/\?/g, '.') // transform ?
    .replace(/\*/g, '.*?') // transform *

  return `^${converted}$`
}

/**
 * get filter function that checks item names against globbing pattern
 * @param {String} glob globbing pattern
 * @returns {(item:ListResultItem) => Boolean}
 */
export function getGlobMatcher (glob) {
  const regex = new RegExp(toRegExpPattern(glob), 'i')
  return (item) => regex.test(item.name)
}
