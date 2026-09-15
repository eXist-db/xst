import test from 'tape'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { run, asAdmin } from '../../../test.js'
import { tokenHint } from '../../../../utility/github.js'

const monexAppName = 'http://exist-db.org/apps/demo'
const demoAppsGithubAbbrev = 'demo-apps'
const hsgGithubOwner = 'HistoryAtState'
const hsgGithubAbbrev = 'administrative-timeline'
const hsgAppName = 'http://history.state.gov/ns/data/administrative-timeline'

async function removeTestApp (appName) {
  const { stderr } = await run(
    'xst',
    ['run', `repo:undeploy("${appName}"),repo:remove("${appName}")`],
    asAdmin
  )
  if (stderr) {
    console.error(`Error removing ${appName}`, stderr)
  }
}

/**
 * @param {test.Test} t
 */
async function cleanup (t) {
  try {
    await removeTestApp(monexAppName)
    await removeTestApp(hsgAppName)
  } catch (err) {
    t.fail('The cleanup should succeed')
  }
}

test('shows help', async function (st) {
  const { stderr, stdout } = await run('xst', [
    'package',
    'install',
    'github-release',
    '--help'
  ])

  if (stderr) {
    st.fail(stderr)
    return
  }
  st.ok(stdout, 'got output')
  const firstLine = stdout.split('\n')[0]
  st.equal(firstLine, 'xst package install github-release <abbrev> [<release>]', firstLine)
})

test('installing packages from github', async function (t) {
  t.test('rejects installs when user is not admin', async function (st) {
    const { stderr, stdout } = await run('xst', [
      'package',
      'install',
      'github-release',
      demoAppsGithubAbbrev,
      'v0.4.3',
      // The only asset for demo-apps is a xar, which is named `demo.xar`.
      '--asset-pattern',
      '.*'
    ])
    st.equal(
      stderr,
      'Package installation failed. User "guest" is not a DB administrator.\n',
      'Installations should have failed since guest is not dba'
    )

    st.notOk(stdout)
    st.end()
  })

  t.test(
    'Allows installs of a repo (demo-apps) from github',
    async function (st) {
      const { stderr, stdout } = await run(
        'xst',
        [
          'package',
          'install',
          'github-release',
          demoAppsGithubAbbrev,
          'v0.4.3',
          // The only asset for demo-apps is a xar, which is named `demo.xar`.
          '--asset-pattern',
          '.*'
        ],
        asAdmin
      )
      st.notOk(stderr)
      st.ok(stdout)

      st.end()
    }
  )

  t.test(
    'Allows installs of a lib (hsg-timeline) from github at an exact version',
    async function (st) {
      const { stderr, stdout } = await run(
        'xst',
        [
          'package',
          'install',
          'github-release',
          hsgGithubAbbrev,
          'v0.6.3',
          '--owner',
          hsgGithubOwner
        ],
        asAdmin
      )
      st.notOk(stderr, 'There should not have been any errors')
      st.equal(
        stdout,
        '✔︎ administrative-timeline.xar > installed 0.6.3\n',
        stdout
      )

      st.end()
    }
  )

  t.test('Allows downgrading packages', async function (st) {
    const { stderr, stdout, code } = await run(
      'xst',
      [
        'package',
        'install',
        'github-release',
        hsgGithubAbbrev,
        'v0.6.2',
        '--owner',
        hsgGithubOwner
      ],
      asAdmin
    )

    st.equal(code, 0, 'The code should indicate success')
    st.notOk(stderr, 'There should not have been any errors')

    st.equal(
      stdout,
      '✔︎ administrative-timeline.xar > downgraded to 0.6.2\n',
      stdout
    )
  })

  t.test('Allows upgrading packages', async function (st) {
    const { stderr, stdout, code } = await run(
      'xst',
      [
        'package',
        'install',
        'github-release',
        hsgGithubAbbrev,
        'v0.6.3',
        '--owner',
        hsgGithubOwner
      ],
      asAdmin
    )

    st.equal(code, 0, 'The code should indicate success')
    st.notOk(stderr, 'There should not have been any errors')

    st.equal(
      stdout,
      '✔︎ administrative-timeline.xar > updated to 0.6.3\n',
      stdout
    )
  })

  t.test('Allows reinstalling packages', async function (st) {
    {
      const { stderr, stdout, code } = await run(
        'xst',
        [
          'package',
          'install',
          'github-release',
          hsgGithubAbbrev,
          'v0.6.3',
          '--owner',
          hsgGithubOwner
        ],
        asAdmin
      )

      st.equal(
        stderr,
        'If you wish to force installation use --force.\n',
        stderr
      )
      st.equal(
        stdout,
        '- Version 0.6.3 is already installed, nothing to do.\n',
        stdout
      )

      st.equal(code, 0, 'The code should indicate success')
    }
    // Attempt 2: now with force
    {
      const { stderr, stdout, code } = await run(
        'xst',
        [
          'package',
          'install',
          'github-release',
          hsgGithubAbbrev,
          'v0.6.3',
          '--owner',
          hsgGithubOwner,
          '--force'
        ],
        asAdmin
      )

      st.equal(code, 0, 'The code should indicate success')
      st.notOk(stderr, 'There should not have been any errors')

      st.equal(
        stdout,
        '✔︎ administrative-timeline.xar > installed 0.6.3\n',
        stdout
      )
    }
  })

  t.test(
    'Allows installs of a lib (administrative-timeline) from github at the latest version',
    async function (st) {
      // Remove administrative-timeline again: we are reinstalling it
      await removeTestApp(hsgAppName)
      const { stderr, stdout } = await run(
        'xst',
        [
          'package',
          'install',
          'github-release',
          hsgGithubAbbrev,
          '--owner',
          hsgGithubOwner
        ],
        asAdmin
      )
      st.notOk(stderr, 'There should not have been any errors')

      // The version here changes over time
      st.match(
        stdout,
        /✔︎ administrative-timeline.xar > installed .*\n/,
        stdout
      )

      st.end()
    }
  )

  t.test(
    'Fails with a readable message when the package does not exist',
    async function (st) {
      const { stderr, stdout, code } = await run(
        'xst',
        ['package', 'install', 'github-release', 'Nonsense'],
        asAdmin
      )
      // without a token the message also suggests that the repository might be private
      st.equal(
        stderr,
        `Could not get release from: https://api.github.com/repos/eXist-db/Nonsense/releases/latest 404: Not Found${tokenHint(404, asAdmin.env)}\n`,
        'There should have been errors'
      )

      st.equal(code, 1, 'The code should indicate failure')
      st.notOk(stdout)

      st.end()
    }
  )

  t.test(
    'Fails with a readable message when the asset does not exist',
    async function (st) {
      const { stderr, stdout, code } = await run(
        'xst',
        [
          'package',
          'install',
          'github-release',
          demoAppsGithubAbbrev,
          '--asset-pattern',
          'nonsense'
        ],
        asAdmin
      )
      st.equal(
        stderr,
        'no matching asset found\n',
        'There should have been errors'
      )

      st.equal(code, 1, 'The code should indicate failure')
      st.notOk(stdout)

      st.end()
    }
  )

  t.teardown(cleanup)
  t.end()
})

