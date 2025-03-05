import test from 'tape'
import { run, asAdmin } from '../../../test.js'

const monexAppName = 'http://exist-db.org/apps/monex'
const monexGithubAbbrev = 'monex'
const roasterGithubOwner = 'eeditiones'
const roasterGithubAbbrev = 'roaster'
const roasterAppName = 'http://e-editiones.org/roaster'

async function removeTestApp (appName) {
  const { stderr } = await run(
    'xst',
    ['run', `repo:undeploy("${appName}"),repo:remove("${appName}")`],
    asAdmin
  )
  if (stderr) {
    console.error(stderr)
  }
}

/**
 * @param {test.Test} t
 */
async function cleanup (t) {
  try {
    await Promise.all([
      removeTestApp(monexAppName),
      removeTestApp(roasterAppName)
    ])
  } catch (err) {
    t.fail('The cleanup should succeed')
  }
}

test('shows help', async function (st) {
  const { stderr, stdout } = await run('xst', [
    'package',
    'install',
    'github-release',
    'help'
  ])

  if (stderr) {
    st.fail(stderr)
    return
  }
  st.ok(stdout, 'got output')
  const firstLine = stdout.split('\n')[0]
  st.equal(firstLine, 'xst package install github-release <abbrev>', firstLine)
})

test('installing packages from github', async function (t) {
  t.test('rejects installs when user is not admin', async function (st) {
    const { stderr, stdout } = await run('xst', [
      'package',
      'install',
      'github-release',
      monexGithubAbbrev,
      '--tag-prefix',
      '""'
    ])
    st.equal(
      stderr,
      'Package installation failed. User "guest" is not a DB administrator.\n',
      'Installations should have failed since guest is not dba'
    )

    st.notOk(stdout)
    st.end()
  })

  t.test('Allows installs of a repo (monex) from github', async function (st) {
    const { stderr, stdout } = await run(
      'xst',
      [
        'package',
        'install',
        'github-release',
        monexGithubAbbrev,
        '--tag-prefix',
        ''
      ],
      asAdmin
    )
    st.notOk(stderr)
    st.ok(stdout)

    st.end()
  })

  t.test(
    'Allows installs of a lib (roaster) from github at an exact version',
    async function (st) {
      const { stderr, stdout } = await run(
        'xst',
        [
          'package',
          'install',
          'github-release',
          roasterGithubAbbrev,
          '--owner',
          roasterGithubOwner,
          '--release',
          'v1.9.1'
        ],
        asAdmin
      )
      st.notOk(stderr, 'There should not have been any errors')
      st.equal(stdout, '✔︎ roaster-1.9.1.xar > installed 1.9.1\n', stdout)

      st.end()
    }
  )

  t.test(
    'Allows installs of a lib (roaster) from github at the latest version',
    async function (st) {
      // Remove roaster again: we are reinstalling it
      removeTestApp(roasterAppName)
      const { stderr, stdout } = await run(
        'xst',
        [
          'package',
          'install',
          'github-release',
          roasterGithubAbbrev,
          '--owner',
          roasterGithubOwner
        ],
        asAdmin
      )
      st.notOk(stderr, 'There should not have been any errors')

      // The version here changes over time
      st.match(stdout, /✔︎ roaster-.*\.xar > installed .*\n/, stdout)

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
      st.equal(
        stderr,
        'Could not get release from: https://api.github.com/repos/eXist-db/Nonsense/releases/latest\n',
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
          'monex',
          '--asset-pattern',
          '*.nonsense'
        ],
        asAdmin
      )
      st.equal(
        stderr,
        'Could not extract version from Release: "undefined" with tag prefix set to "v"\n',
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
