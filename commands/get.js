import { resolve, join, posix, dirname, basename } from 'node:path'
import { statSync, existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { connect } from '@existdb/node-exist'
import Bottleneck from 'bottleneck'
import { getGlobMatcher } from '../utility/glob.js'

/**
 * @typedef { import("@existdb/node-exist").NodeExist } NodeExist
 */

/**
 * @typedef {Object} GetOptions
 * @prop {Boolean} verbose output more information
 * @prop {boolean} collectionsOnly only show collections
 * @prop {Boolean} recursive traverse the tree
 * @prop {Number} depth how many levels to traverse down for recursive and tree views
 * @prop {String[]} include filter items
 * @prop {String[]} exclude filter items
 * @prop {Number} threads How many resources should be downloaded at the same time
 * @prop {Number} mintime How long a downloads should take at least
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
    if (value === null) {
      return value
    }
    if (!xmlBooleanOptionValue.has(value)) {
      throw Error('Unsupported XML serialization option value: ' + value)
    }
    return xmlBooleanOptionValue.get(value)
  }
}
const serializationOptionNames = ['insert-final-newline', 'omit-xml-declaration', 'expand-xincludes', 'method']

const htmlSerializationMethod = {
  method: 'html'
}

const serializationDefaults = {
  'expand-xincludes': 'yes'
  // "exist:indent": "no",
  // "indent": "no",
  // "output.indent": "no",
  // "compression": "yes"
}
function getHtmlSerializationOptions (options) {
  const serializationOptions = { ...serializationDefaults }
  serializationOptionNames.forEach((o) => {
    if (o in options) {
      serializationOptions[o] = options[o]
    }
  })
  Object.assign(serializationOptions, htmlSerializationMethod)
  // console.log('Serialization options:', serializationOptions)
  return serializationOptions
}

function getSerializationOptions (options) {
  const serializationOptions = { ...serializationDefaults }
  serializationOptionNames.forEach((o) => {
    if (o in options) {
      serializationOptions[o] = options[o]
    }
  })
  // console.log('Serialization options:', serializationOptions)
  return serializationOptions
}

/**
 * Download a single resource into an existdb instance
 * @param {NodeExist.BoundModules} db NodeExist client
 * @param {GetOptions} options
 * @param {Boolean} verbose
 * @param {ResourceInfo} resource
 * @param {String} directory
 */
async function downloadResource (db, options, resource, directory, collection, rename) {
  try {
    const { verbose, matchesExcludeGlob, matchesIncludeGlob, matchesHtmlGlob } = options
    let fileContents
    const path = collection ? posix.join(collection, resource.name) : resource.name
    if (matchesExcludeGlob(resource) || !matchesIncludeGlob(resource)) {
      if (verbose) {
        console.log(`- skipping resource ${path}`)
      }
      return true
    }

    if (resource.type === 'BinaryResource') {
      fileContents = await db.documents.readBinary(path)
    } else if (matchesHtmlGlob(resource)) {
      fileContents = await db.documents.read(path, getHtmlSerializationOptions(options))
    } else {
      fileContents = await db.documents.read(path, getSerializationOptions(options))
    }
    const localName = rename || posix.basename(resource.name)
    const localPath = join(directory, localName)
    await writeFile(localPath, fileContents)

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
 * @param {NodeExist} db NodeExist client
 * @param {GetOptions} options
 * @param {boolean} verbose
 * @param {String} collection
 * @param {String} baseCollection
 * @param {Bottleneck} limiter
 */
async function downloadCollection (db, options, collection, baseCollection, directory, limiter) {
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
    // Download all documents. Do this in parallel, but not everything at once. Pool that work so we don't take down the
    // server
    await Promise.all(
      collectionMeta.documents.map(async (resource) => {
        await limiter.schedule(() => downloadResource(db, options, resource, targetDir, absCollection))
      })
    )

    // recursive (optional?)

    // There should always be fewer collections than resources, so no need for pooling. Go over them one by one. No need
    // to do this in parallel
    for (const collection of collectionMeta.collections) {
      await downloadCollection(db, options, collection, absCollection, targetDir, limiter)
    }

    return true
  } catch (e) {
    handleError(e, absCollection)
    return false
  }
}

/**
 * Handle errors downloading a resource or collection
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
 * @param {NodeExist} db NodeExist client
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
 * @param {NodeExist} db NodeExist client
 * @param {String} source db path
 * @param {String} target local folder
 * @param {GetOptions} options options
 * @returns {number} return code
 */
async function downloadCollectionOrResource (db, source, target, options) {
  // read parameters
  // const start = Date.now()
  const root = resolve(target)

  if (options.verbose) {
    console.error('Downloading', source, 'to', root)
    if (options.include !== '**') {
      console.error('Include', options.include)
    }
    if (options.exclude && options.exclude.length) {
      console.error('Exclude', options.exclude)
    }
    console.error(`Downloading up to ${options.threads} resources at a time`)
    if (options['expand-xincludes'] === 'false') {
      console.error('Skipping XInclude expansion')
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

  const limiter = new Bottleneck({
    maxConcurrent: options.threads,
    minTime: options.mintime
  })

  // download collection into a folder
  return await downloadCollection(db, options, posix.basename(info.name), posix.dirname(info.name), root, limiter)
}

export const command = ['get [options] <source> <target>', 'download', 'fetch']
export const describe = 'Download a collection or resource'

export function builder (yargs) {
  yargs
    .option('i', {
      alias: 'include',
      describe: 'Include only files matching the include globbing pattern',
      default: '**',
      type: 'string'
    })
    .option('e', {
      alias: 'exclude',
      describe: 'Exclude any file matching the exclude globbing pattern',
      default: '',
      type: 'string'
    })
    .option('x', {
      group: 'serialization',
      alias: 'expand-xincludes',
      describe: 'Skip expanding XInclude elements when set to "false"',
      ...xmlBooleanSetting
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
    .option('H', {
      group: 'serialization',
      alias: 'serialize-as-html',
      describe: 'Serialize resources that match the globbing pattern as HTML',
      default: '*.html',
      type: 'string'
    })
    .option('v', {
      alias: 'verbose',
      describe: 'Log every file and resource that was created',
      type: 'boolean',
      default: false
    })
    .option('t', {
      alias: 'threads',
      describe: 'The maximum number of concurrent threads that will be used to dowload data',
      type: 'number',
      default: 4
    })
    .option('m', {
      alias: 'mintime',
      describe: 'The minimum time each dowload will take',
      type: 'number',
      default: 0
    })
    .nargs({ i: 1, e: 1 })
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  const { threads, mintime, source, include, exclude, serializeAsHtml } = argv

  const matchesIncludeGlob = getGlobMatcher(include)
  const matchesExcludeGlob = getGlobMatcher(exclude)
  const matchesHtmlGlob = getGlobMatcher(serializeAsHtml)

  if (typeof mintime !== 'number' || mintime < 0) {
    throw Error('Invalid value for option "mintime"; must be an integer equal or greater than zero.')
  }
  if (typeof threads !== 'number' || threads <= 0) {
    throw Error('Invalid value for option "threads"; must be an integer equal or greater than zero.')
  }

  const target = argv.target ? argv.target : '.'

  const db = connect(argv.connectionOptions)
  const version = await db.server.version()
  argv.version = version

  return await downloadCollectionOrResource(db, source, target, { ...argv, matchesIncludeGlob, matchesExcludeGlob, matchesHtmlGlob })
}
