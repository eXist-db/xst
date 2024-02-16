import { unzipSync, strFromU8 } from 'fflate'
import { getRestClient } from '@existdb/node-exist'
import { readXquery } from './xq.js'

const queryVersion = readXquery('get-package-version.xq')

export const expathPackageMeta = 'expath-pkg.xml'

async function putPackage (db, restClient, content, fileName) {
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
  const version = packageMeta.match(/version="(?<version>.*?)"/).groups.version
  const abbrev = packageMeta.match(/abbrev="(?<abbrev>.*?)"/).groups.abbrev
  const name = packageMeta.match(/name="(?<name>.*?)"/).groups.name
  return { version, abbrev, name }
}
