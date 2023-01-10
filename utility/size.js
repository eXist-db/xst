import { ct } from './console.js'

/**
 * @typedef {(item:ListResultItem) => String} BlockFormatter
 */
/**
 * @typedef {Object} OptionsWithSize
 * @prop {"human"|"bytes"} size size format
 */
/**
 * @typedef {import('./padding.js').BlockPaddings} BlockPaddings
 */

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
 * pad raw bytes to match longest size
 * @param {Number} size bytes
 * @param {BlockPaddings} paddings padding map
 * @returns {(size:Number) => String} formatting function
 */
function byteFormatter (paddings) {
  const padStart = paddings.get('size')
  return (size) => size.toFixed(0).padStart(padStart)
}

/**
 * get size formatting function
 * @param {OptionsWithSize} options
 * @param {BlockPaddings} paddings
 * @returns {BlockFormatter} formatting function
 */
export function getSizeFormatter (options, paddings) {
  const formatter = options.size === 'bytes'
    ? byteFormatter(paddings)
    : formatSizeHumanReadable

  if (options.color) {
    return (item) => ct(formatter(item.size), 'FgYellow', 'Bright')
  }
  return (item) => formatter(item.size)
}

/**
 * yargs option definition for the size parameter
 */
export const sizeOption = {
  size: {
    describe: 'How to display resource size',
    choices: ['short', 'bytes'],
    default: 'short'
  }
}