test('installs from GitHub releases with GH_TOKEN or GITHUB_TOKEN', function (t) {
  // Local stand-ins: "api" plays the GitHub API, "storage" the host it redirects asset downloads to.
  // PrivateLib answers only with the token, like a private repository; PublicLib is public but its
  // asset download fails; RateLimited answers like an exhausted rate limit; everything else is 404.
  const token = 'private-token'
  const libAppName = 'http://exist-db.org/apps/test-lib'
  const apiRequests = []
  const storageRequests = []
  const urls = {}

  const json = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  const release = (repo, id) => ({
    name: 'v1.0.0',
    tag_name: 'v1.0.0',
    assets: [{
      name: 'test-lib-1.0.0.xar',
      url: `${urls.api}/repos/eXist-db/${repo}/releases/assets/${id}`,
      browser_download_url: `${urls.storage}/eXist-db/${repo}/releases/download/v1.0.0/test-lib-1.0.0.xar`
    }]
  })

  const api = createServer((req, res) => {
    apiRequests.push({ url: req.url, headers: req.headers })
    const authorized = req.headers.authorization === `Bearer ${token}`
    if (req.url.includes('/RateLimited/')) {
      return json(res, 403, { message: 'API rate limit exceeded' })
    }
    if (req.url === '/repos/eXist-db/PrivateLib/releases/tags/v1.0.0' && authorized) {
      return json(res, 200, release('PrivateLib', 1))
    }
    if (req.url === '/repos/eXist-db/PrivateLib/releases/assets/1' && authorized &&
        req.headers.accept === 'application/octet-stream') {
      res.writeHead(302, { location: `${urls.storage}/signed/test-lib-1.0.0.xar` })
      return res.end()
    }
    if (req.url === '/repos/eXist-db/PublicLib/releases/tags/v1.0.0') {
      return json(res, 200, release('PublicLib', 2))
    }
    json(res, 404, { message: 'Not Found' })
  })

  const storage = createServer((req, res) => {
    storageRequests.push({ url: req.url, headers: req.headers })
    if (req.url === '/signed/test-lib-1.0.0.xar') {
      res.writeHead(200, { 'content-type': 'application/octet-stream' })
      return res.end(readFileSync('spec/fixtures/test-lib.xar'))
    }
    res.writeHead(404)
    res.end()
  })

  const listen = (server, name) => new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      urls[name] = `http://127.0.0.1:${server.address().port}`
      resolve()
    })
  })
  const listening = Promise.all([listen(api, 'api'), listen(storage, 'storage')])

  // tokens from the developer's shell or from CI must not leak into these tests
  const { GH_TOKEN, GITHUB_TOKEN, ...env } = asAdmin.env
  const install = async (args, tokens = {}) => {
    await listening
    return run(
      'xst',
      ['package', 'install', 'github-release', ...args, '--api', urls.api],
      { env: { ...env, ...tokens } }
    )
  }

  t.test('sends no Authorization header without a token', async function (st) {
    const { stderr, code } = await install(['Nonsense'])
    st.equal(
      stderr,
      `Could not get release from: ${urls.api}/repos/eXist-db/Nonsense/releases/latest 404: Not Found\n` +
        'If the repository is private, set GH_TOKEN or GITHUB_TOKEN to a token that can read it.\n',
      stderr
    )
    st.equal(code, 1, 'The code should indicate failure')
    st.notOk(apiRequests.at(-1)?.headers.authorization, 'no Authorization header')
    st.end()
  })

  t.test('sends GITHUB_TOKEN as a bearer token', async function (st) {
    await install(['Nonsense'], { GITHUB_TOKEN: 'from-github-token' })
    st.equal(apiRequests.at(-1)?.headers.authorization, 'Bearer from-github-token')
    st.end()
  })

  t.test('prefers GH_TOKEN over GITHUB_TOKEN', async function (st) {
    await install(['Nonsense'], { GH_TOKEN: 'from-gh-token', GITHUB_TOKEN: 'from-github-token' })
    st.equal(apiRequests.at(-1)?.headers.authorization, 'Bearer from-gh-token')
    st.end()
  })

  t.test('hints at a token when rate limited', async function (st) {
    const { stderr, code } = await install(['RateLimited'])
    st.equal(
      stderr,
      `Could not get release from: ${urls.api}/repos/eXist-db/RateLimited/releases/latest 403: API rate limit exceeded\n` +
        'Set GH_TOKEN or GITHUB_TOKEN to authenticate with the GitHub API and raise its rate limit.\n',
      stderr
    )
    st.equal(code, 1, 'The code should indicate failure')
    st.end()
  })

  t.test('installs from a private repository with a token', async function (st) {
    const { stderr, stdout, code } = await install(
      ['test-lib', 'v1.0.0', '--repo', 'PrivateLib', '--force'],
      { GH_TOKEN: token }
    )
    st.notOk(stderr, 'There should not have been any errors')
    st.equal(stdout, '✔︎ test-lib-1.0.0.xar > installed 1.0.0\n', stdout)
    st.equal(code, 0, 'The code should indicate success')

    const assetRequest = apiRequests.find(({ url }) => url === '/repos/eXist-db/PrivateLib/releases/assets/1')
    st.equal(assetRequest?.headers.authorization, `Bearer ${token}`, 'the asset is requested from the API with the token')
    const signedDownload = storageRequests.find(({ url }) => url === '/signed/test-lib-1.0.0.xar')
    st.ok(signedDownload, 'the API redirect to the storage host is followed')
    st.notOk(signedDownload?.headers.authorization, 'the storage host does not receive the token')
    st.end()
  })

  t.test('does not find a private repository without a token', async function (st) {
    const { stderr, stdout, code } = await install(['test-lib', 'v1.0.0', '--repo', 'PrivateLib', '--force'])
    st.equal(
      stderr,
      `Could not get release from: ${urls.api}/repos/eXist-db/PrivateLib/releases/tags/v1.0.0 404: Not Found\n` +
        'If the repository is private, set GH_TOKEN or GITHUB_TOKEN to a token that can read it.\n',
      stderr
    )
    st.notOk(stdout)
    st.equal(code, 1, 'The code should indicate failure')
    st.end()
  })

  t.test('fails with a readable message when the download fails', async function (st) {
    const { stderr, stdout, code } = await install(['test-lib', 'v1.0.0', '--repo', 'PublicLib', '--force'])
    st.equal(stderr, 'Could not download test-lib-1.0.0.xar: 404 Not Found\n', stderr)
    st.notOk(stdout)
    st.equal(code, 1, 'The code should indicate failure')
    st.end()
  })

  t.teardown(async () => {
    api.close()
    storage.close()
    await removeTestApp(libAppName)
  })
  t.end()
})

// eXist-db/private-test-app is a private repository with a single release v1.0.0.
// XST_TEST_PRIVATE_REPO_TOKEN must be able to read it (in CI: an exist-bot installation token).
const privateRepoToken = process.env.XST_TEST_PRIVATE_REPO_TOKEN

test('installs from a private GitHub repository', { skip: !privateRepoToken }, async function (t) {
  const privateAppName = 'http://exist-db.org/apps/private-test-app'
  const { GH_TOKEN, GITHUB_TOKEN, XST_TEST_PRIVATE_REPO_TOKEN, ...env } = asAdmin.env

  const { stderr, stdout, code } = await run(
    'xst',
    ['package', 'install', 'github-release', 'private-test-app', 'v1.0.0', '--force'],
    { env: { ...env, GH_TOKEN: privateRepoToken } }
  )
  t.notOk(stderr, 'There should not have been any errors')
  t.equal(stdout, '✔︎ private-test-app-1.0.0.xar > installed 1.0.0\n', stdout)
  t.equal(code, 0, 'The code should indicate success')

  await removeTestApp(privateAppName)
  t.end()
})
