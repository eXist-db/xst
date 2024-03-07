import chalk from 'chalk'

import { connect } from '@existdb/node-exist'

import { isDBAdmin, getServerUrl, getUserInfo } from '../../../utility/connection.js'
import { getInstalledVersion, installFromRepo } from '../../../utility/package.js'
import { logFailure, logSuccess, logSkipped } from '../../../utility/message.js'

async function install (db, options) {
  const installResult = await installFromRepo(db, options)
  if (!installResult.success) {
    throw new Error(installResult.error)
  }

  return installResult.result
}

export const command = ['registry <package> [<version>]']
export const describe = 'Install a package from a registry (AKA public-repo)'

export const builder = yargs => {
  return yargs.version(false)
    .positional('version', {
      describe: 'The version to install',
      default: '',
      string: true
    })
    .positional('package', {
      describe: 'The NAME of the package to install',
      string: true
    })
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  // main
  const { connectionOptions, registry, force, verbose } = argv
  const db = connect(connectionOptions)

  // check permissions (and therefore implicitly the connection)
  const user = await getUserInfo(db)
  // console.log(db)
  if (!isDBAdmin(user)) {
    throw Error(`Package installation failed. User "${user.name}" is not a DB administrator.`)
  }

  if (verbose) {
    console.log(`Connected to ${getServerUrl(db)}`)
  }

  const installedVersion = await getInstalledVersion(db, argv.package)
  const isUpToDate = argv.version === installedVersion

  if (!force && isUpToDate) {
    logSkipped(`Version ${installedVersion} is already installed, nothing to do.`)
    console.error(chalk.yellow('If you wish to force installation use --force.'))
    return 0
  }

  try {
    const { target, version } = await install(db, {
      publicRepoURL: registry,
      packageName: argv.package,
      version: argv.version
    })
    logSuccess(`${chalk.dim(argv.package)} > installed ${version === '' ? 'latest version' : 'version ' + version} at ${target}`)
  } catch (e) {
    if (verbose) console.error(e)

    logFailure(`${chalk.dim(argv.package)} > could not be installed `)
  }

  return 0
}
