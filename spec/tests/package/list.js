import { test } from 'tape'
import { run, asAdmin } from '../../test.js'

const pkgUri = 'http://exist-db.org/apps/test-app'

async function removeTestApp (t) {
  const { stderr } = await run('xst', ['run', `repo:undeploy("${pkgUri}"),repo:remove("${pkgUri}")`], asAdmin)
  if (stderr) {
    console.error(stderr)
    t.fail(stderr)
  }
}

test('shows help', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'list', '--help'])

  if (stderr) { return t.fail(stderr) }
  t.ok(stdout, 'got output')
  const firstLine = stdout.split('\n')[0]
  t.equal(firstLine, 'xst package list [options]', firstLine)
})

test('shows extended output', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'list', '--extended'])

  if (stderr) { return t.fail(stderr) }
  const lines = stdout.split('\n')
  t.equal(lines[0], 'dashboard          ')
  t.equal(lines[1], 'Title: Dashboard')
  t.equal(lines[2], 'URI: http://exist-db.org/apps/dashboard')
  t.equal(lines[3], 'Author: Joern Turner')
  t.equal(lines[4], 'Description: Dashboard')
  t.ok(lines[5].startsWith('Version: '), lines[5])
  t.ok(lines[6].startsWith('Installed: '), lines[6])
  t.ok(lines[7].startsWith('Processor: existdb'), lines[7])
  t.equal(lines[8], 'Target: dashboard')
  t.equal(lines[9], 'Type: application')
  t.equal(lines[10], 'License: GNU-LGPL')
  t.equal(lines[11], '')
})

test('shows version', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'list', '--versions'])

  if (stderr) { return t.fail(stderr) }
  const lines = stdout.split('\n')
  t.ok(lines[0].match(/^[a-zA-Z0-9-]+ +\d+\.\d+(\.\d+(-[^ ]+)?)? *$/)[0], lines[0])
})

test('shows dependencies', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'list', '--dependencies'])

  if (stderr) { return t.fail(stderr) }
  t.ok(stdout, 'got output')
})

test('filters by type (libraries)', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'list', '--lib'])

  if (stderr) { return t.fail(stderr) }
  const lines = stdout.split('\n')
  t.equal(lines[0], 'functx')
})

test('filters by type (application)', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'list', '--app'])

  if (stderr) { return t.fail(stderr) }
  const lines = stdout.split('\n')
  t.equal(lines[0], 'dashboard')
})

test('sorts by type', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'list', '--typesort'])

  if (stderr) { return t.fail(stderr) }
  const lines = stdout.split('\n')
  t.equal(lines[0], 'dashboard')
})

test.skip('sorts by type and installation date', async function (t) {
  const { stderr, stdout } = await run('xst', ['package', 'list', '--typesort', '--timesort'])

  if (stderr) { return t.fail(stderr) }
  const lines = stdout.split('\n')
  t.equal(lines[0], 'Install test-app.xar on https://localhost:8443')
})

test('with new package', async function (t) {
  let firstInstallationDate
  t.test('install extra package', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'spec/fixtures/test-app.xar'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      st.end()
      return
    }

    const lines = stdout.split('\n')
    st.equal(lines[0], 'Install test-app.xar on https://localhost:8443')
    st.equal(lines[1], '✔︎ uploaded')
    st.equal(lines[2], '✔︎ installed')
    st.end()
  })

  t.test('list', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'list', '--date', 'iso'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      st.end()
      return
    }

    const lines = stdout.split('\n')
    const found = lines.filter(line => line.startsWith('test-app'))
    st.ok(found.length, found[0])
    firstInstallationDate = new Date(found[0].match(/\d+-.+$/)[0])
    st.ok(firstInstallationDate, 'first installation date')
    st.end()
  })

  t.test('sorts by installation date', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'list', '--timesort'])

    if (stderr) { return t.fail(stderr) }
    const lines = stdout.split('\n')
    st.equal(lines.shift(), 'test-app', 'test-app is first')
  })

  t.test('sorts by installation date (reversed)', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'list', '--timesort', '--reverse'])

    if (stderr) { return t.fail(stderr) }
    const lines = stdout.split('\n')
    st.equal(lines[lines.length - 2], 'test-app', 'test-app is last')
  })

  t.test('update extra package', async function (st) {
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

  t.test('list has updated', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'list', '--date', 'iso'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      st.end()
      return
    }

    const lines = stdout.split('\n')
    const found = lines.filter(line => line.startsWith('test-app'))
    st.ok(found.length, found[0])
    const newInstallationDate = new Date(found[0].match(/\d+-.+$/)[0])
    st.ok(newInstallationDate.getTime() > firstInstallationDate.getTime(), 'installation date changed')
    st.end()
  })

  t.teardown(removeTestApp)
})

test('error', async function (t) {
  const { stderr, stdout } = await run('xst', ['pkg', 'ls', '-a', '-l'], asAdmin)
  if (stdout) {
    t.fail(stdout)
    return
  }
  t.ok(stderr, stderr)
})
