import { connect, getMimeType } from '@existdb/node-exist'
import { ct } from '../utility/console.js'
import { readXquery } from '../utility/xq.js'
import { getDateFormatter } from '../utility/colored-date.js'
import { multiSort } from '../utility/sorter.js'
import { recursivePadReducer } from '../utility/padding.js'
import { getSizeFormatter } from '../utility/size.js'
import { getGlobMatcher } from '../utility/glob.js'
import { getTreeFormatter, getNextIndent } from '../utility/tree.js'

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
 * @prop {Boolean} long show more info per entry in list
 * @prop {boolean} collectionsOnly only show collections
 * @prop {"human"|"bytes"} size size format
 * @prop {"short"|"iso"} date format for dates
 * @prop {Boolean} recursive traverse the tree
 * @prop {Boolean} tree show output as a tree
 * @prop {Number} depth how many levels to traverse down for recursive and tree views
 * @prop {String} glob filter items
 * @prop {Object} connectionOptions DB connection options
 */

/**
 * @typedef {(item:ListResultItem) => void} ItemRenderer
 */
/**
 * @typedef {import('../utility/tree.js').TreeItemRenderer<T>} TreeItemRenderer<T>
 */
/**
 * @typedef {import('../utility/tree.js').BlockFormatter<T>} BlockFormatter<T>
 */
/**
 * @typedef { import('../utility/sorter.js').ItemSorter} ItemSorter
 */
/**
 * @typedef { import('../utility/padding.js').BlockPaddings} BlockPaddings
 */
/**
 * @typedef { import('../utility/padding.js').PaddingReduceer} PaddingReduceer
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
 * @type {BlockPaddings}
 */
const initialPaddings = new Map([
  ['owner', 0],
  ['group', 0],
  ['size', 4]
])

/**
 * get block paddings for list
 * @param {ListResultItem[]} list of result items
 * @returns {BlockPaddings} block paddings for list
 */
function getPaddings (list) {
  const reducer = recursivePadReducer('children')
  return list.reduce(reducer, initialPaddings)
}

// name

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
      case 'text/html': return ct(display, 'FgWhite')
      case 'application/xml': return ct(display, 'FgGreen')
      case 'application/xquery': return ct(display, 'FgCyan')
      case 'application/vnd.xara': return ct(display, 'FgRed')
      default: return display
    }
  }
  return ct(display, 'FgBlue', 'Bright')
}

/**
 * get name formatting function for options
 * @param {ListOptions} options options object
 * @returns {BlockFormatter<ListResultItem>} formatter
 */
function getNameFormatter (options) {
  if (options.recursive && !options.long) {
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

const noOp = () => {}

/**
 * render path colored
 * @param {ListResultItem} item
 * @param {String} separator
 * @returns {void}
 */
function renderColoredPath (item, separator) {
  const coloredPath = ct(item.path + ':', 'FgWhite', 'Dim')
  console.log(separator + coloredPath)
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
  if (options.recursive && options.long) {
    if (options.color) {
      return renderColoredPath
    }
    return renderPath
  }
  return noOp
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
    .map(mode => {
      switch (mode) {
        case 'c': return ct(mode, 'FgBlue', 'Bright')
        case 'r': return ct(mode, 'FgGreen')
        case 'w': return ct(mode, 'FgYellow')
        case 'x': return ct(mode, 'FgRed')
        case 's': return ct(mode, 'FgCyan')
        case 'S': return ct(mode, 'FgCyan', 'Bright')
        default: return mode
      }
    })
    .join('')
}

/**
 * get mode formatting function
 * @param {ListOptions} options
 * @returns {BlockFormatter<ListResultItem>} mode formatter
 */
function getModeFormatter (options) {
  if (options.color) {
    return formatModeColor
  }
  return withCollectionIndicator
}

/**
 * pad prop with spaces to length at the end
 * @param {String} prop property to pad
 * @param {BlockPaddings} paddings block paddings
 * @returns {BlockFormatter<ListResultItem>} padEnd prop to length
 */
function padEnd (prop, paddings) {
  const length = paddings.get(prop)
  return item => item[prop].padEnd(length)
}

/**
 * get owner formatting function
 * @param {ListOptions} options list rendering options
 * @param {BlockPaddings} paddings block paddings
 * @returns {BlockFormatter<ListResultItem>} owner formatter
 */
function getOwnerFormatter (options, paddings) {
  const padOwner = padEnd('owner', paddings)
  if (options.color) {
    return (item) => ct(padOwner(item), 'FgWhite')
  }
  return padOwner
}

/**
 * get group formatting function
 * @param {ListOptions} options list rendering options
 * @param {BlockPaddings} paddings block paddings
 * @returns {BlockFormatter<ListResultItem>} group formatter
 */
function getGroupFormatter (options, paddings) {
  const padGroup = padEnd('group', paddings)
  if (options.color) {
    return (item) => ct(padGroup(item), 'FgWhite')
  }
  return padGroup
}

/**
 * get item rendering function
 * @param {ListOptions} options given options
 * @param {BlockFormatter<ListResultItem>[]} blocks block rendering functions
 * @returns {ItemRenderer|TreeItemRenderer<ListResultItem>} rendering function
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
  return itemB.size - itemA.size
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
  return mtB - mtA
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
  return (a, b) => multiSort(a, b, sorters, reverse)
}

// list

/**
 * get list rendering function
 * @param {ListOptions} options list rendering options
 * @param {ItemRenderer|TreeItemRenderer<ListResultItem>} renderItem item rendering function
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
    const long = options.long

    const renderRecursiveList = function (parent, separator = true) {
      const list = parent.children
      const sortedList = list.sort(sortItemList)

      // maybe render the path
      if (long && sortedList.filter(matchesGlob).length) {
        renderPath(parent, separator ? '\n' : '')
      }
      // maybe render the path
      for (let l = sortedList.length, index = 0; index < l; index++) {
        const item = sortedList[index]
        if (matchesGlob(item)) {
          renderItem(item)
        }
        if (!long && isCollection(item)) {
          renderRecursiveList(item)
        }
      }
      if (!long) { return }
      const collections = sortedList.filter(isCollection)
      for (let cl = collections.length, ci = 0; ci < cl; ci++) {
        const collection = collections[ci]
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
  const { glob, long, tree, recursive, depth } = options
  const result = await db.queries.readAll(query, {
    variables: {
      collection,
      glob,
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

  if (long) {
    const paddings = getPaddings(list)
    blocks.push(getModeFormatter(options))
    blocks.push(getOwnerFormatter(options, paddings))
    blocks.push(getGroupFormatter(options, paddings))
    blocks.push(getSizeFormatter(options, paddings))
    blocks.push(getDateFormatter(options, 'modified'))
  }

  const nameFmt = getNameFormatter(options)
  if (tree) {
    blocks.push(getTreeFormatter(nameFmt))
  } else {
    blocks.push(nameFmt)
  }

  const sortItemList = getSorter(options)
  const renderItem = getItemRenderer(options, blocks)
  const renderList = getListRenderer(options, renderItem, sortItemList)

  if (recursive) {
    return renderList(json, false)
  }

  if (tree) {
    renderItem(json, '', false, 0)
  }
  renderList(list)
}

export const command = ['list [options] <collection>', 'ls']
export const describe = 'List collection contents'

const options = {
  G: {
    alias: 'color',
    describe: 'Color the output',
    default: false,
    type: 'boolean'
  },
  l: {
    alias: 'long',
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
  },
  date: {
    describe: 'How to display resource dates',
    choices: ['short', 'iso'],
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
