import { got } from 'got'
import { readFile } from 'fs/promises'
import test from 'tape'
import { run, asAdmin } from '../../../test.js'

const testAppName = 'http://exist-db.org/apps/test-app'
const testLibName = 'http://exist-db.org/apps/test-lib'

async function removeTestApp (t) {
  const { stderr } = await run(
    'xst',
    ['run', `repo:undeploy("${testAppName}"),repo:remove("${testAppName}")`],
    asAdmin
  )
  if (stderr) {
    console.error(stderr)
  }
}

async function removeTestlib (t) {
  const { stderr } = await run(
    'xst',
    ['run', `repo:undeploy("${testLibName}"),repo:remove("${testLibName}")`],
    asAdmin
  )
  if (stderr) {
    console.error(stderr)
  }
}

async function cleanup (t) {
  await removeTestApp(t)
  await removeTestlib(t)
}

async function isLocalRepoAvailable () {
  return (
    await got.get('http://localhost:8080/exist/apps/public-repo', {
      throwHttpErrors: false
    })
  ).ok
}

/**
 * @param {test.Test} t
 *
 */
async function installPackageToLocalRepo (t) {
  for (const app of ['test-app.xar', 'test-lib.xar']) {
    const formData = new FormData()
    const file = await readFile(`spec/fixtures/${app}`)
    const blob = new Blob([file])
    formData.append('files[]', blob, app)
    formData.append('', '\\')

    // TODO: Read in localhost
    const result = await got.post(
      'http://localhost:8080/exist/apps/public-repo/publish',
      {
        headers: {
          Authorization: `Basic ${Buffer.from('repo:repo').toString('base64')}`
        },
        body: formData
      }
    )

    t.ok(result.ok, `The install of ${app} should have worked`)
  }
}

test('shows help', async function (st) {
  const { stderr, stdout } = await run('xst', [
    'package',
    'install',
    'registry',
    'help'
  ])

  if (stderr) {
    st.fail(stderr)
    return
  }
  st.ok(stdout, 'got output')
  const firstLine = stdout.split('\n')[0]
  st.equal(
    firstLine,
    'xst package install registry <package> [<version>]',
    firstLine
  )
})

test('Work with a local public registry', async function (t) {
  if (!(await isLocalRepoAvailable())) {
    t.skip()
    return
  }

  await installPackageToLocalRepo(t)

  t.test('rejects installs when user is not admin', async function (st) {
    const { stderr, stdout } = await run('xst', [
      'package',
      'install',
      'registry',
      '--registry',
      'http://localhost:8080/exist/apps/public-repo',
      testAppName
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
    'installs new packages from a local public registry',
    async function (st) {
      const { stderr, stdout } = await run(
        'xst',
        [
          'package',
          'install',
          'registry',
          '--registry',
          'http://localhost:8080/exist/apps/public-repo',
          testAppName
        ],
        asAdmin
      )
      st.notOk(stderr, 'There should have been no errors')

      const lines = stdout.split('\n')
      st.equal(
        lines[0],
        `✔︎ ${testAppName} > installed latest version at /db/apps/test-app`,
        lines[0]
      )
      st.notOk(lines[1])
      st.end()
    }
  )

  t.test(
    'installs new packages from a local public registry by abbreviation',
    async function (st) {
      const { stderr, stdout } = await run(
        'xst',
        [
          'package',
          'install',
          'registry',
          '--registry',
          'http://localhost:8080/exist/apps/public-repo',
          'test-app'
        ],
        asAdmin
      )
      st.notOk(stderr, 'There should have been no errors')

      const lines = stdout.split('\n')
      st.equal(
        lines[0],
        '✔︎ test-app > installed latest version at /db/apps/test-app',
        lines[0]
      )
      st.notOk(lines[1])
      st.end()
    }
  )

  t.test('installs new packages from the public registry', async function (st) {
    const { stderr, stdout } = await run(
      'xst',
      ['package', 'install', 'registry', 'http://exist-db.org/apps/eXide'],
      asAdmin
    )
    st.notOk(stderr, 'There should have been no errors')

    const lines = stdout.split('\n')
    st.equal(
      lines[0],
      '✔︎ http://exist-db.org/apps/eXide > installed latest version at /db/apps/eXide',
      lines[0]
    )
    st.notOk(lines[1])
    st.end()
  })

  t.test(
    'rejects installation when the package is already installed under the same version. depends on previous test',
    async function (st) {
      const { stderr, stdout } = await run(
        'xst',
        [
          'package',
          'install',
          'registry',
          '--registry',
          'http://localhost:8080/exist/apps/public-repo',
          testAppName,
          '1.0.1'
        ],
        asAdmin
      )
      st.ok(stderr, 'The install should have failed, error is filled')

      st.equal(stdout, `- ${testAppName} > 1.0.1 is already installed\n`)
      st.equal(
        stderr,
        'If you wish to force installation use --force.\n',
        stderr
      )
      st.end()
    }
  )

  t.test('Allows reinstalls with force flag passed', async function (st) {
    const { stderr, stdout } = await run(
      'xst',
      [
        'package',
        'install',
        'registry',
        '--registry',
        'http://localhost:8080/exist/apps/public-repo',
        testAppName,
        '1.0.1',
        '--force'
      ],
      asAdmin
    )
    st.notOk(stderr, 'The install should have succeeded')

    // TODO: why is this the URI?
    const lines = stdout.split('\n')
    st.equal(
      lines[0],
      '✔︎ http://exist-db.org/apps/test-app > installed version 1.0.1 at /db/apps/test-app',
      lines[0]
    )
    st.notOk(lines[1])

    st.end()
  })

  t.test(
    'rejects installation when the package is not available under the requested version',
    async function (st) {
      const { stderr, stdout } = await run(
        'xst',
        [
          'package',
          'install',
          'registry',
          '--registry',
          'http://localhost:8080/exist/apps/public-repo',
          testAppName,
          '10.98.2'
        ],
        asAdmin
      )
      st.plan(3)
      st.ok(stderr, 'The install should have failed, error is filled')
      st.notOk(stdout, stdout)

      // @todo: maybe a better error here? Explain user what actually went wrong?
      st.equal(
        stderr,
        '✘ http://exist-db.org/apps/test-app > could not be found in the registry\n'
      )
      st.end()
    }
  )

  t.test(
    'rejects installation when the registry is unreachable',
    async function (st) {
      const { stderr } = await run(
        'xst',
        [
          'package',
          'install',
          'registry',
          '--registry',
          'http://nonsense.com',
          testAppName
        ],
        asAdmin
      )
      st.plan(2)
      st.ok(stderr, 'The install should have failed, error is filled')

      // @todo: maybe a better error here? Explain user what actually went wrong?
      st.equal(
        stderr,
        '✘ http://exist-db.org/apps/test-app > could not be found in the registry\n',
        stderr
      )
      st.end()
    }
  )

  t.teardown(cleanup)
  t.end()
})
