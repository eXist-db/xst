import chalk from 'chalk'

import { getXmlRpcClient } from '@existdb/node-exist'

import { isDBAdmin, getUserInfo } from '../../../utility/connection.js'
import {
  findCompatibleVersion,
  getInstalledPackageMeta,
  installFromRepo
} from '../../../utility/package.js'
import { fail, logSuccess, logSkipped } from '../../../utility/message.js'

export const command = [
  'from-registry <package> [<version>]',
  'registry <package> [<version>]'
]
export const describe = 'Install a package from a registry (AKA public-repo)'

export const builder = (yargs) => {
  return yargs
    .version(false)
    .positional('package', {
      describe: "The package's name or its abbrev",
      string: true
    })
    .positional('version', {
      describe: 'The version to install',
      default: '',
      string: true
    })
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }
  // main
  const { connectionOptions, registry, force, verbose } = argv
  const db = getXmlRpcClient(connectionOptions)

  // check permissions (and therefore implicitly the connection)
  const user = await getUserInfo(db)
  if (!isDBAdmin(user)) {
    throw Error(
      `Package installation failed. User "${user.name}" is not a DB administrator.`
    )
  }

  const info = await getInstalledPackageMeta(db, argv.package)

  if (verbose) {
    const installedOrNot = info.version ? `already installed in version ${info.version}` : 'not installed yet'
    console.error(`Package ${info.name || argv.package} is ${installedOrNot}.`)
  }

  let pkgInfo
  try {
    pkgInfo = await findCompatibleVersion(db, { nameOrAbbrev: argv.package, version: argv.version, registryUrl: registry, verbose })
  } catch (e) {
    throw new Error(`${fail} ${chalk.dim(argv.package)} > ${e.message}`)
  }

  const isUpToDate = pkgInfo.version && pkgInfo.version === info.version

  if (!force && isUpToDate) {
    logSkipped(
      `${chalk.dim(argv.package)} > ${info.version} is already installed`
    )
    console.error(
      chalk.yellow('If you wish to force installation use --force.')
    )
    return 0
  }

  const { success, result } = await installFromRepo(db, {
    registryUrl: registry,
    packageName: pkgInfo.name,
    version: pkgInfo.version,
    verbose
  })

  if (!success) {
    throw new Error(`${fail} ${chalk.dim(argv.package)} > ${result}`)
  }

  logSuccess(
    `${chalk.dim(argv.package)} > installed version ${result.version} at ${result.target}`
  )

  return 0
}
