import { connect } from '@existdb/node-exist'
import { ct } from '../../utility/console.js'
import { multiSort } from '../../utility/sorter.js'
import { padReducer } from '../../utility/padding.js'
import { getDateFormatter } from '../../utility/colored-date.js'
import { satisfiesDependency, formatVersion } from '../../utility/version.js'
import { readXquery } from '../../utility/xq.js'

/**
 * @typedef {Object} ListOptions
 * @prop {Boolean} color color output or not
 * @prop {Boolean} extended show all info per entry in list
 * @prop {Boolean} libraries only show collections
 * @prop {Boolean} applications only show collections
 * @prop {Boolean} dependencies only show collections
 * @prop {Boolean} fullUri use package URIs instead of abbreviations
 * @prop {"short"|"iso"|false} date show installation date
 * @prop {Object} connectionOptions DB connection options
 */

/**
 * @typedef {Object} VersionedItem
 * @prop {String} name package URI
 * @prop {String} min SemVer version
 * @prop {String} max SemVer version
 * @prop {String} template SemVer version template
 * @prop {String[]} exact list of versions
 */

/**
 * @typedef {Object} Components
 * @prop {String[]} xslt exported XSLT module
 * @prop {String[]} xquery exported XQuery modules
 * @prop {String[]} xproc exported XProc scripts
 * @prop {String[]} xsd exported XSDs
 * @prop {String[]} rng exported RelaxNG schemas
 * @prop {String[]} schematron exported schematron schemas
 * @prop {String[]} nvdl exported NVDLs
 * @prop {String[]} resource exported resources
 */

/**
 * @typedef {Object} ListResultItem
 * @prop {String} date the iso dateTime string when the package was installed
 * @prop {VersionedItem} processor the declared XPath, XQuery, XSLT processor dependency
 * @prop {Components} components the declared package dependencies
 * @prop {String} website website of the package
 * @prop {String} abbrev abbreviated name of the package
 * @prop {String} target the target collection
 * @prop {String} description one or two sentences explaining the purpose of the package
 * @prop {"application"|"library"} type the type of the item
 * @prop {String} uri the package URI
 * @prop {String[]} authors the authors of the package
 * @prop {String} version the installed package version (mostly SemVer)
 * @prop {String} title the title of the package
 * @prop {VersionedItem[]} dependencies the declared package dependencies
 * @prop {String} license the license of the package (free text)
 */

/**
 * @typedef {(item:ListResultItem) => void} ItemFormatter
 */
/**
 * @typedef {(item:ListResultItem) => String} BlockFormatter
 */
/**
 * @typedef {(item:ListResultItem) => void} ItemRenderer
 */
/**
 * @typedef {(itemA:ListResultItem, itemB:ListResultItem) => Number} ItemSorter
 */
/**
 * @typedef {(item:ListResultItem) => Boolean} ItemFilter
 */

const query = readXquery('list-packages.xq')

// tree

// const FILL = '│   '
const ITEM = '├── '
const LAST = '└── '
// const EMPTY = '    '

/**
 * @type {import('../../utility/padding.js').BlockPaddings}
 */
const initialPaddings = new Map([
  ['abbrev', 0],
  ['uri', 0],
  ['version', 3]
])

/**
 * get block paddings for list
 * @param {ListResultItem[]} list of result items
 * @returns {BlockPaddings} block paddings for list
 */
function getPaddings (list) {
  return list.reduce(padReducer, initialPaddings)
}

/**
 * Is pkg a library?
 * @param {ListResultItem} pkg package to check
 * @returns {Boolean} whether this is a library or not
 */
function isLibrary (pkg) {
  return pkg.type === 'library'
}

/**
 * Get Item filter
 * @param {ListOptions} options the options
 * @returns {ItemFilter} the filter
 */
function getFilter (options) {
  if (options.lib) {
    return pkg => isLibrary(pkg)
  }
  if (options.app) {
    return pkg => !isLibrary(pkg)
  }
  return _ => true
}

