import { ct } from './console.js'

const timeFormat = {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit'
}
const dateFormat = {
  month: 'short'
}

const now = new Date()
const currentYear = now.getFullYear()
const nowMs = now.getTime()

/**
 * format date to short representation
 * @param {Date} date
 * @returns {String} formatted date
 */
function formatDateShort (date) {
  const year = date.getFullYear()
  const month = date.toLocaleDateString('iso', dateFormat)
  const day = date.getDate().toString().padStart(3)
  if (year < currentYear) {
    return month + day + year.toString().padStart(6)
  }
  const time = date.toLocaleTimeString('iso', timeFormat).padStart(6)
  return month + day + time
}

const quarterHour = 900000
const hour = 3600000
const day = 86400000
const month = 2592000000
const quarterYear = 7776000000
const year = 31104000000
const steps = [year, quarterYear, month, day, hour, quarterHour]
const greens = [70, 34, 40, 114, 84, 156]

/**
 * receive a color from the greens palette to color a date
 * relative to the current date
 * @param {Date} date the date to get the color for
 * @returns {Number} xterm256color
 */
function colorForDate (date) {
  const msSince = nowMs - date.getTime()
  const index = steps.reduce((acc, next, step) => (msSince < next ? step : acc), 0)
  return greens[index]
}

/**
 * get date formatting function
 * @param {ListOptions} options list rendering options
 * @returns {(item:ListResultItem) => String} date formatting function
 */
export function getDateFormatter (options, prop) {
  let formatter = formatDateShort
  if (options.date === 'iso') {
    formatter = (date) => date.toISOString()
  }
  if (options.color) {
    return (item) => {
      const date = new Date(item[prop])
      const formattedDate = formatter(date)
      return ct(formattedDate, colorForDate(date))
    }
  }
  return (item) => formatter(new Date(item[prop]))
}
