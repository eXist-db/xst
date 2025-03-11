import { got } from 'got'
import { unzipSync, strFromU8 } from 'fflate'
import { getRestClient } from '@existdb/node-exist'
import { readXquery } from './xq.js'

const queryVersion = readXquery('get-package-version.xq')
const queryInstallFromRepo = readXquery('install-from-repo.xq')

export const expathPackageMeta = 'expath-pkg.xml'

export async function putPackage (db, restClient, content, fileName) {
  const dbPath = db.app.packageCollection + '/' + fileName
  const res = await restClient.put(content, dbPath)
  return { success: res.statusCode === 201, result: res.body }
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
  const { pages } = await db.queries.readAll(queryVersion, {
    variables: { 'name-or-abbrev': nameOrAbbrev }
  })
  const rawResult = pages.toString()
  return JSON.parse(rawResult).version
}

async function queryRepo (params, verbose, publicRepoURL) {
  const url = `${publicRepoURL}/find?${new URLSearchParams(params)}`
  try {
    if (verbose) {
      console.log(`Resolving ${url}`)
    }
    const found = await got.get(url).json()

    return found.name
  } catch (err) {
    const statusCode = err.response.statusCode
    if (statusCode === 404) {
      // Package not found. Can be expected because the nameOrAbbrev is actually
      // a name put into an abbrev. this is always the case, even for a legacy
      // server
      return null
    }

    if (err.code === 'ERR_BODY_PARSE_FAILURE') {
      // We are talking to an old server that does not respond with JSON. Retry with XML
      try {
        if (await got.get(url).text()) {
          // We are talking with an old server _and_ we got an OK result. The name is correct!
          if (verbose) {
            console.log(`Resolved ${params.name} to a legacy server`)
          }
          return params.name
        }
      } catch (_) {
        return null
      }
    }

    throw new Error(`Could not get release from: ${url}`)
  }
}

export async function installFromRepo (
  db,
  { version, nameOrAbbrev, verbose, publicRepoURL }
) {
  const processor = await db.server.version()
  // TODO: first query for abbrev and get name from there. If there is no `@name`, requery with name.
  const baseParams = {
    processor,
    info: true
  }

  if (version) {
    baseParams.version = version
  }

  const paramsForAbbrev = { ...baseParams, abbrev: nameOrAbbrev }
  let name
  try {
    name = await queryRepo(paramsForAbbrev, verbose, publicRepoURL)
  } catch (e) {
    return { success: false, result: e }
  }

  if (!name) {
    if (verbose) {
      console.log('Falling back to name search')
    }

    const paramsForName = { ...baseParams, name: nameOrAbbrev }
    try {
      name = await queryRepo(paramsForName, verbose, publicRepoURL)
    } catch (e) {
      return { success: false, result: e }
    }
  }

  if (!name) {
    return { success: false, result: 'could not be found in the registry' }
  }

  const { pages } = await db.queries.readAll(queryInstallFromRepo, {
    variables: { version, packageName: name, verbose, publicRepoURL }
  })
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
  const version = packageMeta.match(
    /<package[\s\S]*?version="(?<version>[^"]+)"/m
  ).groups.version
  const abbrev = packageMeta.match(/<package[\s\S]*?abbrev="(?<abbrev>.*?)"/m)
    .groups.abbrev
  const name = packageMeta.match(/<package[\s\S]*?name="(?<name>.*?)"/m).groups
    .name
  return { version, abbrev, name }
}
