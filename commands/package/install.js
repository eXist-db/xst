import { connect } from '@existdb/node-exist'

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

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

async function install (db, localFilePath) {
  const xarName = basename(localFilePath)
  const contents = readFileSync(localFilePath)

  console.log(`Install ${xarName} on ${serverName(db)}`)

  const uploadResult = await db.app.upload(contents, xarName)
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

export const command = ['install [options] <packages..>', 'i']
export const describe = 'Install XAR package'

export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  // main
  const { packages } = argv
  packages.forEach(packagePath => {
    if (!packagePath.match(/\.xar$/i)) {
      throw Error('Packages must have the file extension .xar! Got: "' + packagePath + '"')
    }
  })

  // check permissions (and therefore implicitly the connection)
  const db = connect(argv.connectionOptions)
  const accountInfo = await getUserInfo(db)
  const isAdmin = accountInfo.groups.includes('dba')
  if (!isAdmin) {
    throw Error(`Package installation failed. User "${accountInfo.name}" is not a member of the "dba" group.`)
  }

  try {
    for (const i in packages) {
      const packagePath = packages[i]
      await install(db, packagePath)
    }
  } finally {
    await removeTemporaryCollection(db)
  }

  return 0
}
