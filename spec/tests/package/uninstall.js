import { test } from 'tape'
import { run, asAdmin } from '../../test.js'

const testAppName = 'http://exist-db.org/apps/test-app'
const testLibName = 'http://exist-db.org/apps/test-lib'

async function removeTestApp (t) {
  const { stderr } = await run('xst', ['run', `repo:undeploy("${testAppName}"),repo:remove("${testAppName}")`], asAdmin)
  if (stderr) {
    console.error(stderr)
    t.fail(stderr)
  }
}
async function removeTestLib (t) {
  const { stderr } = await run('xst', ['run', `repo:undeploy("${testLibName}"),repo:remove("${testLibName}")`], asAdmin)
  if (stderr) {
    console.error(stderr)
    t.fail(stderr)
  }
}
async function cleanupTest (t) {
  const { stderr, stdout } = await run('xst', ['run', 'repo:list()'])

  if (stderr) { return t.fail(stderr) }

  const packages = stdout.split(',')

  if (packages.includes(testAppName)) {
    await removeTestApp(t)
    t.fail(testAppName)
  }
  if (packages.includes(testLibName)) {
    await removeTestLib(t)
    t.fail(testLibName)
  }
}

async function prepare (t) {
  try {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/test-lib.xar', 'spec/fixtures/test-app.xar'], asAdmin)
    if (stderr) { throw Error(stderr) }
    t.ok(stdout, 'packages installed')
  } catch (e) {
    t.fail(e)
    t.end()
  }
}

test('shows help', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'uninstall', '--help'])

  if (stderr) { return t.fail(stderr) }
  t.ok(stdout, 'got output')
  const firstLine = stdout.split('\n')[0]
  t.equal(firstLine, 'xst package uninstall [options] <packages..>', firstLine)
  t.end()
})

test('checks dependencies to safeguard', async (t) => {
  await prepare(t)

  t.test('cannot remove test-lib', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'uninstall', 'test-lib'], asAdmin)
    if (stdout) {
      st.fail(stdout)
      return st.end()
    }

    const lines = stderr.split('\n')
    st.equal(lines[0], '✘ Package \'test-lib\' has dependents: test-app', lines[0])
    st.end()
  })

  t.test('can remove test-lib with --force', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'uninstall', 'test-lib', '--force'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      st.end()
      return
    }

    const lines = stdout.split('\n')
    st.equal(lines[0], `✔︎ ${testLibName} uninstalled`)
    st.end()
  })

  t.test('can remove test-app', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'uninstall', 'test-app'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      st.end()
      return
    }

    const lines = stdout.split('\n')
    st.equal(lines[0], `✔︎ ${testAppName} uninstalled`)
    st.end()
  })

  t.teardown(cleanupTest)
})

test('does uninstall one after the other', async function (t) {
  await prepare(t)

  t.test('app can be removed after lib is', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'uninstall', 'test-app', 'test-lib'], asAdmin)
    if (stderr) {
      console.error(stderr)
      st.fail(stderr)
      st.end()
      return
    }
    console.log(stdout)
    const lines = stdout.split('\n')
    st.equal(lines[0], `✔︎ ${testAppName} uninstalled`)
    st.equal(lines[1], `✔︎ ${testLibName} uninstalled`)
    st.end()
  })

  t.teardown(cleanupTest)
})

test('does continue after error', async function (t) {
  await prepare(t)

  t.test('first is broken', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'uninstall', 'asdf', 'test-app'], asAdmin)
    const firstErrorLine = stderr.split('\n')[0]
    st.equal(firstErrorLine, '✘ Package \'asdf\' not found.', firstErrorLine)
    const lines = stdout.split('\n')
    st.equal(lines[0], `✔︎ ${testAppName} uninstalled`, lines[0])
    st.end()
  })
  t.test('lib can be removed with no dependents', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'uninstall', 'test-lib'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      return st.end()
    }
    const firstLine = stdout.split('\n')[0]
    st.equal(firstLine, `✔︎ ${testLibName} uninstalled`, firstLine)
  })

  t.test(cleanupTest)
})

test('error package not found', async function (t) {
  const { stderr, stdout } = await run('xst', ['pkg', 'uninstall', 'asdf'], asAdmin)
  if (stdout) {
    t.fail(stdout)
    return
  }
  t.ok(stderr, stderr)
})

test('cannot uninstall as guest', async function (t) {
  const { stderr, stdout } = await run('xst', ['pkg', 'uninstall', 'test-app'])
  if (stdout) {
    t.fail(stdout)
    return
  }
  t.ok(stderr, stderr)
})
