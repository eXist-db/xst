import { connect } from '@existdb/node-exist'
import { got } from 'got'
import { valid, gt } from 'semver'
// import { basename } from 'node:path'

import { isDBAdmin, getServerUrl } from '../../../utility/connection.js'
import { uploadMethod, removeTemporaryCollection, getInstalledVersion } from '../../../utility/package.js'

async function getRelease (api, owner, repo, release, assetFilter) {
  const path = `repos/${owner}/${repo}/releases/${release}`
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
}

async function install (db, upload, xarName, contents, registry) {
  // const xarName = basename(localFilePath)
  // const contents = readFileSync(localFilePath)

  const uploadResult = await upload(contents, xarName)
  if (!uploadResult.success) {
    throw new Error(uploadResult.error)
  }

  console.log('✔︎ uploaded')

  const installResult = await db.app.install(xarName, registry)

  if (!installResult.success) {
    throw new Error(installResult.error)
  }

  const installationMessage = installResult.result.update ? 'updated' : 'installed'
  console.log(`✔︎ ${installationMessage}`)

  return 0
}

export const command = ['github-release <abbrev>', 'gh']
export const describe = 'Install a XAR package from a github release'
const options = {
  rest: {
    describe: 'force upload over REST API',
    type: 'boolean'
  },
  xmlrpc: {
    alias: 'rpc',
    describe: 'force upload over XML-RPC API',
    type: 'boolean'
  },
  f: {
    alias: 'force',
    describe: 'Force installation, skip version check'
  },
  release: {
    describe: 'Install a specific release',
    default: 'latest',
    type: 'string'
  },
  owner: {
    describe: 'The owner of the repository',
    default: 'eXist-db',
    type: 'string'
  },
  repo: {
    describe: 'The name of the repository, if it differs from abbrev',
    type: 'string'
  },
  registry: {
    describe: 'Where to resolve dependencies from, if they are not already installed',
    default: 'https://exist-db.org/exist/apps/public-repo/',
    type: 'string'
  },
  api: {
    describe: 'Connect to a different github server',
    default: 'https://api.github.com',
    type: 'string'
  },
  A: {
    alias: 'asset',
    describe: 'Pattern to match the package file.',
    default: '<abbrev>-<version>.xar'
  },
  T: {
    alias: 'tag-prefix',
    describe: 'How to read the version from the associated git-tag',
    default: 'v',
    type: 'string'
  },
  debug: {
    type: 'boolean',
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
    connectionOptions, rest, xmlrpc
  } = argv

  const repo = argv.repo && argv.repo !== '' ? argv.repo : abbrev
  // check permissions (and therefore implicitly the connection)
  const db = connect(connectionOptions)
  isDBAdmin(db)

  const upload = await uploadMethod(db, connectionOptions, xmlrpc, rest)
  const tagMatcher = new RegExp(`^${T}(?<version>.+)$`)

  // const r = false ? new RegExp(`${asset}`) : new RegExp(`^${abbrev}.*\\.xar$`)
  const r = new RegExp(`^${abbrev}.*\\.xar$`)
  const assetFilter = a => { return r.test(a.name) }

  try {
    const installedVersion = await getInstalledVersion(db, abbrev)
    const { xarName, packageContents, releaseName } = await getRelease(api, owner, repo, release, assetFilter)
    const foundVersion = tagMatcher.exec(releaseName).groups.version
    console.log(`Install ${abbrev} on ${getServerUrl(db)}`)
    // if (debug) {
    //   console.debug('released:', valid(foundVersion))
    //   console.debug('installed:', valid(installedVersion))
    // }

    if (valid(foundVersion) === null) {
      throw Error('Package does not have a valid semver "' + foundVersion + '"')
    }

    const doUpdate = (installedVersion === null || force || gt(foundVersion, installedVersion))

    if (!doUpdate) {
      console.log(`Version ${installedVersion} is already installed, nothing to do.`)
      return 0
    }

    const assetDownload = await got.get(packageContents)

    await install(db, upload, xarName, assetDownload.rawBody, registry)
  } finally {
    await removeTemporaryCollection(db)
  }

  return 0
}
