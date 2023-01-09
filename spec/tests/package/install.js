import { test } from 'tape'
import { run, asAdmin } from '../../test.js'

const packageCollection = '/db/pkgtmp'
const testAppName = 'http://exist-db.org/apps/test-app'
const testLibName = 'http://exist-db.org/apps/test-lib'

async function removeTestApp (t) {
  const { stderr } = await run('xst', ['run', `repo:undeploy("${testAppName}"),repo:remove("${testAppName}")`], asAdmin)
  if (stderr) {
    console.error(stderr)
    t.fail(stderr)
  }
}

async function removeTestlib (t) {
  const { stderr } = await run('xst', ['run', `repo:undeploy("${testLibName}"),repo:remove("${testLibName}")`], asAdmin)
  if (stderr) {
    console.error(stderr)
    t.fail(stderr)
  }
}

async function cleanup (t) {
  await removeTestlib(t)
  await removeTestApp(t)
}

async function noTestApp (t) {
  const { stderr, stdout } = await run('xst', ['run', `repo:undeploy("${testAppName}"),repo:remove("${testAppName}")`], asAdmin)
  if (stdout) {
    t.fail(stdout, 'Test app was present')
    return
  }
  t.ok(stderr)
}

test('shows help', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'install', '--help'])

  if (stderr) { return t.fail(stderr) }
  t.ok(stdout, 'got output')
  const firstLine = stdout.split('\n')[0]
  t.equal(firstLine, 'xst package install [options] <packages..>', firstLine)
})

test('fails when dependency is not met', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'install', 'spec/fixtures/test-app.xar'], asAdmin)
  if (!stderr) {
    t.fail(stdout)
    t.end()
    return
  }

  t.ok(stderr.startsWith('Error: experr:EXPATH00 Failed to install dependency'), 'Error starts with expected code')
  t.ok(stderr.match(/from https?:\/\/[^?]+\?/), 'Has repo url')
  t.ok(stderr.includes('?name=http%3A%2F%2Fexist-db.org%2Fapps%2Ftest-lib'), 'Asks for expected dependency')
  t.ok(stderr.match(/&processor=[^&]+&/), 'has processor')
  t.ok(stderr.includes('&semver=1'), 'Has correct version requirement')
  t.end()
})

test('single valid package with dependency', async function (t) {
  t.test('installs when dependeny is installed first', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'spec/fixtures/test-lib.xar', 'spec/fixtures/test-app.xar'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      st.end()
      return
    }

    const lines = stdout.split('\n')
    st.equal(lines[0], 'Install test-lib.xar on https://localhost:8443')
    st.equal(lines[1], '✔︎ uploaded')
    st.equal(lines[2], '✔︎ installed')
    st.equal(lines[3], 'Install test-app.xar on https://localhost:8443')
    st.equal(lines[4], '✔︎ uploaded')
    st.equal(lines[5], '✔︎ installed')
    st.end()
  })

  t.test('updates on second run', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'spec/fixtures/test-app.xar'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      st.end()
      return
    }

    const lines = stdout.split('\n')
    st.equal(lines[0], 'Install test-app.xar on https://localhost:8443')
    st.equal(lines[1], '✔︎ uploaded')
    st.equal(lines[2], '✔︎ updated')
    st.end()
  })

  t.test('temporary collection was removed', async function (st) {
    const { stderr, stdout } = await run('xst', ['ls', packageCollection], asAdmin)
    if (stdout) { return st.fail(stdout) }

    st.equal(stderr, `Collection "${packageCollection}" not found!\n`)
  })
  t.teardown(cleanup)
})

test('single broken package', async function (t) {
  t.test(async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'spec/fixtures/broken-test-app.xar'], asAdmin)

    const lines = stdout.split('\n')
    st.equal(lines[0], 'Install broken-test-app.xar on https://localhost:8443')
    st.equal(lines[1], '✔︎ uploaded')
    st.equal(stderr, 'Error: experr:EXPATH00 Missing descriptor from package: /db/pkgtmp/broken-test-app.xar\n')
    st.end()
  })

  t.test('nothing was installed', noTestApp)
})

