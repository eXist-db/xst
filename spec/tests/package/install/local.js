import { test } from 'tape'
import { run, asAdmin } from '../../../test.js'

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
  const { stderr, stdout } = await run('xst', ['package', 'install', 'local', '--help'])

  if (stderr) { return t.fail(stderr) }
  t.ok(stdout, 'got output')
  const firstLine = stdout.split('\n')[0]
  t.equal(firstLine, 'xst package install local-files <packages..>', firstLine)
})

test('fails when dependency is not met', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/test-app.xar'], asAdmin)
  if (!stderr) {
    t.fail(stdout)
    t.end()
    return
  }
  // console.log(stderr)
  const lines = stderr.split('\n')
  t.equals(lines[0], '✘ spec/fixtures/test-app.xar > test-app@1.0.1 could not be installed', 'Expected failure message')
  // t.ok(lines[1].startsWith('Error: experr:EXPATH00 Failed to install dependency'), 'Error starts with expected code')
  // t.ok(/from https?:\/\/[^?]+\?/.test(lines[1]), 'Has repo url')
  // t.ok(lines[1].includes('?name=http%3A%2F%2Fexist-db.org%2Fapps%2Ftest-lib'), 'Asks for expected dependency')
  // t.ok(/&processor=[^&]+&/.test(lines[1]), 'has processor')
  // t.ok(lines[1].includes('&semver=1'), 'Has correct version requirement')
  t.end()
})

test('is the default method of installing', async function (t) {
  const { stderr, stdout } = await run(
    'xst',
    ['package', 'install', 'spec/fixtures/test-lib.xar'],
    asAdmin
  )
  if (stderr) {
    t.fail(stderr)
    t.end()
    return
  }

  const lines = stdout.split('\n')
  t.equal(
    lines[0],
    '✔︎ spec/fixtures/test-lib.xar > installed test-lib@1.0.0',
    lines[0]
  )
  await removeTestlib(t)
  t.end()
})

test('single valid package with dependency', async function (t) {
  t.test('installs when dependeny is installed first', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/test-lib.xar', 'spec/fixtures/test-app.xar'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      st.end()
      return
    }

    const lines = stdout.split('\n')
    st.equal(lines[0], '✔︎ spec/fixtures/test-lib.xar > installed test-lib@1.0.0', lines[0])
    st.equal(lines[1], '✔︎ spec/fixtures/test-app.xar > installed test-app@1.0.1', lines[1])
    st.end()
  })

  t.test('skips installation on second run', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/test-app.xar'], asAdmin)
    st.ok(stderr, 'If you wish to force installation use --force.', 'Showed installation hint')

    const lines = stdout.split('\n')
    st.equal(lines[0], '- spec/fixtures/test-app.xar > test-app@1.0.1 is already installed', lines[0])
    st.end()
  })

  t.test('installs on second run with --force', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/test-app.xar', '--force'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      st.end()
      return
    }

    const lines = stdout.split('\n')
    st.equal(lines[0], '✔︎ spec/fixtures/test-app.xar > installed test-app@1.0.1', lines[0])
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
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/broken-test-app.xar'], asAdmin)
    if (stdout) { return st.fail(stdout) }

    const lines = stderr.split('\n')
    st.equal(lines[0], '✘ spec/fixtures/broken-test-app.xar > expath-pkg.xml is missing in package')
    st.end()
  })

  t.test('nothing was installed', noTestApp)
})

test('multiple valid packages', async function (t) {
  t.test('installed lib first', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/test-lib.xar'], asAdmin)
    if (stderr) {
      console.error(stderr)
      st.fail(stderr)
      return st.end()
    }
    st.ok(stdout)
  })

  t.test('twice the same package', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/test-app.xar', 'spec/fixtures/test-app.xar'], asAdmin)
    const lines = stdout.split('\n')
    st.equal(lines[0], '✔︎ spec/fixtures/test-app.xar > installed test-app@1.0.1', lines[0])
    st.equal(lines[1], '- spec/fixtures/test-app.xar > test-app@1.0.1 is already installed', lines[1])
    st.equal(stderr, 'If you wish to force installation use --force.\n')
    st.end()
  })
  t.test('temporary collection was removed', async function (st) {
    const { stderr, stdout } = await run('xst', ['ls', packageCollection], asAdmin)
    if (stdout) { return st.fail(stdout) }

    st.equal(stderr, `Collection "${packageCollection}" not found!\n`)
  })

  t.teardown(cleanup)
})

test('using rest for upload', async function (t) {
  t.test('installs lib first', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', '--rest', 'spec/fixtures/test-lib.xar'], asAdmin)
    if (stderr) {
      // console.error(stderr)
      st.fail(stderr)
      return st.end()
    }
    st.ok(stdout)
  })
  t.test('installs app', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', '--rest', 'spec/fixtures/test-app.xar'], asAdmin)
    if (stderr) {
      // console.error(stderr)
      st.fail(stderr)
      return st.end()
    }
    st.ok(stdout)
  })

  t.teardown(cleanup)
})

test('multiple packages', async function (t) {
  t.test('first is broken', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/broken-test-app.xar', 'spec/fixtures/test-app.xar'], asAdmin)
    if (stdout) {
      console.error(stderr)
      st.fail(stdout)
      st.end()
    }

    const lines = stderr.split('\n')
    st.equal(lines[0], '✘ spec/fixtures/broken-test-app.xar > expath-pkg.xml is missing in package')
    st.equal(lines[1], '✘ spec/fixtures/test-app.xar > test-app@1.0.1 could not be installed')
    st.equal(lines[2], '2 of 2 packages could not be installed!')
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
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/test-lib.xar'], asAdmin)
    if (stderr) {
      console.error(stderr)
      st.fail(stderr)
      return st.end()
    }
    st.ok(stdout)
  })

  t.test('second is broken', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/test-app.xar', 'spec/fixtures/broken-test-app.xar'], asAdmin)

    st.equal(stdout, '✔︎ spec/fixtures/test-app.xar > installed test-app@1.0.1\n')
    const lines = stderr.split('\n')

    st.equal(lines[0], '✘ spec/fixtures/broken-test-app.xar > expath-pkg.xml is missing in package')
    st.equal(lines[1], '1 of 2 packages could not be installed!')
    st.end()
  })
  t.test('temporary collection was removed', async function (st) {
    const { stderr, stdout } = await run('xst', ['ls', packageCollection], asAdmin)
    // console.log(stdout)
    // console.log(stderr)
    if (stdout) { return st.fail(stdout) }

    st.equal(stderr, `Collection "${packageCollection}" not found!\n`)
  })

  t.teardown(cleanup)
})

test('error', async function (t) {
  const { stderr, stdout } = await run('xst', ['pkg', 'i', 'local', 'asdf'], asAdmin)
  if (stdout) {
    t.fail(stdout)
    return
  }
  t.ok(stderr, stderr)
})

test('error file not found', async function (t) {
  const { stderr, stdout } = await run('xst', ['pkg', 'i', 'local', 'asdf'], asAdmin)
  if (stdout) {
    t.fail(stdout)
    return
  }
  t.ok(stderr, stderr)
})

test('error install as guest', async function (t) {
  const { stderr, stdout } = await run('xst', ['pkg', 'i', 'local', 'spec/fixtures/test-app.xar'])
  if (stdout) {
    t.fail(stdout)
    return
  }
  t.ok(stderr, stderr)
})
