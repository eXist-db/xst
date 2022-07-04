import { connect, getMimeType } from '@existdb/node-exist'
import { cc } from '../utility/console.js'
import { readXquery } from '../utility/xq.js'

/**
 * @typedef { import("node-exist").NodeExist } NodeExist
 */

/**
 * @typedef {Object} ListResultItem
 * @prop {"collection"|"resource"} type the type of the item
 * @prop {String} name the name of the collection or resource
 * @prop {String} path absolute path to the collection or resource
 * @prop {Number} [size] size in bytes
 * @prop {String} [created] the iso dateTime string when the item was created
 * @prop {String} [modified] the iso dateTime string when the item was last modified
 * @prop {String} [mode] the mode (permission) string of the item
 * @prop {String} [owner] the username of the owner of this item
 * @prop {String} [group] the group this item belongs to
 * @prop {ListResultItem[]} [children] list of chilren of a collection
 */

/**
 * @typedef {Object} ListOptions
 * @prop {Boolean} color color output or not
 * @prop {Boolean} extended show more info per entry in list
 * @prop {boolean} collectionsOnly only show collections
 * @prop {"human"|"bytes"} size size in bytes
 * @prop {Boolean} recursive traverse the tree
 * @prop {Boolean} tree show output as a tree
 * @prop {Number} depth how many levels to traverse down for recursive and tree views
 * @prop {String} glob filter items
 * @prop {Object} connectionOptions DB connection options
 */

/**
 * @typedef {(item:ListResultItem) => String} BlockFormatter
 */
/**
 * @typedef {(item:ListResultItem) => void} ItemRenderer
 */
/**
 * @typedef {(item:ListResultItem, indent:String, last:Boolean, level:Number) => void} TreeItemRenderer
 */
/**
 * @typedef {(itemA:ListResultItem, itemB:ListResultItem) => Number} ItemSorter
 */

/**
 * the xquery file to execute on the DB
 */
const query = readXquery('list-resources.xq')

/**
 * is the item a collection
 * @param {ListResultItem} item
 * @returns {Boolean} true if item is a collection
 */
const isCollection = item => item.type === 'collection'

// paddings

/**
 * @typedef {Map<String, Number>} BlockPaddings
 */
const initialPaddings = new Map([
  ['padOwner', 0],
  ['padGroup', 0],
  ['padSize', 4]
])

/**
 * Get maximum needed paddings for owner, group and size (in bytes)
 * @param {BlockPaddings} paddings
 * @param {ListResultItem} next
 * @returns {Map} actual paddings
 */
function padReducer (paddings, next) {
  if (paddings.get('padGroup') < next.group.length) {
    paddings.set('padGroup', next.group.length)
  }
  if (paddings.get('padOwner') < next.owner.length) {
    paddings.set('padOwner', next.owner.length)
  }
  if (paddings.get('padSize') < next.size.toFixed(0).length) {
    paddings.set('padSize', next.size.toFixed(0).length)
  }
  if (next.children && next.children.length) {
    return next.children.reduce(padReducer, paddings)
  }
  return paddings
}

/**
 * get block paddings for list
 * @param {ListResultItem[]} list of result items
 * @returns {BlockPaddings} block paddings for list
 */
function getPaddings (list) {
  return list.reduce(padReducer, initialPaddings)
}

// time

const timeFormat = {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit'
}
const dateFormat = {
  month: 'short'
}

const currentYear = (new Date()).getFullYear()

/**
 * format iso dateTime string
 * @param {ListResultItem} item
 * @returns {String} formatted date
 */
function formatDateTime (item) {
  const date = new Date(item.modified)
  const year = date.getFullYear()
  const month = date.toLocaleDateString('iso', dateFormat)
  const day = date.getDate().toString().padStart(3)
  if (year < currentYear) {
    return month + day + year.toString().padStart(6)
  }
  const time = date.toLocaleTimeString('iso', timeFormat).padStart(6)
  return month + day + time
}

/**
 * format iso dateTime string with color
 * @param {ListResultItem} item
 * @returns {String} colored, formatted date
 */
