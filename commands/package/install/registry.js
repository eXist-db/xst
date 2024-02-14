import { connect } from '@existdb/node-exist'

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

import { uploadMethod, removeTemporaryCollection } from '../../../utility/package.js'
import { isDBAdmin, getServerUrl } from '../../../utility/connection.js'

async function install (db, upload, localFilePath) {
  const xarName = basename(localFilePath)
  const contents = readFileSync(localFilePath)

  console.log(`Install ${xarName} on ${getServerUrl(db)}`)

  const uploadResult = await upload(contents, xarName)
  if (!uploadResult.success) {
    throw new Error(uploadResult.error)
  }

  console.log('✔︎ uploaded')

  const installResult = await db.app.install(xarName)

  if (!installResult.success) {
    throw new Error(installResult.error)
  }

  const installationMessage = installResult.result.update ? 'updated' : 'installed'
  console.log(`✔︎ ${installationMessage}`)

  return 0
}

export const command = ['registry <packages..>', 'r']
export const describe = 'Install XAR packages from a registry (AKA public-repo)'
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
    describe: 'force installation, skip version check'
  },
  registry: {
    describe: 'Registry to query the package and ',
    default: 'https://exist-db.org/exist/apps/public-repo/'
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
  const { packages, connectionOptions, rest, xmlrpc } = argv
  packages.forEach(packagePath => {
    if (!packagePath.match(/\.xar$/i)) {
      throw Error('Packages must have the file extension .xar! Got: "' + packagePath + '"')
    }
  })

  // check permissions (and therefore implicitly the connection)
  const db = connect(connectionOptions)
  isDBAdmin(db)

  const upload = uploadMethod(db, connectionOptions, xmlrpc, rest)

  try {
    for (const i in packages) {
      const packagePath = packages[i]
      await install(db, upload, packagePath)
    }
  } finally {
    await removeTemporaryCollection(db)
  }

  return 0
}
