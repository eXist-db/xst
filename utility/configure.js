import { readFileSync, existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { findUpSync } from 'find-up-simple'
// read connection options from .env file in current working directory or any parent directory
// existing environment variables take precedence
const path = findUpSync('.env')
if (path) {
  loadEnvFile(path)
}

/**
 * read configuration files in .env, .existdb.json or node-exist format

 configuration cascade (precedence)

 1. parameters set in --config (including connection options)
 2. environment variables (server, user, password, color, editor)
 3. environment variables set in .env file in current or descendant directory
 4. options set on command line (cannot contain connection options)

 * @param {String} configPath path to the configuration file
 * @returns {Object} configuration
 */
export function configure (configPath) {
  if (!existsSync(configPath)) {
    throw new Error('Configfile not found! "' + configPath + '"')
  }
  if (/\.env(\..+)?$/.test(configPath)) {
    loadEnvFile(configPath)
    const { EXISTDB_SERVER, EXISTDB_PASS, EXISTDB_USER } = process.env
    return compileConnectionOptions(EXISTDB_SERVER, EXISTDB_USER, EXISTDB_PASS)
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

    connectionOptions.host = hostname
    connectionOptions.port = port
    connectionOptions.protocol = protocol
  }

  return { connectionOptions }
}
