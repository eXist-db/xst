import { got } from 'got'
import { unzipSync, strFromU8 } from 'fflate'
import { getRestClient } from '@existdb/node-exist'
import { readXquery } from './xq.js'

/**
 * @typedef {import('@existdb/node-exist').NodeExist} NodeExist
 */

const queryInstalledPackageMeta = readXquery('get-installed-package-meta.xq')
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

/**
 * Query if a package identified by name or abbrev is installed in which
 * version on the database instance
 * @param {NodeExist} db The database connection
 * @param {string} nameOrAbbrev The package name or abbrev to search for
 * @returns {{version: string?, name: string? }} name and version if found
 */
export async function getInstalledPackageMeta (db, nameOrAbbrev) {
  const { pages } = await db.queries.readAll(queryInstalledPackageMeta, {
    variables: { 'name-or-abbrev': nameOrAbbrev }
  })
  const rawResult = pages.toString()
  return JSON.parse(rawResult)
}

/**
 * Query a package registry for a compatible version
 * Has a fallback plan for legacy registries (public-repo prior to version 4.0.0)
 * Throws in all error cases
 * @param {NodeExist} db The database connection
 * @param {{ nameOrAbbrev: string, version: string, verbose: boolean, registryUrl:string }} options The query options
 * @returns {{version: string, name: string}} name and version if found (can contain more info)
 */
export async function findCompatibleVersion (db, { nameOrAbbrev, version, verbose, registryUrl }) {
  const processor = await db.server.version()
  // TODO: first query for abbrev and get name from there. If there is no `@name`, requery with name.
  const baseParams = {
    processor,
    info: true
  }

  if (version) {
    baseParams.version = version
  }

  const abbrevSearchUrl = queryRepo(registryUrl, { ...baseParams, abbrev: nameOrAbbrev })
  try {
    if (verbose) {
      console.error(`Resolving by abbrev: ${abbrevSearchUrl}`)
    }
    return await got.get(abbrevSearchUrl).json()
  } catch (err) {
    // We are talking to an old server that does not respond with JSON. Retry with XML
    // sadly we cannot allow queries by abbrev as we must have the name in order to safely
    // remove any existing package
    if (err.code === 'ERR_BODY_PARSE_FAILURE') {
      throw new Error(`Found package by abbrev on ${registryUrl}. Because this is a legacy server you have to provide the name instead.`)
    }
    if (err?.response?.statusCode === 404) {
      // Package not found. Can be expected because the nameOrAbbrev might contain either a name
      // or an abbrev. This is always the case, even for a legacy server
      if (verbose) {
        console.log('Falling back to name search')
      }

      const nameSearchUrl = queryRepo(registryUrl, { ...baseParams, name: nameOrAbbrev })
      try {
        return await got.get(nameSearchUrl).json()
      } catch (errAbbrev) {
        if (errAbbrev?.response?.statusCode === 404) {
          throw new Error('Package could not be found in the registry!')
        }
        if (errAbbrev.code === 'ERR_BODY_PARSE_FAILURE') {
          try {
            const responseText = await got.get(nameSearchUrl).text()
            // We are talking with an old server _and_ we got an OK result. The name is correct!
            if (responseText) {
              const version = responseText.match(/version="([^"]+)"/)[1]
              if (verbose) {
                // console.error(await got.get(url).text())
                console.error(`Found package ${nameOrAbbrev} on a legacy server in version ${version}`)
              }
              return { name: nameOrAbbrev, version }
            }
          } catch (_) {
            throw new Error(_)
          }
        }
        // something rather unexpected happened
        throw new Error(errAbbrev.message)
      }
    }
    // something rather unexpected happened
    throw new Error(err.message)
  }
}

function queryRepo (registryUrl, params) {
  if (params) {
    return `${registryUrl}/find?${new URLSearchParams(params)}`
  }
  return `${registryUrl}/find`
}

export async function installFromRepo (
  db,
  { version, packageName, verbose, registryUrl }
) {
  if (!packageName) {
    return { success: false, result: 'package name missing' }
  }

  const { pages } = await db.queries.readAll(queryInstallFromRepo, {
    variables: { version, packageName, verbose, registryFindUrl: queryRepo(registryUrl) }
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
