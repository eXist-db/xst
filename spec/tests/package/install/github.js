import test from 'tape'
import { run, asAdmin } from '../../../test.js'

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
      st.equal(
        stderr,
        'Could not get release from: https://api.github.com/repos/eXist-db/Nonsense/releases/latest 404: Not Found\n',
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