/**
 * Display the Item identifier colored
 * @param {ListResultItem} pkg the item
 * @param {(pkg:ListResultItem)=>string} pad padding function
 * @returns {String} the colored terminal output
 */
function coloredDisplay (pkg, pad) {
  return isLibrary(pkg)
    ? ct(pad(pkg), 'FgBlue')
    : ct(pad(pkg), 'FgCyan')
}

/**
 * Display the item identifier
 * @param {ListResultItem} pkg the item
 * @param {(pkg:ListResultItem)=>string} pad padding function
 * @returns {String} the terminal output
 */
function display (pkg, pad) {
  return pad(pkg)
}

/**
 * pad the given prop to the appropriate length
 * @param {BlockPaddings} paddings the paddings
 * @param {"abbrev"|"uri"} prop the prop to pad
 * @returns {(pkg:ListResultItem)=>string} with padded prop
 */
function padProp (paddings, prop) {
  return (pkg) => pkg[prop].padEnd(paddings.get(prop))
}

/**
 * get the formatter for the main item identifier
 * @param {ListOptions} options the options
 * @param {BlockPaddings} paddings the paddings
 * @returns {BlockFormatter} format main identifier
 */
function getAbbrevFormatter (options, paddings) {
  const prop = options.fullUri ? 'uri' : 'abbrev'
  const pad = padProp(paddings, prop)
  if (options.color) {
    return pkg => coloredDisplay(pkg, pad)
  }
  return pkg => display(pkg, pad)
}

/**
 * get the version block formatter
 * @param {ListOptions} options the options
 * @param {BlockPaddings} paddings the paddings
 * @returns {BlockFormatter} format version block
 */
function getVersionFormatter (options, paddings) {
  return pkg => pkg.version.padEnd(paddings.get('version'))
}

/**
 * output a colored label in extended view
 * @param {String} label the label
 * @returns {String} colored terminal output
 */
function coloredLabel (label) {
  return ct(label, 'FgGreen', 'Dim')
}

/**
 * output authors with quantified label
 * @param {ListOptions} options the options
 * @returns {BlockFormatter} author formatter
 */
function getAuthorsFormatter (options) {
  if (options.color) {
    return pkg => coloredLabel(`Author${pkg.authors.length > 1 ? 's' : ''}: `) + pkg.authors.join(' ')
  }
  return pkg => `Author${pkg.authors.length > 1 ? 's' : ''}: ` + pkg.authors.join(' ')
}

/**
 * shorten well-known processor URI
 * @param {String} name processor URI
 * @returns {String|"existdb"} maybe shortened name
 */
function processorName (name) {
  return name === 'http://exist-db.org' ? 'existdb' : name
}

/**
 * get processor block formatter
 * @param {ListOptions} options the options
 * @returns {BlockFormatter} the formatter
 */
function getProcessorFormatter (options) {
  if (options.color) {
    return function (pkg) {
      if (!pkg.processor.uri) {
        return coloredLabel('Processor: ') + 'any'
      }
      return coloredLabel('Processor: ') + processorName(pkg.processor.uri) + ' ' + ct(formatVersion(pkg.processor), 'FgYellow')
    }
  }
  return function (pkg) {
    if (!pkg.processor.uri) {
      return 'Processor: any'
    }
    return 'Processor: ' + processorName(pkg.processor.uri) + ' ' + formatVersion(pkg.processor)
  }
}

/**
 * generic extended block formatter
 * @param {ListOptions} options the options
 * @param {String} label the label
 * @param {String} prop the property
 * @returns {BlockFormatter} the formatter
 */
function getLabelFormatter (options, label, prop) {
  if (options.color) {
    return pkg => (pkg[prop] ? coloredLabel(label + ': ') + pkg[prop] : null)
  }
  return pkg => (pkg[prop] ? label + ': ' + pkg[prop] : null)
}

/**
 * convert URIs to corresponding abbrev
 * @param {Map<String, ListResultItem>} uri2pkg the mapping
 * @param {String} uri the package URI
 * @returns {BlockFormatter} the formatter
 */
