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

async function install (db, localFilePath) {
  const xarName = basename(localFilePath)
  const contents = readFileSync(localFilePath)

  process.stdout.write(`Install ${xarName} on ${serverName(db)}\n`)

  process.stdout.write('uploading...')
  const uploadResult = await db.app.upload(contents, xarName)
  if (!uploadResult.success) {
    throw new Error(uploadResult.error)
  }

  process.stdout.clearLine()
  process.stdout.cursorTo(0)
  process.stdout.write('✔︎ uploaded\n')

  process.stdout.write('installing...')
  const installResult = await db.app.install(xarName)

  if (!installResult.success) {
    throw new Error(installResult.error)
  }

  process.stdout.clearLine()
  process.stdout.cursorTo(0)
  const installationMessage = installResult.result.update ? 'updated' : 'installed'
  process.stdout.write(`✔︎ ${installationMessage}\n`)

  return 0
}

export const command = ['install <package>', 'i']
export const describe = 'Install XAR package'

export const builder = {
  package: { normalize: true }
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  // main
  const xarPath = argv.package

  if (!xarPath.match(/\.xar$/i)) {
    throw Error('Package must have the file extension .xar!')
  }

  // check permissions (and therefore implicitly the connection)
  const db = connect(argv.connectionOptions)
  const accountInfo = await getUserInfo(db)
  const isAdmin = accountInfo.groups.includes('dba')
  if (!isAdmin) {
    throw Error(`Package installation failed. User "${accountInfo.name}" is not a member of the "dba" group.`)
  }

  return await install(db, xarPath)
}
