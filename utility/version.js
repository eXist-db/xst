import { valid, satisfies } from 'semver'

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
 * How many parts (major, minor, patch) are in the template?
 * @param {string} template version string with 0-2 dots
 * @returns {1|2|3} parts in version string (max 3)
 */
function inspect (template) {
  const parts = template.split('.').length
  return Math.min(3, parts)
}

/**
 * helper function to render version ranges and templates
 * @param {VersionedItem} versionedItem the versioned item
 * @returns {String} the formatted version
 */
export function formatVersion (versionedItem) {
  if (doesNotDeclareVersion(versionedItem)) { return '*' }
  if (versionedItem.template) {
    switch (inspect(versionedItem.template)) {
      case 3: return versionedItem.template
      default: return '~' + versionedItem.template
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

/**
 * alternative display of SemVer templates
 * "5" will display as "5.x.x" default is "~5"
 * @param {String} semverTemplate SemVer template string
 * @returns {String} filled SemVer template string
 */
function fill (semverTemplate) {
  switch (inspect(semverTemplate)) {
    case 3: return semverTemplate
    case 2: return semverTemplate + '.x'
    default: return semverTemplate + '.x.x'
  }
}

/**
 * helper function to render alternative version (filled)
 * @param {VersionedItem} versionedItem the versioned item
 * @returns {String} the formatted version
 */
export function formatVersionFill (versionedItem) {
  if (doesNotDeclareVersion(versionedItem)) { return '*' }
  if (versionedItem.template) {
    return fill(versionedItem.template)
  }
  if (versionedItem.min && versionedItem.max) {
    return fill(versionedItem.min) + ' - ' + fill(versionedItem.max)
  }
  if (versionedItem.min) {
    return '>=' + fill(versionedItem.min)
  }
  if (versionedItem.max) {
    return '<=' + fill(versionedItem.max)
  }
  return versionedItem.exact.join(' || ')
}

/**
 * check if version satisfies versioned item declaration
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
  if (!semVer || versionedItem.exact.length) {
    return versionedItem.exact.includes(version)
  }
  return satisfies(semVer, formatVersion(versionedItem))
}