function pkgAbbrev (uri2pkg) {
  return (dep) => {
    const pkg = uri2pkg.get(dep.uri)
    return pkg ? pkg.abbrev : dep.uri
  }
}

/**
 * get dependencies
 * @param {Map<String, ListResultItem>} uri2pkg the mapping
 * @param {String} uri the package URI
 * @returns {BlockFormatter} the formatter
 */
// function pkgDependencies (uri2pkg) {
//   return (pkg) => uri2pkg.get(pkg.uri).dependencies
// }

/**
 * return given URI unchanged (ID transform)
 * @param {String} uri the package URI
 * @returns {String} the package URI
 */
function uriAccessor (pkg) {
  return pkg.uri
}

/**
 * get list item prefix according to position in list
 * @param {Number} index current index
 * @param {Array} array list of dependencies
 * @returns {String} prefix for dependency list item
 */
function isLast (index, array) {
  return index === array.length - 1 ? LAST : ITEM
}

/**
 * format dependency list item
 * @param {Function} fmt uri formatter function
 * @param {VersionedItem} dependency dependency list item
 * @param {Number} index current items index
 * @param {Array} array list of all dependencies
 * @returns {String} terminal output
 */
function formatDependency (fmt, uri2pkg, dependency, index, array) {
  const pkg = uri2pkg.get(dependency.uri)
  const satisfied = pkg && satisfiesDependency(pkg.version, dependency)
  return isLast(index, array) +
    (satisfied ? '' : '! ') +
    fmt(dependency) + ' ' +
    formatVersion(dependency)
}

/**
 * format and color dependency list item
 * @param {Function} fmt uri formatter function
 * @param {VersionedItem} dependency dependency list item
 * @param {Number} index current items index
 * @param {Array} array list of all dependencies
 * @returns {String} colored terminal output
 */
function formatDependencyColored (fmt, uri2pkg, dependency, index, array) {
  const pkg = uri2pkg.get(dependency.uri)
  const satisfied = pkg && satisfiesDependency(pkg.version, dependency)
  const color = satisfied ? 'FgGreen' : 'FgRed'
  const mod = satisfied ? 'Dim' : 'Bright'
  return isLast(index, array) +
    (satisfied ? '' : ct('! ', color, mod)) +
    fmt(dependency) + ' ' +
    ct(formatVersion(dependency), color, mod)
}

/**
 * ouput list of formatted dependencies
 * @param {Function} fmt uri formatter function
 * @param {ListResultItem} pkg the item
 * @returns {String} formatted dependencies
 */
function formatDependencies (fmt, uri2pkg, pkg) {
  if (!pkg.dependencies.length) {
    return LAST + '(no dependency)'
  }
  const fmtDep = (dep, index, array) => formatDependency(fmt, uri2pkg, dep, index, array)
  return pkg.dependencies.map(fmtDep).join('\n')
}

/**
 * ouput list of formatted and colored dependencies
 * @param {Function} fmt uri formatter function
 * @param {ListResultItem} pkg the item
 * @returns {String} formatted and colored dependencies
 */
function formatDependenciesColored (fmt, uri2pkg, pkg) {
  if (!pkg.dependencies.length) {
    return LAST + ct('(no dependency)', 'FgWhite', 'Dim')
  }
  const fmtDep = (dep, index, array) => formatDependencyColored(fmt, uri2pkg, dep, index, array)
  return pkg.dependencies.map(fmtDep).join('\n')
}

/**
 * get depency list formatter
 * @param {ListResultItem[]} list the list of items
 * @param {ListOptions} options the options
 * @returns {BlockFormatter} extended block formatter
 */
function getDependenciesFormatter (list, options) {
  let nameFmt = uriAccessor
  const uri2pkg = new Map(list.map(pkg => [pkg.uri, pkg]))
  if (!options.fullUri) {
    nameFmt = pkgAbbrev(uri2pkg)
  }
  if (options.color) {
    return (pkg) => {
      return formatDependenciesColored(nameFmt, uri2pkg, pkg)
    }
  }
  return (pkg) => {
    return formatDependencies(nameFmt, uri2pkg, pkg)
  }
}

