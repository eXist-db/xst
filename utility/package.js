import { unzipSync, strFromU8 } from 'fflate'
import { createExistClient } from '@existdb/node-exist/util/exist-client.js'
import { getRestClient } from '@existdb/node-exist'
import { readXquery } from './xq.js'

/**
 * @typedef {import('@existdb/node-exist').NodeExistXmlRpcClient} NodeExistXmlRpcClient
 */

/**
 * @typedef {import('@existdb/node-exist').NodeExistRestClient} NodeExistRestClient
 */

const queryInstalledPackageMeta = readXquery('get-installed-package-meta.xq')
const queryInstallFromRepo = readXquery('install-from-repo.xq')

export const expathPackageMeta = 'expath-pkg.xml'

/**
 *
 * @param {NodeExistXmlRpcClient} db XML-RPC client
 * @param {NodeExistRestClient} restClient REST client
 * @param {Readable | Buffer | String} content the contents to upload
 * @param {String} fileName the target resource
 * @returns {Promise<{ success: boolean, restult: string }>}
 */
export async function putPackage (db, restClient, content, fileName) {
  const dbPath = db.app.packageCollection + '/' + fileName
  const res = await restClient.put(content, dbPath)
  const result = await res.body.text()
  return { success: res.statusCode === 201, result }
}

export async function uploadMethod (db, connectionOptions, xmlrpc, rest) {
  if (xmlrpc) {
    return db.app.upload
  }

  const restClient = getRestClient(connectionOptions)
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
 * @param {NodeExistXmlRpcClient} db The database connection
 * @param {string} nameOrAbbrev The package name or abbrev to search for
 * @returns {Promise<{version: string?, name: string? }>} name and version if found
 */
export async function getInstalledPackageMeta (db, nameOrAbbrev) {
  const variables = { 'name-or-abbrev': nameOrAbbrev }
  const { pages } = await db.queries.readAll(queryInstalledPackageMeta, { variables })
  const rawResult = pages.toString()
  return JSON.parse(rawResult)
}

/**
 * Query a package registry for a compatible version
 * Has a fallback plan for legacy registries (public-repo prior to version 4.0.0)
 * Throws in all error cases
 * @param {NodeExistXmlRpcClient} db The database connection
 * @param {{ nameOrAbbrev: string, version: string, verbose: boolean, registryUrl:string }} options The query options
 * @returns {Promise<{version: string, name: string}>} name and version if found (can contain more info)
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
  const { client } = createExistClient({
    server: registryUrl,
    throwOnError: true,
    headers: {
      accept: 'application/json,*/*',
      'User-Agent': 'xst/undici.Client'
    }
  })

  const abbrevSearchRequest = queryRepo({ ...baseParams, abbrev: nameOrAbbrev })
  let statusCode // store eventual status 200 returned
  try {
    if (verbose) {
      const query = new URLSearchParams(abbrevSearchRequest.query)
      console.error(`Resolving by abbrev: ${registryUrl}/${abbrevSearchRequest.path}?${query.toString()}`)
    }
    const abbrevSearchResponse = await client.request(abbrevSearchRequest)
    statusCode = abbrevSearchResponse.statusCode
    return await abbrevSearchResponse.body.json()
  } catch (err) {
    if (err?.code === 'ECONNREFUSED') {
      throw new Error(`Could not connect to ${registryUrl}`)
    }
    if (statusCode >= 300 && statusCode < 400) {
      throw new Error(`${registryUrl} seems to redirect infinitely`)
    }
    // We might be talking to an old version of the public-repo that cannot return JSON.
    // We need to retry with XML. Sadly, we cannot allow queries by abbrev as we must have the name
    // in order to safely remove any existing package
    if (statusCode === 200 && err instanceof SyntaxError) {
      throw new Error(`Found package by abbrev on ${registryUrl}. Because this is a legacy server you have to provide the name instead.`)
    }
    if (err?.statusCode === 404 && err?.body?.servlet) {
      throw new Error(`Server responded with a Servlet error. Probably a wrong path to the public-repo or public-repo not installed. Please check the URL ${registryUrl}`)
    }
    if (err?.statusCode === 404 && err.body && (err.body?.error || (err.body.trim && err.body.trim() === '<p>No package with abbrev: ' + nameOrAbbrev + ' found.</p>'))) {
      // Package not found. Can be expected because the nameOrAbbrev might contain either a name
      // or an abbrev. This is always the case, even for a legacy server
      if (verbose) {
        console.log('Falling back to name search')
      }

      const nameSearchUrl = queryRepo({ ...baseParams, name: nameOrAbbrev })
      try {
        const { body } = await client.request(nameSearchUrl)
        return await body.json()
      } catch (errAbbrev) {
        if (errAbbrev?.statusCode === 404) {
          throw new Error('Package could not be found in the registry!')
        }
        if (errAbbrev.code === 'ERR_BODY_PARSE_FAILURE') {
          try {
            const { body } = await client.request(nameSearchUrl)
            const responseText = await body.text()
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
    throw new Error(`Error connecting to ${registryUrl}. Status code: ${err?.statusCode} Body: ${err?.body?.length ? err.body : '[empty]'}`)
  }
}

const existRepoSearchEndpoint = 'find'

function queryRepo (query) {
  return {
    method: 'GET',
    path: existRepoSearchEndpoint,
    query
  }
}

export async function installFromRepo (
  db,
  { version, packageName, verbose, registryUrl }
) {
  if (!packageName) {
    return { success: false, result: 'package name missing' }
  }
  const variables = { version, packageName, verbose, registryFindUrl: registryUrl + '/' + existRepoSearchEndpoint }
  const { pages } = await db.queries.readAll(queryInstallFromRepo, { variables })
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
