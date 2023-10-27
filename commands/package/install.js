import { connect, getRestClient } from '@existdb/node-exist'

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const AdminGroup = 'dba'

async function putPackage (db, restClient, content, fileName) {
  const dbPath = db.app.packageCollection + '/' + fileName
  const res = await restClient.put(content, dbPath)
  return { success: res.statusCode === 201, error: res.body }
}

async function getUserInfo (db) {
  const { user } = db.client.options.basic_auth
  return await db.users.getUserInfo(user)
}

function serverName (db) {
  const { isSecure, options } = db.client

  const protocol = `http${isSecure ? 's' : ''}:`
  const isStdPort =
      (isSecure && options.port === 443) ||
      (!isSecure && options.port === 80)

  if (isStdPort) {
    return `${protocol}//${options.host}`
  }
  return `${protocol}//${options.host}:${options.port}`
}

async function removeTemporaryCollection (db) {
  return await db.collections.remove(db.app.packageCollection)
}

async function install (db, upload, localFilePath) {
  const xarName = basename(localFilePath)
  const contents = readFileSync(localFilePath)

  console.log(`Install ${xarName} on ${serverName(db)}`)

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

export const command = ['install <packages..>', 'i']
export const describe = 'Install XAR packages'
const options = {
  rest: {
    describe: 'force upload over REST API',
    type: 'boolean'
  },
  xmlrpc: {
    alias: 'rpc',
    describe: 'force upload over XML-RPC API',
    type: 'boolean'
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
  const accountInfo = await getUserInfo(db)
  const isAdmin = accountInfo.groups.includes(AdminGroup)
  if (!isAdmin) {
    throw Error(`Package installation failed. User "${accountInfo.name}" is not a member of the "${AdminGroup}" group.`)
  }

  let upload
  if (xmlrpc) {
    upload = db.app.upload
  } else {
    const restClient = await getRestClient(connectionOptions)
    const boundUpload = putPackage.bind(null, db, restClient)
    if (rest) {
      upload = boundUpload
    } else {
      try {
        await restClient.get('db')
        upload = boundUpload
      } catch (e) {
        console.log('Falling back to XMLRPC API')
        upload = db.app.upload
      }
    }
  }

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