function formatDateTimeColored (item) {
  const date = new Date(item.modified)
  const year = date.getFullYear()
  const month = date.toLocaleDateString('iso', dateFormat)
  const day = date.getDate().toString().padStart(3)
  if (year < currentYear) {
    return cc('FgGreen') + month + day + year.toString().padStart(6) + cc('Reset')
  }
  const time = date.toLocaleTimeString('iso', timeFormat).padStart(6)
  return cc('Bright') + cc('FgGreen') + month + day + time + cc('Reset')
}

/**
 * get date formatting function
 * @param {ListResultItem} options list rendering options
 * @returns {formatDateTime|formatDateTimeColored} date formatting function
 */
function getDateFormatter (options) {
  if (options.color) {
    return formatDateTimeColored
  }
  return formatDateTime
}

// tree

const FILL = '│   '
const ITEM = '├── '
const LAST = '└── '
const EMPTY = '    '

function getNextIndent (indent, last) {
  if (last) {
    return indent + EMPTY
  }
  return indent + FILL
}

/**
 * get part for current position in tree
 * @param {String} indent current indent
 * @param {Boolean} last is this the last element in this branch
 * @param {Boolean} root is this the root element of this tree
 * @returns {String} tree part
 */
function getTreeForItem (indent, last, root) {
  if (root) {
    return ''
  }
  if (last) {
    return indent + LAST
  }
  return indent + ITEM
}

/**
 * get tree formatter
 * @param {Object} options
 * @returns {(item:ListResultItem, indent:String, last:Boolean, level:Number)=>String}
 */
function getTreeFormatter (options) {
  const formatName = getNameFormatter(options)

  return function (item, indent, last, level) {
    return getTreeForItem(indent, last, level === 0) + formatName(item)
  }
}

// name

/**
 * transform globbing pattern to regular expression
 * @param {String} glob globbing pattern
 * @returns {String} regular expression
 */
function toRegExpPattern (glob) {
  const converted = glob
    .replaceAll('.', '\\.') // make . literals
    .replaceAll('?', '.') // transform ?
    .replaceAll('*', '.*?') // transform *

  return `^${converted}$`
}

/**
 * get filter function that checks item names against globbing pattern
 * @param {String} glob globbing pattern
 * @returns {(item:ListResultItem) => Boolean}
 */
function getGlobMatcher (glob) {
  const regex = new RegExp(toRegExpPattern(glob), 'i')
  return (item) => regex.test(item.name)
}

/**
 * show displayName of item depending on its type
 * @param {ListResultItem} item the current item
 * @param {String} display the path or name of the item
 * @returns {String} formatted name or path
 */
function formatNameColored (item, display) {
  if (item.type === 'resource') {
    const mimetype = getMimeType(item.name)
    switch (mimetype) {
      case 'text/html': return cc('FgWhite') + display + cc('Reset')
      case 'application/xml': return cc('FgGreen') + display + cc('Reset')
      case 'application/xquery': return cc('FgCyan') + display + cc('Reset')
      case 'application/vnd.xara': return cc('FgRed') + display + cc('Reset')
      default: return display
    }
  }
  return cc('Bright') + cc('FgBlue') + display + cc('Reset')
}

/**
 * get name formatting function for options
 * @param {Object} options options object
 * @returns {BlockFormatter} formatter
 */
function getNameFormatter (options) {
  if (options.recursive && !options.extended) {
    if (options.color) {
      return item => formatNameColored(item, item.path)
    }
    return item => item.path
  }
  if (options.color) {
    return item => formatNameColored(item, item.name)
  }
  return item => item.name
}

// path

function noOp () {}

/**
 * render path colored
 * @param {ListResultItem} item
 * @param {String} separator
 * @returns {void}
 */
function renderColoredPath (item, separator) {
  console.log(separator + cc('Dim') + cc('FgWhite') + item.path + ':' + cc('Reset'))
}

/**
 * render path
 * @param {ListResultItem} item
 * @param {String} separator
 * @returns {void}
 */
function renderPath (item, separator) {
  console.log(separator + item.path + ':')
}

/**
 * Get path rendering function
 * @param {Object} options
 * @returns {renderPath|renderColoredPath|noOp} path rendering function or no-op
 */
