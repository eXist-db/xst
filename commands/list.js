import { connect } from '@existdb/node-exist'
import { cc } from '../utility/console.js'
import { readXquery } from '../utility/xq.js'

const query = readXquery('list-resources.xq')

const initialPaddings = new Map([
  ['padOwner', 0],
  ['padGroup', 0],
  ['padSize', 4]
])

const padReducer = (res, next) => {
  if (res.get('padGroup') < next.group.length) {
    res.set('padGroup', next.group.length)
  }
  if (res.get('padOwner') < next.owner.length) {
    res.set('padOwner', next.owner.length)
  }
  if (res.get('padSize') < next.size.toFixed().length) {
    res.set('padSize', next.size.toFixed().length)
  }
  return res
}

const getPaddings = (list) => list.reduce(padReducer, initialPaddings)

const timeFormat = {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit'
}
const dateFormat = {
  month: 'short'
}

const currentYear = (new Date()).getFullYear()

function formatDateTime (xsDateTime) {
  const date = new Date(xsDateTime)
  const year = date.getFullYear()
  const month = date.toLocaleDateString('iso', dateFormat)
  const day = date.getDate().toString().padStart(3)
  if (year < currentYear) {
    return month + day + year.toString().padStart(6)
  }
  const time = date.toLocaleTimeString('iso', timeFormat).padStart(6)
  return month + day + time
}

function formatName (item, color) {
  if (!color) {
    return item.name
  }
  if (item.type === 'resource') {
    return item.name
  }
  return cc('Bright') + cc('FgCyan') + item.name + cc('Reset')
}

function renderList (list, color) {
  for (const item of list) {
    console.log(formatName(item, color))
  }
}

function renderExtendedListItem (item, paddings, color) {
  console.log(
    item.mode,
    item.owner.padStart(paddings.get('padOwner')),
    item.group.padStart(paddings.get('padGroup')),
    item.size.toFixed().padStart(paddings.get('padSize')),
    formatDateTime(item.modified),
    formatName(item, color)
  )
}

function renderExtendedList (list, noColor) {
  const paddings = getPaddings(list)
  for (const item of list) {
    renderExtendedListItem(item, paddings, noColor)
  }
}

async function ls (db, collection, options) {
  const { glob, color, extended } = options
  const result = await db.queries.readAll(query, {
    variables: { collection, glob, extended }
  })
  const json = JSON.parse(result.pages.toString())
  if (json.error) {
    throw Error(json.error)
  }
  if (extended) {
    renderExtendedList(json, color)
    return
  }
  renderList(json, color)
}

export const command = ['list [options] <collection>', 'ls']
export const describe = 'List connection contents'

export const builder = {
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
  g: {
    alias: 'glob',
    describe:
            'Include only collection names and resources whose name match the pattern.',
    type: String,
    default: '*'
  }
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  const { glob, color, extended, collection } = argv

  if (typeof glob !== 'string') {
    console.error('Invalid value for option "glob"; must be a string.')
    return 1
  }

  const db = connect(argv.connectionOptions)

  return ls(db, collection, { glob, color, extended })
}
