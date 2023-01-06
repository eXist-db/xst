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
    const found = lines.filter(l => l.contains('test-app'))
    st.ok(found.length, found[0])
    firstInstallationDate = found.match(/\w+ (.*)$/)
    st.ok(firstInstallationDate, firstInstallationDate)
    st.end()
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
    const found = lines.filter(l => l.contains('test-app'))
    st.ok(found.length, found[0])
    const newInstallationDate = found.match(/\w+ (.*)$/)
    st.notEqual(firstInstallationDate, newInstallationDate, 'installation date changed')
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
