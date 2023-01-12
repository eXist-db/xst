import { resolve, join, posix, dirname, basename } from 'node:path'
import { writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs'
import { connect } from '@existdb/node-exist'

/**
 * @typedef { import("node-exist").NodeExist } NodeExist
 */

/**
 * @typedef {Object} GetOptions
 * @prop {Boolean} verbose output more information
 * @prop {boolean} collectionsOnly only show collections
 * @prop {Boolean} recursive traverse the tree
 * @prop {Number} depth how many levels to traverse down for recursive and tree views
 * @prop {String[]} include filter items
 * @prop {String[]} exclude filter items
 */

/**
 * @typedef {Object} ResourceInfo
 * @prop {Boolean} verbose output more information
 * @prop {boolean} collectionsOnly only show collections
 * @prop {Boolean} recursive traverse the tree
 * @prop {Number} depth how many levels to traverse down for recursive and tree views
 * @prop {String[]} include filter items
 * @prop {String[]} exclude filter items
 */

const stringList = {
  type: 'string',
  array: true,
  coerce: (values) =>
    values.length === 1 && values[0].trim() === 'false'
      ? ['**']
      : values.reduce((values, value) => values.concat(value.split(',').map((value) => value.trim())), [])
}

const xmlBooleanOptionValue = new Map([
  ['true', 'yes'],
  ['yes', 'yes'],
  ['1', 'yes'],
  ['false', 'no'],
  ['no', 'no'],
  ['0', 'no']
])

const xmlBooleanSetting = {
  type: 'string',
  coerce: (value) => {
    console.log(value)
    if (value === null) {
      return value
    }
    if (!xmlBooleanOptionValue.has(value)) {
      throw Error('Unsupported XML serialization option value: ' + value)
    }
    return value
  }
}
const serializationOptionNames = [
  'insert-final-newline',
  'omit-xml-declaration'
]

const serializationDefaults = {
  // "exist:indent": "no",
  // "indent": "no",
  // "output.indent": "no",
  // "compression": "yes"
}

function getSerializationOptions (options) {
  const serializationOptions = serializationDefaults
  serializationOptionNames.forEach(o => {
    if (o in options) {
      serializationOptions[o] = options[o]
    }
  })
  // console.log(serializationOptions)
  return serializationOptions
}

/**
 * Download a single resource into an existdb instance
 * @param {NodeExist.BoundModules} db NodeExist client
 * @param {Boolean} verbose
 * @param {ResourceInfo} resource
 * @param {String} directory
 */
async function downloadResource (db, options, resource, directory, collection, rename) {
  try {
    const { verbose } = options
    let fileContents
    const path = collection ? posix.join(collection, resource.name) : resource.name

    if (resource.type === 'BinaryResource') {
      fileContents = await db.documents.readBinary(path)
    } else {
      fileContents = await db.documents.read(path, getSerializationOptions(options))
    }
    const localName = rename || posix.basename(resource.name)
    const localPath = join(directory, localName)
    await writeFileSync(localPath, fileContents)

    if (verbose) {
      console.log(`✔︎ downloaded resource ${localPath}`)
    }
    return true
  } catch (e) {
    handleError(e, resource.name)
    return false
  }
}

/**
 * download a collection from an existdb instance
 * @param {NodeExist.BoundModules} db NodeExist client
 * @param {boolean} verbose
 * @param {String} collection
 * @param {String} baseCollection
 */
async function downloadCollection (db, options, collection, baseCollection, directory) {
  const absCollection = posix.join(baseCollection, collection)
  const { verbose } = options
  try {
    const collectionMeta = await db.collections.read(absCollection)
    // console.log(collectionMeta)
    const subDirectory = join(directory, collection)
    if (!existsSync(subDirectory)) {
      mkdirSync(subDirectory)
      if (verbose) {
        console.log(`✔︎ created directory ${subDirectory}`)
      }
    }

    const targetDir = posix.join(directory, collection)
    await collectionMeta.documents.forEach(
      async resource => downloadResource(db, options, resource, targetDir, absCollection))

    // recursive (optional?)
    await collectionMeta.collections.forEach(
      async collection => downloadCollection(db, options, collection, absCollection, targetDir))

    return true
  } catch (e) {
    handleError(e, absCollection)
    return false
  }
}

/**
 * Handle errors uploading a resource or creating a collection
 * @param {Error} e
 * @param {String} path
 */
function handleError (e, path) {
  // console.log(e, path)
  const message = e.faultString ? e.faultString : e.message
  console.error(`✘ ${path} could not be created! Reason: ${message}`)
  if (e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
    throw e
  }
}

/**
 * query db, output to standard out
 *
 * @param {NodeExist.BoundModules} db NodeExist client
 * @param {string} path db path
 * @returns {Number}
 */
async function getPathInfo (db, path) {
  const isCol = await db.collections.exists(path)
  if (isCol) {
    const resultcol = await db.collections.read(path)
    return resultcol
  }
  const resultres = await db.resources.describe(path)
  return resultres
}

/**
 *
 * @param {NodeExist.BoundModules} db NodeExist client
 * @param {String} source db path
 * @param {String} target local folder
 * @param {GetOptions} options options
 * @returns {number} return code
 */
async function downloadCollectionOrResource (db, source, target, options) {
  // read parameters
//  const start = Date.now()
  const root = resolve(target)

  if (options.verbose) {
    console.log('Downloading:', source, 'to', root)
    console.log('Server:',
      (db.client.isSecure ? 'https' : 'http') + '://' + db.client.options.host + ':' + db.client.options.port,
      '(v' + options.version + ')'
    )
    console.log('User:', db.client.options.basic_auth.user)
    if (options.include.length > 1 || options.include[0] !== '**') {
      console.log('Include:\n', ...options.include, '\n')
    }
    if (options.exclude.length) {
      console.log('Exclude:\n', ...options.exclude, '\n')
    }
  }

  // initial file
  const info = await getPathInfo(db, source)

  if (!info.name) {
    throw Error(`Source "${source}" could not be found`)
  }

  const targetExists = existsSync(root)
  const parentExists = existsSync(dirname(root))

  // error cases
  if (!parentExists) {
    throw Error(`Target "${dirname(root)}" not found`)
  }

  if (info.type) {
    // if (options.dryRun) {
    //   console.log(info.name)
    //   return 0
    // }

    let localPath, rename

    if (!targetExists) {
      // download one resource into a file to be created
      localPath = dirname(root)
      rename = basename(root)
    } else if (statSync(root).isFile()) {
      // or into an existing file
      localPath = dirname(root)
    } else {
      // download one resource into a folder
      localPath = root
      rename = posix.basename(info.name)
    }
    const success = await downloadResource(db, options, info, localPath, null, rename)
    return success ? 0 : 1
  }

  if (!targetExists) {
    throw Error(`${source} is a collection but ${root} cannot be found`)
  }

  const rootStat = statSync(root)

  if (rootStat.isFile()) {
    throw Error(`source ${source} is a collection and target ${target} is a file`)
  }

  if (!info.type && targetExists && !statSync(root).isDirectory()) {
    throw Error(`${source} is a collection but ${root} is not a directory`)
  }

  // download collection into a folder
  return await downloadCollection(db, options,
    posix.basename(info.name),
    posix.dirname(info.name), root)
}

export const command = ['get [options] <source> <target>', 'download', 'fetch']
export const describe = 'Download a collection or resource'

export function builder (yargs) {
  yargs
    .option('i', {
      alias: 'include',
      describe: 'Include only files matching one or more of include patterns (comma separated)',
      default: '**',
      ...stringList
    })
    .option('e', {
      alias: 'exclude',
      describe: 'Exclude any file matching one or more of exclude patterns (comma separated)',
      default: [],
      ...stringList
    })
    .option('X', {
      group: 'serialization',
      alias: 'omit-xml-declaration',
      describe: 'Force output of the XML declaration when set to "false"',
      ...xmlBooleanSetting
    })
    .option('N', {
      group: 'serialization',
      alias: 'insert-final-newline',
      describe: 'Force a final newline at the end of an XMLResource (requires eXist >=6.1.0)',
      ...xmlBooleanSetting
    })
    .option('v', {
      alias: 'verbose',
      describe: 'Log every file and resource that was created',
      type: 'boolean',
      default: false
    })
    .nargs({ i: 1, e: 1 })
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }
  const { source } = argv

  const target = argv.target ? argv.target : '.'

  const db = connect(argv.connectionOptions)
  const version = await db.server.version()
  argv.version = version

  return await downloadCollectionOrResource(db, source, target, argv)
}
