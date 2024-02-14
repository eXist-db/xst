import { getRestClient } from '@existdb/node-exist'
import { readXquery } from './xq.js'

const queryVersion = readXquery('get-package-version.xq')

export const expathPackageMeta = 'expath-pkg.xml'

async function putPackage (db, restClient, content, fileName) {
  const dbPath = db.app.packageCollection + '/' + fileName
  const res = await restClient.put(content, dbPath)
  console.log(res.body)
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