function getPathRenderer (options) {
  if (options.recursive && options.extended) {
    if (options.color) {
      return renderColoredPath
    }
    return renderPath
  }
  return noOp
}

// size

const FORMAT_SIZE_BASE = 1024
const FORMAT_SIZE_PAD = 7

/**
 * convert raw bytes to humand readable size string
 * @param {Number} size bytes
 * @returns {String} human readable size
 */
function formatSizeHumanReadable (size) {
  if (size === 0) {
    return '0 B '.padStart(FORMAT_SIZE_PAD)
  }
  const power = Math.floor(Math.log(size) / Math.log(FORMAT_SIZE_BASE))
  const _s = size / Math.pow(FORMAT_SIZE_BASE, power)
  const _p = Math.floor(Math.log(_s) / Math.log(10))
  const digits = _p < 2 ? 1 : 0
  const humanReadableSize = _s.toFixed(digits) + ' ' +
    ['B ', 'KB', 'MB', 'GB', 'TB'][power]

  return humanReadableSize.padStart(FORMAT_SIZE_PAD)
}

/**
 * get size formatting function
 * @param {ListOptions} options
 * @param {BlockPaddings} paddings
 * @returns {BlockFormatter} formatting function
 */
function getSizeFormatter (options, paddings) {
  let formatter
  if (options.size === 'bytes') {
    const padStart = paddings.get('padSize')
    formatter = (size) => size.toFixed(0).padStart(padStart)
  } else {
    formatter = formatSizeHumanReadable
  }
  if (options.color) {
    return (item) => cc('Bright') + cc('FgYellow') + formatter(item.size) + cc('Reset')
  }
  return (item) => formatter(item.size)
}

// mode

/**
 * prepend collection indicator or dot to mode string
 * @param {ListResultItem} item current list item
 * @returns {String} prepended mode
 */
function withCollectionIndicator (item) {
  return (item.type === 'collection' ? 'c' : '.') + item.mode
}

/**
 * color mode string
 * @param {ListResultItem} item current list item
 * @returns {String} prepended, colored mode
 */
function formatModeColor (item) {
  return withCollectionIndicator(item)
    .split('')
    .map(p => {
      switch (p) {
        case 'c': return cc('Bright') + cc('FgBlue') + p + cc('Reset')
        case 'r': return cc('FgGreen') + p + cc('Reset')
        case 'w': return cc('FgYellow') + p + cc('Reset')
        case 'x': return cc('FgRed') + p + cc('Reset')
        case 's': return cc('FgCyan') + p + cc('Reset')
        case 'S': return cc('Bright') + cc('FgCyan') + p + cc('Reset')
        default: return p
      }
    })
    .join('')
}

/**
 * get mode formatting function
 * @param {ListOptions} options
 * @returns {BlockFormatter} mode formatter
 */
function getModeFormatter (options) {
  if (options.color) {
    return formatModeColor
  }
  return withCollectionIndicator
}

/**
 * get owner formatting function
 * @param {ListOptions} options list rendering options
 * @param {BlockPaddings} paddings block paddings
 * @returns {BlockFormatter} owner formatter
 */
function getOwnerFormatter (options, paddings) {
  const padStart = paddings.get('padOwner')
  if (options.color) {
    return (item) => cc('FgWhite') + item.owner.padStart(padStart) + cc('Reset')
  }
  return (item) => item.owner.padStart(padStart)
}

/**
 * get group formatting function
 * @param {ListOptions} options list rendering options
 * @param {BlockPaddings} paddings block paddings
 * @returns {BlockFormatter} group formatter
 */
function getGroupFormatter (options, paddings) {
  const padStart = paddings.get('padGroup')
  if (options.color) {
    return (item) => cc('FgWhite') + item.group.padStart(padStart) + cc('Reset')
  }
  return (item) => item.group.padStart(padStart)
}

/**
 * get item rendering function
 * @param {Object} options given options
 * @param {BlockFormatter[]} blocks block rendering functions
 * @returns {ItemRenderer|TreeItemRenderer} rendering function
 */
