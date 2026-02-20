/**
 * Gather connection options suitable for automated and manual testing
 * of an off-the-shelf exist-db instance (e.g. in a CI environment)
 * Allows overriding specific setting via environment variables.
 *
 * EXISTDB_SERVER - URL to the exist-db you want to connect to
 * EXISTDB_USER - username of the user the queries should be executed with
 *     defaults to "guest"
 * EXISTDB_PASS - password to authenticate EXISTDB_USER
 *     must be set for EXISTDB_USER to take effect
 */
import { readOptionsFromEnv } from '@existdb/node-exist'
import { defaultConnectionOptions } from '@existdb/node-exist/util/connect.js'
import { getAccountInfo, AdminGroup } from '../utility/account.js'
import { findUpSync } from 'find-up-simple'
import { loadEnvFile } from 'node:process'

/**
 * @typedef { import("@existdb/node-exist").NodeExistXmlRpcClient } NodeExistXmlRpcClient
 */
/**
 * @typedef { import("./account.js").AccountInfo } AccountInfo
 */

/**
 * Merge connection options with environment variables
 * @param {object} argv all options, from command line and config file
 * @returns {object} argv with connection options resolved
 */
export function readConnection (argv) {
  // read connection options from .env file in current working directory or any parent directory
  // existing environment variables take precedence
  const path = findUpSync('.env')
  if (path) {
    loadEnvFile(path)
  }

  const connectionOptions = Object.assign({}, defaultConnectionOptions, readOptionsFromEnv(), argv.connectionOptions)
  if (argv.verbose) {
    const { protocol, host, port } = connectionOptions
    const user = connectionOptions.basic_auth.user
    console.error(`Connecting to ${protocol}//${host}:${port} as ${user}`)
  }
  argv.connectionOptions = connectionOptions
  return argv
}

/**
 * get server Address
 * @param {NodeExistXmlRpcClient} db client
 * @returns {String} server address
 */
export function getServerUrl (db) {
  return db.connection.server
}

/**
 * get the user account information that will be used to connect to the db
 * @param {NodeExistXmlRpcClient} db client
 * @returns {Promise<AccountInfo>} user info object
 */
export async function getUserInfo (db) {
  return await getAccountInfo(db, db.connection.user)
}

/**
 * check whether a user account has administrator privileges
 * @param {AccountInfo} accountInfo
 * @returns {Boolean}
 */
export function isDBAdmin (accountInfo) {
  return accountInfo.groups.includes(AdminGroup)
}
