import { test } from 'tape'
import { run, asAdmin } from '../../test.js'

const testLibName = 'http://exist-db.org/apps/test-lib'

async function removeTestlib (t) {
  const { stderr } = await run('xst', ['run', `repo:undeploy("${testLibName}"),repo:remove("${testLibName}")`], asAdmin)
  if (stderr) {
    console.error(stderr)
    t.fail(stderr)
  }
}

async function cleanup (t) {
  await removeTestlib(t)
}

test('package install without REST', async function (t) {
  t.test('falls back to XMLRPC, succeeds', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', 'spec/fixtures/test-lib.xar'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      st.end()
      return
    }

    const lines = stdout.split('\n')
    st.equal(lines[0], 'Falling back to XMLRPC API')
    st.equal(lines[1], '✔︎ spec/fixtures/test-lib.xar > installed test-lib@1.0.0')
    st.end()
  })

  t.test('succeeds when enforcing upload over XMLRPC', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', '--rpc', 'spec/fixtures/test-lib.xar', '-f'], asAdmin)
    if (stderr) {
      st.fail(stderr)
      st.end()
      return
    }

    const lines = stdout.split('\n')
    st.equal(lines[0], '✔︎ spec/fixtures/test-lib.xar > installed test-lib@1.0.0')
    st.end()
  })

  t.test('fails with enforced upload over REST', async function (st) {
    const { stderr, stdout } = await run('xst', ['package', 'install', 'local', '--rest', 'spec/fixtures/test-lib.xar', '-f'], asAdmin)

    st.notOk(stdout, 'No output on stdout')
    st.equal(stderr, '✘ spec/fixtures/test-lib.xar > Request failed with status code 403 (Forbidden): PUT https://localhost:8443/exist/rest/db/pkgtmp/test-lib.xar\nPackage could not be installed!\n')
    st.end()
  })

  t.teardown(cleanup)
})