/**
 * render components
 * @param {ListResultItem} pkg the item
 * @returns {String[][]} list of components
 */
function gatherComponents (pkg) {
  const components = []
  for (const key in pkg.components) {
    if (pkg.components[key].length === 0) { continue }
    if (pkg.components[key].length === 1) {
      components.push([key, ' ' + pkg.components[key]])
      continue
    }
    components.push([key, '\n    ' + pkg.components[key].join('\n    ')])
  }
  return components
}

/**
 * colored component block formatter
 * @param {ListResultItem} pkg the item
 * @returns {String} colored terminal output
 */
function formatComponentsColored (pkg) {
  const components = gatherComponents(pkg)
  if (components.length) {
    return coloredLabel('Components:\n') + components.map(a => '  ' + coloredLabel(a[0] + ':') + a[1]).join('\n')
  }
  return coloredLabel('Components: ') + ct('none', (pkg.target ? 'FgYellow' : 'FgRed'), 'Bright')
}

/**
 * component block formatter
 * @param {ListResultItem} pkg the item
 * @returns {String} terminal output
 */
function formatComponents (pkg) {
  if (!isLibrary(pkg)) { return null }

  const components = gatherComponents(pkg)
  if (components.length) {
    return 'Components:\n' + components.map(a => '  ' + a[0] + ':' + a[1]).join('\n')
  }
  return 'Components: none'
}

/**
 * get the component block formatter
 * @param {ListOptions} options the options
 * @returns {BlockFormatter} the component block formatter
 */
function getComponentsFormatter (options) {
  if (options.color) {
    return formatComponentsColored
  }
  return formatComponents
}

/**
 * Get the item formatting function
 * @param {ListResultItem[]} list the list
 * @param {ListOptions} options the options
 * @returns {ItemFormatter} the formatter
 */
function getItemFormatter (list, options) {
  const { versions, date, extended, dependencies, color, fullUri } = options
  if (!versions && !date && !extended && !dependencies) {
    const pkgFmt = color ? coloredDisplay : display
    const prop = fullUri ? 'uri' : 'abbrev'
    const accessor = (pkg) => pkg[prop]
    return pkg => console.log(pkgFmt(pkg, accessor))
  }

  const paddings = getPaddings(list)
  const blocks = []
  blocks.push(getAbbrevFormatter(options, paddings))
  if (versions) {
    blocks.push(getVersionFormatter(options, paddings))
  }
  if (date) {
    blocks.push(getDateFormatter(options, 'date'))
  }

  const extBlocks = []
  if (dependencies) {
    extBlocks.push(getDependenciesFormatter(list, options))
  }

  if (extended) {
    extBlocks.push(getLabelFormatter(options, 'Title', 'title'))
    extBlocks.push(getLabelFormatter(options, 'URI', 'uri'))
    extBlocks.push(getAuthorsFormatter(options))
    extBlocks.push(getLabelFormatter(options, 'Description', 'description'))
    extBlocks.push(getLabelFormatter(options, 'Website', 'website'))
    extBlocks.push(getLabelFormatter(options, 'Version', 'version'))
    extBlocks.push(getLabelFormatter(options, 'Installed', 'date'))
    extBlocks.push(getProcessorFormatter(options))
    extBlocks.push(getLabelFormatter(options, 'Target', 'target'))
    extBlocks.push(getLabelFormatter(options, 'Type', 'type'))
    extBlocks.push(getLabelFormatter(options, 'License', 'license'))
    // show exports for libraries
    extBlocks.push(getComponentsFormatter(options))
    return function (pkg) {
      const output = blocks.map(bf => bf(pkg))
      console.log(output.join(' '))
      extBlocks.forEach(bf => {
        const res = bf(pkg)
        if (res === null) { return }
        console.log(res)
      })
      console.log()
    }
  }

  return function (pkg) {
    const output = blocks.map(bf => bf(pkg))
    console.log(output.join(' '))
    extBlocks.forEach(bf => console.log(bf(pkg)))
  }
}

