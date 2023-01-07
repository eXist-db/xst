import { valid, satisfies } from 'semver'

/**
 * @typedef {Object} VersionedItem
 * @prop {String} name package URI
 * @prop {String} semverMin SemVer max version
 * @prop {String} semverMax SemVer min version
 * @prop {String} semver SemVer version range
 * @prop {String[]} versions array of exact versions
 */

/**
 * true, if the versioned item does not specify any version
 * @param {VersionedItem} versionedItem the versioned item
 * @returns {Boolean} given version satisfies dependency
 */
function doesNotDeclareVersion (versionedItem) {
  return (
    versionedItem.versions.length === 0 &&
        versionedItem.semverMax === null &&
        versionedItem.semverMin === null &&
        versionedItem.semver === null
  )
}

/**
 * How many parts (major, minor, patch) are in the template?
 * @param {string} semver version string with 0-2 dots
 * @returns {1|2|3} parts in version string (max 3)
 */
function inspect (semver) {
  const parts = semver.split('.').length
  return Math.min(3, parts)
}

/**
 * helper function to render version ranges and templates
 * @param {VersionedItem} versionedItem the versioned item
 * @returns {String} the formatted version
 */
export function formatVersion (versionedItem) {
  if (doesNotDeclareVersion(versionedItem)) { return '*' }
  if (versionedItem.semver) {
    switch (inspect(versionedItem.semver)) {
      case 3: return versionedItem.semver
      default: return '~' + versionedItem.semver
    }
  }
  if (versionedItem.semverMin && versionedItem.semverMax) {
    return versionedItem.semverMin + ' - ' + versionedItem.semverMax
  }
  if (versionedItem.semverMin) {
    return '>=' + versionedItem.semverMin
  }
  if (versionedItem.semverMax) {
    return '<=' + versionedItem.semverMax
  }
  return versionedItem.versions.join(' || ')
}

/**
 * alternative display of SemVer templates
 * "5" will display as "5.x.x" default is "~5"
 * @param {String} semver SemVer version string
 * @returns {String} filled SemVer template string
 */
function fill (semver) {
  switch (inspect(semver)) {
    case 3: return semver
    case 2: return semver + '.x'
    default: return semver + '.x.x'
  }
}

/**
 * helper function to render alternative version (filled)
 * @param {VersionedItem} versionedItem the versioned item
 * @returns {String} the formatted version
 */
export function formatVersionFill (versionedItem) {
  if (doesNotDeclareVersion(versionedItem)) { return '*' }
  if (versionedItem.semver) {
    return fill(versionedItem.semver)
  }
  if (versionedItem.semverMin && versionedItem.semverMax) {
    return fill(versionedItem.semverMin) + ' - ' + fill(versionedItem.semverMax)
  }
  if (versionedItem.semverMin) {
    return '>=' + fill(versionedItem.semverMin)
  }
  if (versionedItem.semverMax) {
    return '<=' + fill(versionedItem.semverMax)
  }
  return versionedItem.versions.join(' || ')
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
  if (!semVer && !versionedItem.versions) { return false }
  if (!semVer || versionedItem.versions.length) {
    return versionedItem.versions.includes(version)
  }
  return satisfies(semVer, formatVersion(versionedItem), { includePrerelease: true })
}
