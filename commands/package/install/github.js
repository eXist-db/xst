import { Client, interceptors, fetch } from 'undici'
import { valid, gt, lt, eq } from 'semver'
import chalk from 'chalk'

import { getXmlRpcClient, getRestClient } from '@existdb/node-exist'

import { isDBAdmin, getUserInfo } from '../../../utility/connection.js'
import {
  removeTemporaryCollection,
  getInstalledPackageMeta,
  putPackage
} from '../../../utility/package.js'
import { logFailure, logSuccess, logSkipped } from '../../../utility/message.js'

/**
 * @typedef { import("undici").Dispatcher.ComposedDispatcher } Dispatcher.ComposedDispatcher
 */

/**
 * get the release information from Github API
 * @param {Dispatcher.ComposedDispatcher} api
 * @param {String} address the api address
 * @param {String} owner the owner of the repo
 * @param {String} repo the name of the repo
 * @param {String} [release] the specific release naem (optional)
 * @param {String} assetFilter the pattern to find the XAR
 * @param {boolean} verbose display more information
 * @returns {Promise<{ xarName: string, packageContents: string, releaseName: string, tagName:string }>} release info
 */
async function getRelease (api, origin, owner, repo, release, assetFilter, verbose) {
  const tag = release === 'latest' ? release : 'tags/' + release
  const path = `/repos/${owner}/${repo}/releases/${tag}`
  /**
   * @type {unknown[]}
   */
  let assets
  /**
   * @type {string}
   */
  let releaseName
  /**
   * @type {string}
   */
  let tagName
  try {
    const { body } = await api.request({ method: 'GET', path })
    const result = await body.json()
    // The name is not always filled in. Fall back to the tag_name if it is absent
    releaseName = result.name || result.tag_name
    assets = result.assets
    tagName = result.tag_name
  } catch (e) {
    throw Error(
      `Could not get release from: ${origin}${path} ${e.statusCode}: ${e.body.message}`
    )
  }
  const filteredAssets = assets.filter(assetFilter)
  if (verbose) {
    console.log(
      `Found ${assets.length} assets: "${assets.map((asset) => asset.name).join(', ')}"`
    )
  }
  if (!filteredAssets.length) {
    throw Error('no matching asset found')
  }
  if (filteredAssets.length > 1) {
    throw Error('more than one matching asset found')
  }
  const asset = filteredAssets[0]
  return {
    xarName: asset.name,
    packageContents: asset.browser_download_url,
    releaseName,
    tagName
  }
}

/**
 * Install a package after it was uploaded
 * @param {import('@existdb/node-exist').NodeExistXmlRpcClient} db the XML-RPC client connected to an exist-db
 * @param {Function} upload a function uploading the XAR package
 * @param {string} xarName the name of the XAR package
 * @param {Readable} contents the ReadableStream that will be put to the database
 * @param {string} registry the URL to the registry that will be used ot resolve dependencies
 * @returns {Promise<{ success: boolean, error?: Error }>} the result of the installation
 */
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

export const command = [
  'github-release <abbrev> [<release>]',
  'gh <abbrev> [<release>]'
]

export const describe = 'Install a XAR package from a github release. Always uses the REST API to upload!'

const options = {
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
    describe:
      // eslint-disable-next-line no-template-curly-in-string
      'Pattern to match the package file. Defaults to /^${abbrev}.*?\\.xar$/'
  },
  T: {
    alias: 'tag-prefix',
    describe:
      'How to read the version from the associated git-tag. Default is "v"',
    default: 'v',
    string: true
  }
}

export const builder = (yargs) => {
  return yargs
    .positional('abbrev', {
      describe: "The package's abbreviated name. This is often equal to the repositories name.",
      string: true
    })
    .positional('release', {
      describe: 'Install a specific release',
      default: 'latest',
      string: true
    })
    .options(options)
}

const requestHeaderInterceptor = (baseheaders) => dispatch => {
  return (opts, handler) => {
    const { headers } = opts
    opts.headers = { ...headers, ...baseheaders }
    return dispatch(opts, handler)
  }
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  // main
  const {
    abbrev,
    api,
    force,
    T,
    owner,
    release,
    registry,
    connectionOptions,
    verbose,
    A
  } = argv

  const repo = argv.repo && argv.repo !== '' ? argv.repo : abbrev
  const db = getXmlRpcClient(connectionOptions)

  // check permissions (and therefore implicitly the connection)
  const user = await getUserInfo(db)
  if (!isDBAdmin(user)) {
    throw Error(
      `Package installation failed. User "${user.name}" is not a DB administrator.`
    )
  }

  const restClient = getRestClient(connectionOptions)
  // check rest connection
  await restClient.get('db')
  const upload = putPackage.bind(null, db, restClient)
  const tagMatcher = new RegExp(`^${T}(?<version>.+)$`)

  const assetMatcher = A ? new RegExp(A) : new RegExp(`^${abbrev}.*\\.xar$`)
  const assetFilter = (asset) => {
    return assetMatcher.test(asset.name)
  }

  const installedVersion = (await getInstalledPackageMeta(db, abbrev)).version
  const apiClient = new Client(api).compose([
    requestHeaderInterceptor({ 'User-Agent': 'xst/undici.Client' }),
    interceptors.responseError({ throwOnError: true })
  ])

  if (verbose) {
    console.log(`Preparing to install ${owner}/${repo} at version ${release}`)
  }
  const { xarName, packageContents, releaseName, tagName } = await getRelease(
    apiClient,
    api,
    owner,
    repo,
    release,
    assetFilter,
    verbose
  )
  if (verbose) {
    console.log(
      `Found release name "${releaseName}", ${xarName}`
    )
  }
  const matchedTag = tagMatcher.exec(tagName)
  if (!matchedTag) {
    throw Error(
      `Could not extract version from release tag: "${tagName}" with tag prefix set to "${T}"`
    )
  }
  const foundVersion = matchedTag.groups.version
  const isUpdate =
    valid(foundVersion) &&
    valid(installedVersion) &&
    gt(foundVersion, installedVersion)
  const isUpToDate =
    foundVersion === installedVersion ||
    (valid(foundVersion) &&
      valid(installedVersion) &&
      eq(foundVersion, installedVersion))
  const isDowngrade =
    valid(foundVersion) &&
    valid(installedVersion) &&
    lt(foundVersion, installedVersion)

  if (!force && isUpToDate) {
    logSkipped(
      `Version ${installedVersion} is already installed, nothing to do.`
    )
    console.error(
      chalk.yellow('If you wish to force installation use --force.')
    )
    return 0
  }

  try {
    // using fetch here as the packageContents could be anywhere on the internet
    // and the contents might be gzipped, so we benefit from automatic decompression
    const { body } = await fetch(packageContents, { method: 'GET' })
    const result = await install(db, upload, xarName, body, registry)
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
  } catch (e) {
    // throw Error(`Could not get asset from: ${e.options.url}`)
    throw Error(e)
  } finally {
    await removeTemporaryCollection(db)
  }

  return 0
}
