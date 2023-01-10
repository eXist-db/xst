// tree

/**
 * @typedef {(item:T, indent:String, last:Boolean, level:Number) => String} TreeItemRenderer<T>
 * @template T
 */

/**
 * @typedef {(item:T) => string} BlockFormatter<T>
 * @template T
 */

const FILL = '│   '
const ITEM = '├── '
const LAST = '└── '
const EMPTY = '    '

/**
 * get part for current position in tree
 * @param {String} indent current indent
 * @param {Boolean} last is this the last element in this branch
 * @param {Number} level the current level
 * @returns {String} tree part
 */
function getTreeForItem (indent, last, level) {
  if (level === 0) {
    return ''
  }
  if (last) {
    return indent + LAST
  }
  return indent + ITEM
}

/**
 * shift indent for nested lists
 * @param {String} indent current indent
 * @param {Boolean} last is the current item the last one
 * @returns {String} next indent
 */
export function getNextIndent (indent, last) {
  if (last) {
    return indent + EMPTY
  }
  return indent + FILL
}

/**
 * get tree formatter for type T
 * @param {BlockFormatter<T>} itemFormatter render item after tree
 * @returns {TreeItemRenderer<T>} render tree item
 * @template T item type
 */
export function getTreeFormatter (itemFormatter) {
  return function (item, indent, last, level) {
    return getTreeForItem(indent, last, level) + itemFormatter(item)
  }
}