function getItemRenderer (options, blocks) {
  if (options.tree) {
    return function (item, indent = '', last = false, level = 1) {
      const output = blocks.map(bf => bf(item, indent, last, level))
      console.log(output.join(' '))
    }
  }
  return function (item) {
    const output = blocks.map(bf => bf(item))
    console.log(output.join(' '))
  }
}

// sorting

/**
 * sort items by their name in alphabetical order
 * @param {ListResultItem} itemA
 * @param {ListResultItem} itemB
 * @returns {Number} sort direction
 */
function sortByName (itemA, itemB) {
  return itemA.name.localeCompare(itemB.name)
}

/**
 * sort items by their size
 * @param {ListResultItem} itemA
 * @param {ListResultItem} itemB
 * @returns {Number} sort direction
 */
function sortBySize (itemA, itemB) {
  return itemA.size - itemB.size
}

/**
 * get type for item
 * resource extension, which could be an empty string
 * or "__collection__" for collections
 * @param {ListResultItem} item resource or collection name
 * @returns {String}
 */
function getType (item) {
  if (isCollection(item)) { return '__collection' }

  const lastDot = item.name.lastIndexOf('.')
  if (lastDot < 0) {
    return ''
  }
  return item.name.substring(lastDot + 1)
}

/**
 * sort items by their extension and type
 * @param {ListResultItem} itemA
 * @param {ListResultItem} itemB
 * @returns {Number} sort direction
 */
function sortByType (itemA, itemB) {
  const extA = getType(itemA)
  const extB = getType(itemB)
  return extA.localeCompare(extB)
}

/**
 * get the modified date as milliseconds since epoch start
 * @param {ListResultItem} item result item
 * @returns {Number} milliseconds since epoch start
 */
function getModifiedMillis (item) {
  const d = new Date(item.modified)
  return d.getTime()
}

/**
 * sort items by their modified time
 * @param {ListResultItem} itemA
 * @param {ListResultItem} itemB
 * @returns {Number} sort direction
 */
function sortByTime (itemA, itemB) {
  const mtA = getModifiedMillis(itemA)
  const mtB = getModifiedMillis(itemB)
  return mtA - mtB
}

/**
 * get sorting function
 * @param {ListOptions} options given options
 * @returns {ItemSorter} sorting function
 */
function getSorter (options) {
  const { reverse, extensionsort, sizesort, timesort } = options
  const sorters = []
  if (sizesort) {
    sorters.push(sortBySize)
  }
  if (timesort) {
    sorters.push(sortByTime)
  }
  if (extensionsort) {
    sorters.push(sortByType)
  }
  sorters.push(sortByName)
  return (a, b) => {
    let v = 0
    let i = 0
    let sf = sorters[i]
    while (v === 0 && sf) {
      v = reverse ? sf(b, a) : sf(a, b)
      sf = sorters[++i]
    }
    return v
  }
}

// list

/**
 * get list rendering function
 * @param {ListOptions} options list rendering options
 * @param {ItemRenderer|TreeItemRenderer} renderItem item rendering function
 * @param {ItemSorter} sortItemList sorting function
 * @returns {function} list rendering function
 */
function getListRenderer (options, renderItem, sortItemList) {
  if (options.tree) {
    const renderTreeList = function (list, indent = '', level = 1) {
      const l = list.length
      const sortedList = list.sort(sortItemList)
      for (let index = 0; index < l; index++) {
        const item = sortedList[index]
        const isLastItem = index === l - 1
        renderItem(item, indent, isLastItem, level)
        if (item.children) {
          // sort
          renderTreeList(item.children, getNextIndent(indent, isLastItem), level + 1)
        }
      }
    }
    return renderTreeList
  }
  if (options.recursive) {
    const matchesGlob = getGlobMatcher(options.glob)
    const renderPath = getPathRenderer(options)
    const extended = options.extended

    const renderRecursiveList = function (parent, separator = true) {
      const list = parent.children
      const sortedList = list.sort(sortItemList)
      const filteredSortedList = sortedList.filter(matchesGlob)

      // maybe render the path
      if (filteredSortedList.length) {
        renderPath(parent, separator ? '\n' : '')
      }
      // maybe render the path
      for (let l = filteredSortedList.length, index = 0; index < l; index++) {
        const item = filteredSortedList[index]
        renderItem(item)
        if (extended || !isCollection(item)) { continue }
        renderRecursiveList(item)
      }
      if (!extended) { return }
      const collections = sortedList.filter(isCollection)
      for (let cl = collections.length, ci = 0; ci < cl; ci++) {
        const collection = collections[ci]
        // sort
        renderRecursiveList(collection)
      }
    }
    return renderRecursiveList
  }
  const renderList = function (list) {
    list.sort(sortItemList).forEach(renderItem)
  }
  return renderList
}

