import { readFileSync, existsSync } from 'node:fs'
import * as dotenv from 'dotenv'

// read connection options from .env file in current working directory
dotenv.config()

/**
 * read config files in .env, .existdb.json or node-exist format
 * @param {String} configPath path to the configuarion file
 * @returns {Object} configuration
 */
export function configure (configPath) {
  if (!existsSync(configPath)) {
    throw new Error('Configfile not found! "' + configPath + '"')
  }
  if (/\.env(\..+)?$/.test(configPath)) {
    const { parsed } = dotenv.config({ path: configPath })
    if (!parsed) throw new Error(configPath + ' could not be read')
    return compileConnectionOptions(parsed.EXISTDB_SERVER, parsed.EXISTDB_USER, parsed.EXISTDB_PASS)
  }
  if (/\.existdb\.json$/.test(configPath)) {
    return fromExistdbJson(configPath)
  }
  const contents = readFileSync(configPath, 'utf-8')
  return JSON.parse(contents)
}

/**
 * read the sync server connection from .existdb.json file
 * @param {String} configPath path to the configuarion file
 * @returns {Object} configuration
 */
function fromExistdbJson (configPath) {
  const contents = readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(contents)
  const serverName = parsed.sync.server
  const { server, user, password } = parsed.servers[serverName]

  return compileConnectionOptions(server, user, password)
}

function compileConnectionOptions (server, user, pass) {
  // console.log(server, user, pass)
  const connectionOptions = {}
  if (user && typeof pass === 'string') {
    connectionOptions.basic_auth = { user, pass }
  }

  if (server) {
    const { port, hostname, protocol } = new URL(server)

    if (!['https:', 'http:'].includes(protocol)) {
      throw new Error('Unknown protocol: "' + protocol + '"!')
    }

    connectionOptions.secure = protocol === 'https:'
    connectionOptions.host = hostname
    connectionOptions.port = port
  }

  return { connectionOptions }
}
