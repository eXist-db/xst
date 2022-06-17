import { connect } from '@existdb/node-exist'
import { readXquery } from '../utility/xq.js'

const query = readXquery('tree.xq')

const FILL  = '│   '
const ITEM  = '├── '
const LAST  = '└── '
const EMPTY = '    '

function renderItem (name, indent, last, root) {
  if (root) {
    return name
  }
  if (last) {
    return indent + LAST + name
  }
  return indent + ITEM + name
}

function getNextIndent (indent, last, root) {
  if (root) {
    return indent
  }
  if (last) {
    return indent + EMPTY
  }
  return indent + FILL
}

function renderTree (json, level = 0, indent = '', last = false) {
  const item = renderItem(json.name, indent, last, level === 0)
  console.log(item)

  if (!json.children || json.type === 'resource') {
    return
  }

  const nextLevel = level + 1
  const nextIndent = getNextIndent(indent, last, level === 0)
  const length = json.children.length - 1
  json.children.forEach((nextItem, index) => renderTree(nextItem, nextLevel, nextIndent, length === index))
}

async function tree (db, collection, level) {
  try {
    const result = await db.queries.readAll(query, { variables: { collection, level } })
    const json = JSON.parse(result.pages.toString())
    renderTree(json)
    return 0
  } catch (e) {
    const message = e.faultString ? e.faultString : e.message
    console.error('Could not run query! Reason:', message)
    return 1
  }
}

export const command = 'tree [options] <collection>'
export const describe = 'List a collection and its contents as a tree'

export const builder = {
  l: {
    alias: 'level',
    describe: 'The maximum depth of the tree. Setting this to zero will output the complete tree.',
    type: Number,
    default: 0
  }
}
export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  const { level, collection } = argv

  if (typeof level !== 'number' || level < 0) {
    console.error('Invalid value for option "level"; must be an integer greater than zero.')
    return 1
  }
  const db = connect(argv.connectionOptions)

  return await tree(db, collection, level)
}
