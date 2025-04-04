import chalk from 'chalk'
import { connect } from '@existdb/node-exist'
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
 * @prop {Boolean} fullName use package name instead of abbreviation
 * @prop {"short"|"iso"|false} date show installation date
 * @prop {Object} connectionOptions DB connection options
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
 * @prop {String[]} jar jars that come with the package
 */

/**
 * @typedef {import('../../utility/version').VersionedItem} VersionedItem
 */

/**
 * @typedef {"application"|"library"} PackageType
 */

/**
 * @typedef {Object} ListResultItem
 * @prop {String} name the package name
 * @prop {String} abbrev abbreviated name of the package
 * @prop {String} date the iso dateTime string when the package was installed
 * @prop {PackageType} type the type of the item
 * @prop {String} website website of the package
 * @prop {String} target the target collection
 * @prop {String} description one or two sentences explaining the purpose of the package
 * @prop {String[]} authors the authors of the package
 * @prop {String} version the installed package version (mostly SemVer)
 * @prop {String} title the title of the package
 * @prop {String} license the license of the package (free text)
 * @prop {Components} components the declared package dependencies
 * @prop {VersionedItem} processor the declared XPath, XQuery, XSLT processor dependency
 * @prop {VersionedItem[]} dependencies the declared package dependencies
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
  ['name', 0],
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
    ? chalk.blue(pad(pkg))
    : chalk.cyan(pad(pkg))
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
 * @param {"abbrev"|"name"} prop the prop to pad
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
  const prop = options.fullName ? 'name' : 'abbrev'
  const pad = padProp(paddings, prop)
  return pkg => coloredDisplay(pkg, pad)
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
  return chalk.green.dim(label)
}

/**
 * output authors with quantified label
 * @param {ListOptions} options the options
 * @returns {BlockFormatter} author formatter
 */
function getAuthorsFormatter (options) {
  return pkg => coloredLabel(`Author${pkg.authors.length > 1 ? 's' : ''}: `) + pkg.authors.join(' ')
}

/**
 * shorten well-known processor name
 * @param {String} name processor name
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
  return function (pkg) {
    if (!pkg.processor.name) {
      return coloredLabel('Processor: ') + 'any'
    }
    return coloredLabel('Processor: ') + processorName(pkg.processor.name) + ' ' +
        chalk.yellow(formatVersion(pkg.processor))
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
  return pkg => (pkg[prop] ? coloredLabel(label + ': ') + pkg[prop] : null)
}

/**
 * convert names to corresponding abbreviaton
 * @param {Map<String, ListResultItem>} name2pkg the mapping
 * @returns {BlockFormatter} the formatter
 */
function pkgAbbrev (name2pkg) {
  return (dep) => {
    const pkg = name2pkg.get(dep.name)
    return pkg ? pkg.abbrev : dep.name
  }
}

/**
 * get dependencies
 * @param {Map<String, ListResultItem>} name2pkg the mapping
 * @returns {BlockFormatter} the formatter
 */
// function pkgDependencies (name2pkg) {
//   return (pkg) => name2pkg.get(pkg.name).dependencies
// }

/**
 * return package name
 * @param {ListResultItem} pkg the package
 * @returns {String} the package name
 */
function nameAccessor (pkg) {
  return pkg.name
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
 * format and color dependency list item
 * @param {Function} fmt name formatter function
 * @param {Map<String, ListResultItem>} name2pkg the mapping
 * @param {VersionedItem} dependency dependency list item
 * @param {Number} index current items index
 * @param {Array} array list of all dependencies
 * @returns {String} colored terminal output
 */
function formatDependencyColored (fmt, name2pkg, dependency, index, array) {
  const pkg = name2pkg.get(dependency.name)
  const satisfied = pkg && satisfiesDependency(pkg.version, dependency)
  const color = satisfied ? chalk.green.dim : chalk.redBright
  return isLast(index, array) +
    (satisfied ? '' : color('! ')) +
    fmt(dependency) + ' ' +
    color(formatVersion(dependency))
}

/**
 * ouput list of formatted and colored dependencies
 * @param {Function} fmt name formatter function
 * @param {Map<String, ListResultItem>} name2pkg the mapping
 * @param {ListResultItem} pkg the item
 * @returns {String} formatted and colored dependencies
 */
function formatDependenciesColored (fmt, name2pkg, pkg) {
  if (!pkg.dependencies.length) {
    return LAST + chalk.white.dim('(no dependency)')
  }
  const fmtDep = (dep, index, array) => formatDependencyColored(fmt, name2pkg, dep, index, array)
  return pkg.dependencies.map(fmtDep).join('\n')
}

/**
 * get depency list formatter
 * @param {ListResultItem[]} list the list of items
 * @param {ListOptions} options the options
 * @returns {BlockFormatter} extended block formatter
 */
function getDependenciesFormatter (list, options) {
  let nameFmt = nameAccessor
  const name2pkg = new Map(list.map(pkg => [pkg.name, pkg]))
  if (!options.fullName) {
    nameFmt = pkgAbbrev(name2pkg)
  }
  return (pkg) => formatDependenciesColored(nameFmt, name2pkg, pkg)
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
  const color = pkg.target ? chalk.yellowBright : chalk.redBright
  return coloredLabel('Components: ') + color('none')
}

/**
 * get the component block formatter
 * @param {ListOptions} options the options
 * @returns {BlockFormatter} the component block formatter
 */
function getComponentsFormatter (options) {
  return formatComponentsColored
}

/**
 * Get the item formatting function
 * @param {ListResultItem[]} list the list
 * @param {ListOptions} options the options
 * @returns {ItemFormatter} the formatter
 */
function getItemFormatter (list, options) {
  const { versions, date, extended, dependencies, color, fullName } = options
  if (!versions && !date && !extended && !dependencies) {
    const pkgFmt = color ? coloredDisplay : display
    const prop = fullName ? 'name' : 'abbrev'
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
    extBlocks.push(getLabelFormatter(options, 'Name', 'name'))
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
  const result = await db.queries.readAll(query)
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
  'full-name': {
    describe: 'Use full name for packages and dependencies',
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
