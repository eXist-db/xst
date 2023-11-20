import chalk from 'chalk'

/**
 * @type {String} bright green checkmark
 */
export const check = chalk.greenBright('✔︎')
/**
 * @type {String} bright red heavy cross
 */
export const fail = chalk.redBright('✘')

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