/**
 * sort items by their name in alphabetical order
 * @param {ListResultItem} itemA
 * @param {ListResultItem} itemB
 * @returns {Number} sort direction
 */
function sortByName (itemA, itemB) {
  return itemA.abbrev.localeCompare(itemB.abbrev)
}

/**
 * sort items by their type
 * @param {ListResultItem} itemA
 * @param {ListResultItem} itemB
 * @returns {Number} sort direction
 */
function sortByType (itemA, itemB) {
  const a = isLibrary(itemA)
  const b = isLibrary(itemB)
  if (a === b) return 0
  return a ? 1 : -1
}

/**
 * get the modified date as milliseconds since epoch start
 * @param {ListResultItem} item result item
 * @returns {Number} milliseconds since epoch start
 */
function getMillis (dateString) {
  const d = new Date(dateString)
  return d.getTime()
}

/**
 * sort items by their installation time
 * @param {ListResultItem} itemA
 * @param {ListResultItem} itemB
 * @returns {Number} sort direction
 */
function sortByTime (itemA, itemB) {
  const mtA = getMillis(itemA.date)
  const mtB = getMillis(itemB.date)
  return mtB - mtA
}

/**
 * get sorting function
 * @param {ListOptions} options given options
 * @returns {ItemSorter} sorting function
 */
function getSorter (options) {
  const { reverse, typesort, timesort } = options
  const sorters = []
  if (typesort) {
    sorters.push(sortByType)
  }
  if (timesort) {
    sorters.push(sortByTime)
  }
  sorters.push(sortByName)
  return (a, b) => multiSort(a, b, sorters, reverse)
}

/**
 * list installed packages raw, colored, sorted and/or filtered
 * @param {NodeExist} db database connection
 * @param {ListOptions} options the options
 * @returns {Number} the exit code
 */
async function listPackages (db, options) {
  const result = await db.queries.readAll(query, {})
  const raw = result.pages.toString()
  if (options.raw) {
    return console.log(raw)
  }

  const json = JSON.parse(raw)
  // if (json.error) {
  //   if (options.debug) {
  //     console.error(json.error)
  //   }
  //   throw Error(json.error.description)
  // }
  const filteredPkgs = json.packages.filter(getFilter(options))
  filteredPkgs
    .sort(getSorter(options))
    .forEach(getItemFormatter(json.packages, options))
  return 0
}

export const command = ['list [options]', 'ls']
export const describe = 'List installed packages'

const options = {
  G: {
    alias: 'color',
    describe: 'Color the output',
    default: false,
    type: 'boolean'
  },
  V: {
    alias: 'versions',
    describe: 'Display installed version',
    default: false,
    type: 'boolean'
  },
  e: {
    alias: 'extended',
    describe: 'Display more information for each item',
    default: false,
    type: 'boolean'
  },
  t: {
    alias: 'typesort',
    describe: 'Sort by type',
    type: 'boolean',
    default: false
  },
  T: {
    alias: 'timesort',
    describe: 'Sort by installation date',
    type: 'boolean',
    default: false
  },
  r: {
    alias: 'reverse',
    describe: 'Reverse the order of the sort',
    type: 'boolean'
  },
  a: {
    alias: ['app', 'applications'],
    describe: 'Only list installed application packages',
    type: 'boolean'
  },
  l: {
    alias: ['lib', 'libraries'],
    describe: 'Only list installed library packages',
    type: 'boolean'
  },
  date: {
    describe: 'Show installation date',
    choices: ['short', 'iso'],
    coerce: v => v === true ? 'short' : v
  },
  D: {
    alias: ['deps', 'dependencies'],
    describe: 'Show package dependencies',
    type: 'boolean',
    default: false
  },
  fullUri: {
    describe: 'Use full URIs for display',
    type: 'boolean',
    default: false
  },
  raw: {
    describe: 'Return raw JSON data from query',
    type: 'boolean',
    default: false
  }
}

export const builder = yargs => {
  return yargs.options(options)
    .conflicts('a', 'l')
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  const db = connect(argv.connectionOptions)
  return await listPackages(db, argv)
}
