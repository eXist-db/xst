import { unzipSync, strFromU8 } from 'fflate'
import { getRestClient } from '@existdb/node-exist'
import { readXquery } from './xq.js'

const queryVersion = readXquery('get-package-version.xq')
const queryInstallFromRepo = readXquery('install-from-repo.xq')

export const expathPackageMeta = 'expath-pkg.xml'

export async function putPackage (db, restClient, content, fileName) {
  const dbPath = db.app.packageCollection + '/' + fileName
  const res = await restClient.put(content, dbPath)
  return { success: res.statusCode === 201, error: res.body }
}

export async function uploadMethod (db, connectionOptions, xmlrpc, rest) {
  if (xmlrpc) {
    return db.app.upload
  }

  const restClient = await getRestClient(connectionOptions)
  const boundUpload = putPackage.bind(null, db, restClient)
  if (rest) {
    return boundUpload
  }

  try {
    await restClient.get('db')
    return boundUpload
  } catch (e) {
    console.log('Falling back to XMLRPC API')
    return db.app.upload
  }
}

export async function removeTemporaryCollection (db) {
  return await db.collections.remove(db.app.packageCollection)
}

export async function getInstalledVersion (db, nameOrAbbrev) {
  const { pages } = await db.queries.readAll(queryVersion, { variables: { 'name-or-abbrev': nameOrAbbrev } })
  const rawResult = pages.toString()
  return JSON.parse(rawResult).version
}

export async function installFromRepo (db, options) {
  const { pages } = await db.queries.readAll(queryInstallFromRepo, { variables: options })
  const rawResult = pages.toString()
  return JSON.parse(rawResult)
}

export function extractPackageMeta (contents) {
  const decompressed = unzipSync(contents, {
    filter (file) {
      return file.name === expathPackageMeta
    }
  })
  if (!decompressed[expathPackageMeta]) {
    throw Error(`${expathPackageMeta} is missing in package`)
  }
  const packageMeta = strFromU8(decompressed[expathPackageMeta])
  const version = packageMeta.match(/<package[\s\S]*?version="(?<version>[^"]+)"/m).groups.version
  const abbrev = packageMeta.match(/<package[\s\S]*?abbrev="(?<abbrev>.*?)"/m).groups.abbrev
  const name = packageMeta.match(/<package[\s\S]*?name="(?<name>.*?)"/m).groups.name
  return { version, abbrev, name }
}