/**
 * list elements in exist db and output to stdout
 * @param {import("@existdb/node-exist").NodeExist} db database client
 * @param {String} collection path to collection in db
 * @param {ListOptions} options command line options
 * @returns {void}
 */
async function ls (db, collection, options) {
  const { glob, extended, tree, recursive, depth } = options
  const result = await db.queries.readAll(query, {
    variables: {
      collection,
      glob,
      extended,
      depth,
      recursive: tree || recursive,
      'collections-only': options['collections-only']
    }
  })
  const json = JSON.parse(result.pages.toString())
  if (json.error) {
    if (options.debug) {
      console.error(json.error)
    }
    throw Error(json.error.description)
  }
  if (options.debug) {
    console.log(json)
  }

  const list = json.children
  const blocks = []

  if (extended) {
    const paddings = getPaddings(list)
    blocks.push(getModeFormatter(options))
    blocks.push(getOwnerFormatter(options, paddings))
    blocks.push(getGroupFormatter(options, paddings))
    blocks.push(getSizeFormatter(options, paddings))
    blocks.push(getDateFormatter(options, paddings))
  }

  if (tree) {
    blocks.push(getTreeFormatter(options))
  } else {
    blocks.push(getNameFormatter(options))
  }

  const sortItemList = getSorter(options)
  const renderItem = getItemRenderer(options, blocks)
  const renderList = getListRenderer(options, renderItem, sortItemList)

  if (tree) {
    renderItem(json, '', false, 0)
  }
  if (recursive) {
    return renderList(json, false)
  }
  renderList(list)
}

export const command = ['list [options] <collection>', 'ls']
export const describe = 'List connection contents'

const options = {
  G: {
    alias: 'color',
    describe: 'Color the output',
    default: false,
    type: 'boolean'
  },
  l: {
    alias: 'extended',
    describe: 'Display more information for each item',
    default: false,
    type: 'boolean'
  },
  R: {
    alias: 'recursive',
    describe: 'Descend down the collection tree',
    type: 'boolean'
  },
  d: {
    alias: 'depth',
    describe: 'Limit how deep to traverse down collection the collection tree',
    default: 0,
    type: 'number'
  },
  x: {
    alias: 'extensionsort',
    describe: 'Sort by file extension',
    type: 'boolean'
  },
  s: {
    alias: 'sizesort',
    describe: 'Sort by size',
    type: 'boolean'
  },
  t: {
    alias: 'timesort',
    describe: 'Sort by time modified',
    type: 'boolean'
  },
  r: {
    alias: 'reverse',
    describe: 'Reverse the order of the sort',
    type: 'boolean'
  },
  T: {
    alias: 'tree',
    describe: 'Show as tree',
    type: 'boolean'
  },
  c: {
    alias: 'collections-only',
    describe: 'Only show collections',
    default: false,
    type: 'boolean'
  },
  g: {
    alias: 'glob',
    describe:
          'Include only collection names and resources whose name match the pattern.',
    type: 'string',
    default: '*'
  },
  size: {
    describe: 'How to display resource size',
    choices: ['short', 'bytes'],
    default: 'short'
  }
}

export const builder = yargs => {
  return yargs.options(options)
    .conflicts('R', 'T')
}

/**
 * handle list command
 * @param {ListOptions} argv options
 * @returns {Number} exit code
 */
export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  const { glob, collection } = argv

  if (glob.includes('**')) {
    console.error('Invalid value for option "glob"; "**" is not supported yet')
    return 1
  }

  const db = connect(argv.connectionOptions)

  return ls(db, collection, argv)
}
