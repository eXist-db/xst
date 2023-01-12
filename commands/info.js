import { connect } from '@existdb/node-exist'
import { readXquery } from '../utility/xq.js'

/**
 * @typedef { import("node-exist").NodeExist } NodeExist
 */

/**
 * the xquery file to execute on the DB
 */
const query = readXquery('info.xq')

async function info (db, options) {
  const result = await db.queries.readAll(query, {})
  const json = JSON.parse(result.pages.toString())
  if (json.error) {
    if (options.debug) {
      console.error(json.error)
    }
    throw Error(json.error.description)
  }
  console.log(`Build: ${json.db.name}-${json.db.version} (${json.db.git})`)
  console.log(`Java: ${json.java.version} (${json.java.vendor})`)
  console.log(`OS: ${json.os.name} ${json.os.version} (${json.os.arch})`)
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
