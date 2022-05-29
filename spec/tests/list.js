import { test } from 'tape'
import { run } from '../test.js'

test("calling 'xst ls /db/system' as admin", async (t) => {
  const { stderr, stdout } = await run('xst', ['ls', '-l', '/db/system'])
  if (stderr) t.fail(stderr)
  t.ok(stdout, stdout)
  t.end()
})

test("calling 'xst ls /db/system' as guest", async (t) => {
  const { stderr, stdout } = await run('xst', ['ls', '-l', '/db/system'], { env: { ...process.env, EXISTDB_USER: 'guest', EXISTDB_PASS: 'guest' } })
  if (stdout) t.fail(stdout)

  const lines = stderr.split('\n')

  t.equal(lines[0], 'XPathException:')
  t.ok(lines[1].startsWith('exerr:ERROR Permission to retrieve permissions is denied for user \'guest\' on \'/db/system/security\':'))
  t.end()
})
