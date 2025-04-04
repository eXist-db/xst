import { connect } from '@existdb/node-exist'
import { readXquery } from '../utility/xq.js'

/**
 * @typedef { import("@existdb/node-exist").NodeExist } NodeExist
 */

/**
 * @typedef {Object} InfoOptions
 * @prop {boolean} raw output raw JSON reponse
 * @prop {boolean} debug output detailed error
 */

/**
 * the xquery file to execute on the DB
 */
const query = readXquery('info.xq')

/**
 * gather system information on the database instance
 * @param {NodeExist} db database client
 * @param {InfoOptions} options command line options
 * @returns {0|1} exit code
 */
async function info (db, options) {
  const result = await db.queries.readAll(query)
  const raw = result.pages.toString()
  const json = JSON.parse(raw)

  if (json.error) {
    if (options.raw) {
      console.error(raw)
      return 1
    }
    if (options.debug) {
      console.error(json.error)
    }
    throw Error(json.error.description)
  }
  if (options.raw) {
    console.log(raw)
    return 0
  }
  console.log(`Build: ${json.db.name}-${json.db.version} (${json.db.git})`)
  console.log(`Java: ${json.java.version} (${json.java.vendor})`)
  console.log(`OS: ${json.os.name} ${json.os.version} (${json.os.arch})`)
  return 0
}

export const command = ['info']
export const describe = 'Gather system information'

/**
 * handle info command
 * @returns {Number} exit code
 */
export async function handler (argv) {
  if (argv.help) {
    return 0
  }
  const { connectionOptions } = argv
  return info(connect(connectionOptions), argv)
}
