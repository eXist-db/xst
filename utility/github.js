/**
 * Helpers for requests to the GitHub API (package install github-release)
 */

/**
 * @typedef {Record<string, string|undefined>} Environment
 */

/**
 * @typedef {Object} AssetDownload
 * @prop {string} url where to download the asset from
 * @prop {Record<string, string>} headers request headers
 * @prop {boolean} authenticated whether the request carries the token
 */

/**
 * the token to authenticate with, GH_TOKEN takes precedence over GITHUB_TOKEN like in the GitHub CLI
 * @param {Environment} env environment variables
 * @returns {string|undefined} the token, undefined if none is set
 */
function githubToken (env) {
  return env.GH_TOKEN || env.GITHUB_TOKEN || undefined
}

/**
 * Headers for requests to the GitHub API.
 * With a token the requests are authenticated: they can read private repositories the token
 * has access to and are allowed 5000 instead of 60 requests per hour.
 * @param {Environment} [env] environment variables, defaults to process.env
 * @returns {Record<string, string>} request headers
 */
export function githubApiHeaders (env = process.env) {
  const headers = { 'User-Agent': 'xst/undici.Client' }
  const token = githubToken(env)
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

/**
 * Hint for a failed GitHub API request that a token might resolve:
 * the rate limit of unauthenticated requests (403, 429) or a private repository (404).
 * @param {number} statusCode HTTP status code of the failed request
 * @param {Environment} [env] environment variables, defaults to process.env
 * @returns {string} the hint on a line of its own, empty if a token is set or it does not apply
 */
export function tokenHint (statusCode, env = process.env) {
  if (githubToken(env)) {
    return ''
  }
  if (statusCode === 403 || statusCode === 429) {
    return '\nSet GH_TOKEN or GITHUB_TOKEN to authenticate with the GitHub API and raise its rate limit.'
  }
  if (statusCode === 404) {
    return '\nIf the repository is private, set GH_TOKEN or GITHUB_TOKEN to a token that can read it.'
  }
  return ''
}

/**
 * How to download a release asset.
 * With a token and an asset URL of the configured API: through the API, which also serves
 * assets of private repositories. The API redirects to a storage host; fetch does not send
 * the Authorization header there.
 * Otherwise from the public browser download URL, which does not count against the API rate limit.
 * @param {{url?: string, browserDownloadUrl: string}} asset API URL and browser download URL of the asset
 * @param {string} api base URL of the GitHub API the token is meant for
 * @param {Environment} [env] environment variables, defaults to process.env
 * @returns {AssetDownload} url, headers and whether the download is authenticated
 */
export function assetDownload ({ url, browserDownloadUrl }, api, env = process.env) {
  if (githubToken(env) && url && new URL(url).origin === new URL(api).origin) {
    return {
      url,
      headers: { ...githubApiHeaders(env), Accept: 'application/octet-stream' },
      authenticated: true
    }
  }
  return { url: browserDownloadUrl, headers: {}, authenticated: false }
}
