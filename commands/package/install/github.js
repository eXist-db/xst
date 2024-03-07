import { got } from 'got'
import { valid, gt, lt, eq } from 'semver'
import chalk from 'chalk'

import { connect } from '@existdb/node-exist'

import { isDBAdmin, getServerUrl, getUserInfo } from '../../../utility/connection.js'
import { uploadMethod, removeTemporaryCollection, getInstalledVersion } from '../../../utility/package.js'
import { logFailure, logSuccess, logSkipped } from '../../../utility/message.js'

async function getRelease (api, owner, repo, release, assetFilter) {
  const tag = release === 'latest' ? release : 'tags/' + release
  const path = `repos/${owner}/${repo}/releases/${tag}`
  try {
    const { assets, name } = await got.get(path, { prefixUrl: api }).json()
    const f = assets.filter(assetFilter)
    if (!f.length) {
      throw Error('no matching asset found')
    }
    if (f.length > 1) {
      throw Error('more than one matching asset found')
    }
    return {
      xarName: f[0].name,
      packageContents: f[0].browser_download_url,
      releaseName: name
    }
  } catch (e) {
    throw Error(`Could not get release from: ${e.options.url}`)
  }
}

async function install (db, upload, xarName, contents, registry) {
  const xarDisplay = chalk.dim(xarName)
  const uploadResult = await upload(contents, xarName)
  if (!uploadResult.success) {
    logFailure(`${xarDisplay} > could not be uploaded`)
    throw new Error(uploadResult.error)
  }

  const installResult = await db.app.install(xarName, registry)

  if (!installResult.success) {
    logFailure(`${xarDisplay} > could not be installed`)
    throw new Error(installResult.error)
  }

  return installResult.result
}

export const command = ['github-release <abbrev>', 'gh']
export const describe = 'Install a XAR package from a github release'
const options = {
  rest: {
    describe: 'force upload over REST API',
    boolean: true
  },
  xmlrpc: {
    alias: 'rpc',
    describe: 'force upload over XML-RPC API',
    boolean: true
  },
  v: {
    alias: 'verbose',
    describe: 'Display more information',
    boolean: true
  },
  release: {
    describe: 'Install a specific release',
    default: 'latest',
    string: true
  },
  owner: {
    describe: 'The owner of the repository',
    default: 'eXist-db',
    string: true
  },
  repo: {
    describe: 'The name of the repository, if it differs from abbrev',
    string: true
  },
  api: {
    describe: 'Connect to a different github server',
    default: 'https://api.github.com',
    string: true
  },
  A: {
    alias: 'asset-pattern',
    // eslint-disable-next-line no-template-curly-in-string
    describe: 'Pattern to match the package file. Defaults to /^${abbrev}.*?\\.xar$/'
  },
  T: {
    alias: 'tag-prefix',
    describe: 'How to read the version from the associated git-tag. Default is "v"',
    default: 'v',
    string: true
  },
  debug: {
    boolean: true,
    default: false
  }
}

export const builder = yargs => {
  return yargs.options(options)
    .conflicts('xmlrpc', 'rest')
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  // main
  const {
    abbrev, api, force, T, owner, release, registry,
    connectionOptions, rest, xmlrpc, verbose
  } = argv

  const repo = argv.repo && argv.repo !== '' ? argv.repo : abbrev
  const db = connect(connectionOptions)

  // check permissions (and therefore implicitly the connection)
  const user = await getUserInfo(db)
  if (!isDBAdmin(user)) {
    throw Error(`Package installation failed. User "${user.name}" is not a DB administrator.`)
  }

  if (verbose) {
    console.log(`Connected to ${getServerUrl(db)}`)
  }

  const upload = await uploadMethod(db, connectionOptions, xmlrpc, rest)
  const tagMatcher = new RegExp(`^${T}(?<version>.+)$`)

  // const r = false ? new RegExp(`${asset}`) : new RegExp(`^${abbrev}.*\\.xar$`)
  const assetMatcher = new RegExp(`^${abbrev}.*\\.xar$`)
  const assetFilter = asset => { return assetMatcher.test(asset.name) }

  const installedVersion = await getInstalledVersion(db, abbrev)

  const { xarName, packageContents, releaseName } = await getRelease(api, owner, repo, release, assetFilter)
  const foundVersion = tagMatcher.exec(releaseName).groups.version
  const isUpdate = valid(foundVersion) && valid(installedVersion) && gt(foundVersion, installedVersion)
  const isUpToDate = foundVersion === installedVersion || (valid(foundVersion) && valid(installedVersion) && eq(foundVersion, installedVersion))
  const isDowngrade = valid(foundVersion) && valid(installedVersion) && lt(foundVersion, installedVersion)

  if (!force && isUpToDate) {
    logSkipped(`Version ${installedVersion} is already installed, nothing to do.`)
    console.error(chalk.yellow('If you wish to force installation use --force.'))
    return 0
  }

  let assetDownload
  try {
    assetDownload = await got.get(packageContents)
  } catch (e) {
    throw Error(`Could not get asset from: ${e.options.url}`)
  }

  try {
    const result = await install(db, upload, xarName, assetDownload.rawBody, registry)
    let action
    if (isDowngrade) {
      action = `${chalk.yellow('downgraded')} to`
    } else if (isUpdate) {
      action = 'updated to'
    } else {
      action = 'installed'
    }

    const target = verbose ? ` to ${result.target}` : ''

    logSuccess(`${chalk.dim(xarName)} > ${action} ${foundVersion}${target}`)
  } finally {
    await removeTemporaryCollection(db)
  }

  return 0
}
