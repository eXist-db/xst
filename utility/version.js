import { coerce, valid, satisfies, gte, lte } from 'semver'

/**
 * @typedef {Object} VersionedItem
 * @prop {String} name package URI
 * @prop {String} min SemVer version
 * @prop {String} max SemVer version
 * @prop {String} template SemVer version template
 * @prop {String[]} exact list of versions
 */

/**
 * true, if the versioned item does not specify any version
 * @param {VersionedItem} versionedItem the versioned item
 * @returns {Boolean} given version satisfies dependency
 */
function doesNotDeclareVersion (versionedItem) {
  return (
    versionedItem.exact.length === 0 &&
        versionedItem.max === null &&
        versionedItem.min === null &&
        versionedItem.template === null
  )
}

/**
 * helper function to check if version satisfies versioned item
 * @param {String} version the versioned item
 * @param {VersionedItem} versionedItem the versioned item
 * @returns {Boolean} given version satisfies dependency
 */
export function satisfiesDependency (version, versionedItem) {
  if (!version) {
    return false
  }
  if (doesNotDeclareVersion(versionedItem)) {
    return true
  }
  const semVer = valid(version)
  if (!semVer && !versionedItem.exact) { return false }
  if (!semVer) {
    return versionedItem.exact.includes(version)
  }
  if (versionedItem.max && versionedItem.min) {
    return satisfies(semVer, versionedItem.min + ' - ' + versionedItem.max)
  }
  if (versionedItem.min) {
    return gte(semVer, coerce(versionedItem.min))
  }
  if (versionedItem.max) {
    return lte(semVer, coerce(versionedItem.max))
  }
  const coerced = coerce(versionedItem.template, true)
  return satisfies(semVer, coerced)
}

/**
 * helper function to render version ranges and templates
 * @param {VersionedItem} versionedItem the versioned item
 * @returns {String} the formatted version
 */
export function formatVersion (versionedItem) {
  if (doesNotDeclareVersion(versionedItem)) { return '*' }
  if (versionedItem.template) {
    const parts = versionedItem.template.split('.')
    switch (parts.length) {
      case 3: return versionedItem.template
      case 2: return versionedItem.template + '.x'
      default: return versionedItem.template + '.x.x'
    }
  }
  if (versionedItem.min && versionedItem.max) {
    return versionedItem.min + ' - ' + versionedItem.max
  }
  if (versionedItem.min) {
    return '>=' + versionedItem.min
  }
  if (versionedItem.max) {
    return '<=' + versionedItem.max
  }
  return versionedItem.exact.join(' || ')
}
