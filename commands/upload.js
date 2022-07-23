import { connect, getMimeType } from '@existdb/node-exist'
import { statSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import Bottleneck from 'bottleneck'
import fg from 'fast-glob'

const stringList = {
  type: 'string',
  array: true,
  coerce: (values) =>
    values.length === 1 && values[0].trim() === 'false'
      ? ['**']
      : values.reduce((values, value) => values.concat(value.split(',').map((value) => value.trim())), [])
}

async function getUserInfo (db) {
  const { user } = db.client.options.basic_auth
  return await db.users.getUserInfo(user)
}

/**
 * Upload a single resource into an existdb instance
 * @param {String} path
 * @param {String} root
 * @param {String} baseCollection
 */
async function uploadResource (db, verbose, path, root, baseCollection) {
  try {
    const localFilePath = resolve(root, path)
    const remoteFilePath = baseCollection + '/' + path
    const fileContents = readFileSync(localFilePath)
    const fileHandle = await db.documents.upload(fileContents)

    const options = {}
    if (!getMimeType(path)) {
      console.log('fallback mimetype for', path)
      options.mimetype = 'application/octet-stream'
    }
    await db.documents.parseLocal(fileHandle, remoteFilePath, options)
    if (verbose) {
      console.log(`✔︎ ${path} uploaded`)
    }
    return true
  } catch (e) {
    handleError(e, path)
    return false
  }
}

/**
 * Create a collection in an existdb instance
 * @param {String} collection
 * @param {String} baseCollection
 */
async function createCollection (db, verbose, collection, baseCollection) {
  const absCollection = baseCollection +
    (collection.startsWith('/') ? '' : '/') +
    collection

  try {
    await db.collections.create(absCollection)
    if (verbose) {
      console.log(`✔︎ ${absCollection} created`)
    }
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
  const message = e.faultString ? e.faultString : e.message
  console.error(`✘ ${path} could not be created! Reason: ${message}`)
  if (e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
    throw e
  }
}

/**
 *
 * @param {String} source
 * @param {String} target
 * @param {{pattern: [String], threads: Number, mintime: Number}} options
 * @returns
 */
async function uploadFileOrFolder (db, source, target, options) {
  // read parameters
  const root = resolve(source)

  const start = Date.now()
  const rootStat = statSync(source)

  if (options.verbose) {
    console.log('Uploading:', source, 'to', target)
    console.log('Server:', (db.client.isSecure ? 'https' : 'http') + '://' + db.client.options.host + ':' + db.client.options.port)
    console.log('User:', db.client.options.basic_auth.user)
    if (options.include.length > 1 || options.include[0] !== '**') {
      console.log('Include:\n', ...options.include, '\n')
    }
    if (options.exclude.length) {
      console.log('Exclude:\n', ...options.exclude, '\n')
    }
  }

  if (rootStat.isFile()) {
    const parts = source.split('/')
    const name = parts.pop()
    const dir = parts.join('/')
    if (options.verbose) {
      console.log('Uploading a single file')
    }
    if (options.dryRun) {
      console.log(name)
      return 0
    }
    // ensure target collection exists
    const collectionSuccess = await createCollection(db, options.verbose, '', target)
    const uploadSuccess = await uploadResource(db, options.verbose, name, dir, target)
    if (collectionSuccess && uploadSuccess) {
      console.log(`uploaded ${source} in ${Date.now() - start}ms`)
      return 0
    }
    return 1
  }

  const globbingOptions = { ignore: options.exclude, unique: true, cwd: source, dot: options.dotFiles }
  const collectionGlob = Object.assign({ onlyDirectories: true }, globbingOptions)
  const resourceGlob = Object.assign({ onlyFile: true }, globbingOptions)

  // console.log(options.include)
  const collections = await fg(options.include, collectionGlob)
  const resources = await fg(options.include, resourceGlob)

  if (resources.length === 0 && collections.length === 0) {
    console.error('nothing matched')
    return 9
  }

  if (options.verbose) {
    console.log('Uploading directory tree')
  }

  const confCols = new Map()
  let xConf = []
  if (options.applyXconf) {
    // are there collection.xconf files in the resources?
    // copy them over to the appropriate place
    xConf = resources.filter(r => /\.xconf$/.test(r))
    const parts = xConf.map(r => (target + '/' + r).split('/').slice(1, -1))

    for (const pathParts of parts) {
      let tmpPath = ''
      for (const p of pathParts) {
        tmpPath += '/' + p
        if (confCols.has(tmpPath)) { continue }
        confCols.set(tmpPath, true)
      }
    }
  }

  if (options.dryRun) {
    if (options.applyXconf && xConf.length) {
      console.log('\nIndex configurations:\n')
      console.log(xConf.join('\n'))
    }
    if (collections.length) {
      console.log('\nCollections:\n')
      console.log(collections.join('\n'))
    }
    console.log('\nResources:\n')
    console.log(resources.join('\n'))
    return 0
  }

  // ensure target collection exists
  collections.unshift('')

  const limiter = new Bottleneck({
    // also use maxConcurrent and/or minTime for safety
    maxConcurrent: options.threads,
    minTime: options.mintime // pick a value that makes sense for your use case
  })
  const createCollectionThrottled = limiter.wrap(createCollection.bind(null, db, options.verbose))
  const uploadResourceThrottled = limiter.wrap(uploadResource.bind(null, db, options.verbose))

  // create all collections upfront
  await Promise.all(collections.map(c => createCollectionThrottled(c, target)))

  // requires user to be a member of DBA
  // apply collection configurations
  if (options.applyXconf) {
    const promises = []
    for (const cpath of confCols.keys()) {
      createCollectionThrottled(cpath, '/db/system/config')
    }
    await Promise.all(promises)
    await Promise.all(xConf.map(conf => uploadResourceThrottled(conf, root, '/db/system/config' + target)))
  }

  await Promise.all(resources.map(r => uploadResourceThrottled(r, root, target)))

  const time = Date.now() - start
  console.log(`created ${collections.length} collections and uploaded ${resources.length} resources in ${time}ms`)

  return 0
}

export const command = ['upload [options] <source> <target>', 'up']
export const describe = 'Upload files and directories to a target collection in exist-db'

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
    .option('v', {
      alias: 'verbose',
      describe: 'Log every file and resource that was created',
      type: 'boolean',
      default: false
    })
    .option('d', {
      alias: 'dry-run',
      describe: 'Show what would be uploaded',
      type: 'boolean'
    })
    .option('t', {
      alias: 'threads',
      describe: 'The maximum number of concurrent threads that will be used to upload data',
      type: 'number',
      default: 4
    })
    .option('m', {
      alias: 'mintime',
      describe: 'The minimum time each upload will take',
      type: 'number',
      default: 0
    })
    .option('a', {
      alias: 'apply-xconf',
      describe: 'Upload and apply index configurations that are in the fileset first before all other data is uploaded. The user must be a member of the dba group.',
      default: false,
      type: 'boolean'
    })
    .option('D', {
      alias: 'dot-files',
      describe: 'Upload dot-files as well. This is off by default to prevent uploading of local IDE settings and the entire git-repository by accident.',
      default: false,
      type: 'boolean'
    })
    .nargs({ i: 1, e: 1 })
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }
  const { threads, mintime, source, target } = argv

  if (typeof mintime !== 'number' || mintime < 0) {
    throw Error('Invalid value for option "mintime"; must be an integer equal or greater than zero.')
  }
  if (typeof threads !== 'number' || threads <= 0) {
    throw Error('Invalid value for option "threads"; must be an integer equal or greater than zero.')
  }

  if (!existsSync(source)) {
    throw Error(source + ' not found!')
  }

  const db = connect(argv.connectionOptions)

  const accountInfo = await getUserInfo(db)
  const isAdmin = accountInfo.groups.includes('dba')
  if (argv.applyXconf && !isAdmin) {
    throw Error('To apply collection configurations you must be member of the dba group.')
  }

  const existsAndCanOpenCollection = await db.collections.existsAndCanOpen(target)
  if (argv.verbose) {
    console.log('target exists:', existsAndCanOpenCollection)
  }

  return await uploadFileOrFolder(db, source, target, argv)
}
