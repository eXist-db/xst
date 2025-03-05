import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { valid, gt, lt, eq } from 'semver'
import chalk from 'chalk'

import { connect } from '@existdb/node-exist'

import {
  isDBAdmin,
  getServerUrl,
  getUserInfo
} from '../../../utility/connection.js'
import {
  uploadMethod,
  removeTemporaryCollection,
  extractPackageMeta,
  getInstalledVersion
} from '../../../utility/package.js'
import { logFailure, logSuccess, logSkipped } from '../../../utility/message.js'

/**
 * @typedef { import("@existdb/node-exist").NodeExist } NodeExist
 */

/**
 *
 * @param {NodeExist} db
 * @param {Function} upload
 * @param {String} localFilePath
 * @param {Boolean} force
 * @param {Boolean} verbose
 * @returns {Promise<{success:boolean, error:string, needsForce:boolean, result:Object}>}
 */
async function install (db, upload, localFilePath, force, verbose) {
  const xarDisplay = chalk.dim(localFilePath) + ' >'
  const xarName = basename(localFilePath)
  try {
    const contents = readFileSync(localFilePath)
    const { version, abbrev, name } = extractPackageMeta(contents)
    const installedVersion = await getInstalledVersion(db, name)

    const isUpdate =
      valid(version) && valid(installedVersion) && gt(version, installedVersion)
    const isUpToDate =
      version === installedVersion ||
      (valid(version) &&
        valid(installedVersion) &&
        eq(version, installedVersion))
    const isDowngrade =
      valid(version) && valid(installedVersion) && lt(version, installedVersion)

    const packageDisplay = `${abbrev}@${version}`

    if (!force && isUpToDate) {
      logSkipped(`${xarDisplay} ${packageDisplay} is already installed`)
      return { success: false, needsForce: true }
    }

    const uploadResult = await upload(contents, xarName)
    if (!uploadResult.success) {
      logFailure(`${xarDisplay} ${packageDisplay} could not be uploaded`)
      console.error(uploadResult.error)
      return uploadResult
    }

    const installResult = await db.app.install(xarName)

    if (!installResult.success) {
      logFailure(`${xarDisplay} ${packageDisplay} could not be installed`)
      if (verbose) {
        console.log(installResult.error)
      }
      return installResult
    }

    let message
    if (isDowngrade) {
      message = `${xarDisplay} ${chalk.yellow('downgraded')} to ${packageDisplay}`
    } else if (isUpdate) {
      message = `${xarDisplay} updated to ${packageDisplay}`
    } else {
      message = `${xarDisplay} installed ${packageDisplay}`
    }

    if (verbose) {
      message += ` to ${installResult.result.target}`
    }
    logSuccess(message)
    return installResult
  } catch (e) {
    logFailure(`${xarDisplay} ${e.message}`)
    return { success: false, error: e }
  }
}

export const command = ['local <packages..>', 'file-system', 'files']
export const describe = 'Install XAR packages from the local filesystem'
const options = {
  rest: {
    describe: 'force upload over REST API',
    boolean: true
  },
  xmlrpc: {
    alias: 'rpc',
    describe: 'force upload over XML-RPC API',
    boolean: true
  }
}

export const builder = (yargs) => {
  return yargs.options(options).conflicts('xmlrpc', 'rest')
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  // main
  const { packages, connectionOptions, rest, xmlrpc, force, verbose } = argv
  packages.forEach((packagePath) => {
    if (!packagePath.match(/\.xar$/i)) {
      throw Error(
        'Packages must have the file extension .xar! Got: "' + packagePath + '"'
      )
    }
  })

  const db = connect(connectionOptions)

  // check permissions (and therefore implicitly the connection)
  const user = await getUserInfo(db)
  if (!isDBAdmin(user)) {
    throw Error(
      `Package installation failed. User "${user.name}" is not a DB administrator.`
    )
  }

  if (verbose) {
    console.log(`Connected to ${getServerUrl(db)}`)
  }
  const upload = await uploadMethod(db, connectionOptions, xmlrpc, rest)

  const results = []
  for (const i in packages) {
    const packagePath = packages[i]
    results.push(await install(db, upload, packagePath, force, verbose))
  }

  // cleanup
  await removeTemporaryCollection(db)

  const [showForceHint, errors] = results.reduce(
    (prev, next) => {
      const showForceHint = prev[0] || Boolean(next.needsForce)
      const errors = (prev[1] += next.error ? 1 : 0)
      return [showForceHint, errors]
    },
    [false, 0]
  )

  if (showForceHint) {
    console.error(
      chalk.yellow('If you wish to force installation use --force.')
    )
  }

  if (errors) {
    let message
    if (packages.length === 1) {
      message = 'Package could not be installed!'
    } else {
      message = `${errors} of ${packages.length} packages could not be installed!`
    }
    throw Error(chalk.red(message))
  }

  return 0
}
