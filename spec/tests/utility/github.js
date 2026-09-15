import { test } from 'tape'
import { assetDownload, githubApiHeaders, tokenHint } from '../../../utility/github.js'

test('githubApiHeaders', function (t) {
  t.deepEqual(githubApiHeaders({}), { 'User-Agent': 'xst/undici.Client' }, 'no token: no Authorization header')
  t.equal(githubApiHeaders({ GITHUB_TOKEN: 'a' }).Authorization, 'Bearer a', 'uses GITHUB_TOKEN')
  t.equal(githubApiHeaders({ GH_TOKEN: 'b' }).Authorization, 'Bearer b', 'uses GH_TOKEN')
  t.equal(githubApiHeaders({ GH_TOKEN: 'b', GITHUB_TOKEN: 'a' }).Authorization, 'Bearer b', 'GH_TOKEN takes precedence')
  t.notOk('Authorization' in githubApiHeaders({ GH_TOKEN: '', GITHUB_TOKEN: '' }), 'empty tokens are ignored')
  t.end()
})

test('tokenHint', function (t) {
  t.ok(tokenHint(403, {}).includes('rate limit'), '403 without a token hints at the rate limit')
  t.ok(tokenHint(429, {}).startsWith('\n'), '429 without a token hints on a line of its own')
  t.ok(tokenHint(404, {}).includes('private'), '404 without a token hints at a private repository')
  t.equal(tokenHint(403, { GITHUB_TOKEN: 'a' }), '', 'no hint when a token is set')
  t.equal(tokenHint(404, { GH_TOKEN: 'b' }), '', 'no private repository hint when a token is set')
  t.equal(tokenHint(500, {}), '', 'no hint for other errors')
  t.end()
})

test('assetDownload', function (t) {
  const api = 'https://api.github.com'
  const asset = {
    url: 'https://api.github.com/repos/owner/repo/releases/assets/1',
    browserDownloadUrl: 'https://github.com/owner/repo/releases/download/v1.0.0/repo.xar'
  }

  t.deepEqual(
    assetDownload(asset, api, {}),
    { url: asset.browserDownloadUrl, headers: {}, authenticated: false },
    'without a token: the public download URL, no headers'
  )

  const withToken = assetDownload(asset, api, { GH_TOKEN: 'b' })
  t.equal(withToken.url, asset.url, 'with a token: the API URL of the asset')
  t.equal(withToken.headers.Authorization, 'Bearer b', 'with a token: authenticated')
  t.equal(withToken.headers.Accept, 'application/octet-stream', 'with a token: asks for the binary contents')
  t.ok(withToken.authenticated, 'with a token: reports an authenticated download')

  t.notOk(
    assetDownload({ ...asset, url: 'https://elsewhere.example/assets/1' }, api, { GH_TOKEN: 'b' }).authenticated,
    'never sends the token to an asset URL outside the configured API'
  )
  t.equal(
    assetDownload({ browserDownloadUrl: asset.browserDownloadUrl }, api, { GH_TOKEN: 'b' }).url,
    asset.browserDownloadUrl,
    'falls back to the public download URL when the asset has no API URL'
  )
  t.end()
})