test('multiple valid packages', async function (t) {
  t.test('installed lib first', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'spec/fixtures/test-lib.xar'], asAdmin)
    if (stderr) {
      console.error(stderr)
      st.fail(stderr)
      return st.end()
    }
    st.ok(stdout)
  })

  t.test('twice the same package', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'spec/fixtures/test-app.xar', 'spec/fixtures/test-app.xar'], asAdmin)
    if (stderr) {
      console.error(stderr)
      st.fail(stderr)
      return st.end()
    }
    console.log(stdout)
    const lines = stdout.split('\n')
    st.equal(lines[0], 'Install test-app.xar on https://localhost:8443')
    st.equal(lines[1], '✔︎ uploaded')
    st.equal(lines[2], '✔︎ installed')
    st.equal(lines[3], 'Install test-app.xar on https://localhost:8443')
    st.equal(lines[4], '✔︎ uploaded')
    st.equal(lines[5], '✔︎ updated')
    st.end()
  })
  t.test('temporary collection was removed', async function (st) {
    const { stderr, stdout } = await run('xst', ['ls', packageCollection], asAdmin)
    if (stdout) { return st.fail(stdout) }

    st.equal(stderr, `Collection "${packageCollection}" not found!\n`)
  })

  t.teardown(cleanup)
})

test('multiple packages', async function (t) {
  t.test('first is broken', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'spec/fixtures/broken-test-app.xar', 'spec/fixtures/test-app.xar'], asAdmin)
    if (stdout) {
      st.equal(stdout, 'Install broken-test-app.xar on https://localhost:8443\n✔︎ uploaded\n')
    }
    st.equal(stderr, 'Error: experr:EXPATH00 Missing descriptor from package: /db/pkgtmp/broken-test-app.xar\n')
    st.end()
  })
  t.test('temporary collection was removed', async function (st) {
    const { stderr, stdout } = await run('xst', ['ls', packageCollection], asAdmin)
    if (stdout) { return st.fail(stdout) }

    st.equal(stderr, `Collection "${packageCollection}" not found!\n`)
  })

  t.test('nothing was installed', noTestApp)
})

test('multiple packages', async function (t) {
  t.test('installed lib first', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'spec/fixtures/test-lib.xar'], asAdmin)
    if (stderr) {
      console.error(stderr)
      st.fail(stderr)
      return st.end()
    }
    st.ok(stdout)
  })

  t.test('second is broken', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'spec/fixtures/test-app.xar', 'spec/fixtures/broken-test-app.xar'], asAdmin)

    const lines = stdout.split('\n')
    st.equal(lines[0], 'Install test-app.xar on https://localhost:8443')
    st.equal(lines[1], '✔︎ uploaded')
    st.equal(lines[2], '✔︎ installed')
    st.equal(lines[3], 'Install broken-test-app.xar on https://localhost:8443')
    st.equal(lines[4], '✔︎ uploaded')
    st.equal(stderr, 'Error: experr:EXPATH00 Missing descriptor from package: /db/pkgtmp/broken-test-app.xar\n')
    st.end()
  })
  t.test('temporary collection was removed', async function (st) {
    const { stderr, stdout } = await run('xst', ['ls', packageCollection], asAdmin)
    if (stdout) { return st.fail(stdout) }

    st.equal(stderr, `Collection "${packageCollection}" not found!\n`)
  })

  t.teardown(cleanup)
})

test('error', async function (t) {
  const { stderr, stdout } = await run('xst', ['pkg', 'i', 'asdf'], asAdmin)
  if (stdout) {
    t.fail(stdout)
    return
  }
  t.ok(stderr, stderr)
})

test('error file not found', async function (t) {
  const { stderr, stdout } = await run('xst', ['pkg', 'i', 'asdf'], asAdmin)
  if (stdout) {
    t.fail(stdout)
    return
  }
  t.ok(stderr, stderr)
})

test('error install as guest', async function (t) {
  const { stderr, stdout } = await run('xst', ['pkg', 'i', 'spec/fixtures/test-app.xar'])
  if (stdout) {
    t.fail(stdout)
    return
  }
  t.ok(stderr, stderr)
})
