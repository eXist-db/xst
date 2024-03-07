import chalk from 'chalk'

/**
 * @type {String} bright green checkmark
 */
export const check = chalk.green('✔︎')
/**
 * @type {String} bright red heavy cross
 */
export const fail = chalk.red('✘')

export const skip = chalk.yellow('-')

/**
 * log operation success message
 * @param {any[]} message
 * @returns {void}
 */
export function logSuccess (message) {
  console.log(`${check} ${message}`)
}

/**
 * log operation failure message
 * @param {any[]} message
 * @returns {void}
 */
export function logFailure (message) {
  console.error(`${fail} ${message}`)
}

/**
 * log no operation message
 * @param {any[]} message
 * @returns {void}
 */
export function logSkipped (message) {
  console.log(`${skip} ${message}`)
}
