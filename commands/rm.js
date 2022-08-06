import { connect } from '@existdb/node-exist'
import { readXquery } from '../utility/xq.js'

/**
 * @typedef { import("node-exist").NodeExist } NodeExist
 */

/**
 * the xquery file to execute on the DB
 */
const query = readXquery('rm.xq')

const protectedPaths = [
  '/',
  '/db',
  '/db/apps',
  '/db/system',
  '/db/system/config',
  '/db/system/repo',
  '/db/system/security',
  '/db/system/security/exist',
  '/db/system/security/exist/accounts',
  '/db/system/security/exist/groups'
]

function guardProtectedPaths (paths) {
  let foundProtectedPaths = false
  paths.forEach(path => {
    if (path === '') {
      console.error('Cannot remove protected path: /')
      foundProtectedPaths = true
      return
    }
    if (protectedPaths.includes(path)) {
      console.error(`Cannot remove protected path: ${path}`)
      foundProtectedPaths = true
    }
  })
  return foundProtectedPaths
}

function normalizePath (path) {
  if (path.endsWith('/')) {
    return path.substring(0, path.length - 1)
  }
  return path
}

/**
 * remove collections and resources in exist db
 * @param {import("@existdb/node-exist").NodeExist} db database client
 * @param {[String]} paths path to collection in db
 * @param {RemoveOptions} options command line options
 * @returns {void}
 */
async function rm (db, paths, options) {
  const { /* glob, dryRun, */ recursive, force } = options
  const result = await db.queries.readAll(query, {
    variables: {
      paths,
      // glob,
      // dryRun,
      recursive,
      force
    }
  })
  const json = JSON.parse(result.pages.toString())
  if (json.error) {
    if (options.debug) {
      console.error(json.error)
    }
    throw Error(json.error.description)
  }
  if (options.debug) {
    console.log(json)
  }

  json.list.forEach(item => {
    const { success, path } = item
    if (success) {
      console.log('✔︎ ' + path)
      return
    }
    console.error('✘ ' + path + ' - ' + item.error.description)
  })
}

export const command = ['remove [options] <paths..>', 'rm', 'delete', 'del']
export const describe = 'remove collections and resources'

const options = {
  // g: {
  //   alias: 'glob',
  //   describe:
  //         'remove only collection names and resources whose name match the pattern.',
  //   type: 'string',
  //   default: '*'
  // },
  // d: {
  //   alias: 'dry-run',
  //   describe: 'Only list what would be deleted',
  //   type: 'boolean'
  // },
  r: {
    alias: 'recursive',
    describe: 'Descend down the collection tree',
    type: 'boolean'
  },
  f: {
    alias: 'force',
    describe: 'Force deletion of non-empty collections',
    type: 'boolean'
  }
}

export const builder = yargs => yargs.options(options)

/**
 * handle rm command
 * @param {RemoveOptions} argv options
 * @returns {Number} exit code
 */
export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  const { /* glob, */ paths, connectionOptions } = argv

  // if (glob.includes('**')) {
  //   console.error('Invalid value for option "glob"; "**" is not supported yet')
  //   return 1
  // }

  const normalized = paths.map(normalizePath)

  if (guardProtectedPaths(normalized)) {
    return 1
  }

  const db = connect(connectionOptions)

  return rm(db, normalized, argv)
}
