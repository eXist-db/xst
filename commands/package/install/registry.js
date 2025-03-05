import chalk from 'chalk'

import { connect } from '@existdb/node-exist'

import { isDBAdmin, getServerUrl, getUserInfo } from '../../../utility/connection.js'
import { getInstalledVersion, installFromRepo } from '../../../utility/package.js'
import { fail, logSuccess, logSkipped } from '../../../utility/message.js'

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
      describe: "The package's name or its abbrev",
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
  if (!isDBAdmin(user)) {
    throw Error(`Package installation failed. User "${user.name}" is not a DB administrator.`)
  }

  if (verbose) {
    console.log(`Connected to ${getServerUrl(db)}`)
  }

  const installedVersion = await getInstalledVersion(db, argv.package)
  const isUpToDate = argv.version === installedVersion

  if (!force && isUpToDate) {
    logSkipped(`${chalk.dim(argv.package)} > ${installedVersion} is already installed`)
    console.error(chalk.yellow('If you wish to force installation use --force.'))
    return 0
  }

  const { success, result } = await installFromRepo(db, {
    publicRepoURL: registry,
    nameOrAbbrev: argv.package,
    version: argv.version,
    verbose
  })

  if (!success) {
    throw new Error(`${fail} ${chalk.dim(argv.package)} > ${result}`)
  }

  logSuccess(
    `${chalk.dim(argv.package)} > installed ${result.version === '' ? 'latest version' : 'version ' + result.version} at ${result.target}`
  )

  return 0
}
