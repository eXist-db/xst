import { test } from 'tape'
import { run } from '../test.js'

test("calling 'xst ls -l /db/system' as admin", async (t) => {
  const { stderr, stdout } = await run('xst', ['ls', '-l', '/db/system'])
  if (stderr) t.fail(stderr)
  t.ok(stdout, stdout)
  t.end()
})

test("calling 'xst ls -l /db/system' as guest", async (t) => {
  const { stderr, stdout } = await run('xst', ['ls', '-l', '/db/system'], { env: { ...process.env, EXISTDB_USER: 'guest', EXISTDB_PASS: 'guest' } })
  if (stdout) t.fail(stdout)

  const lines = stderr.split('\n')

  t.equal(lines[0], 'XPathException:')
  // in 4.7.1 the first collection to throw this error is 'plugins' on later versions of existdb this is 'security'
  // but it could be any custom collection that user guest is not allowed to open
  t.ok(lines[1].startsWith(
    'exerr:ERROR Permission to retrieve permissions is denied for user \'guest\' on \'/db/system/'), stderr)
  t.end()
})

test("calling 'xst ls -g \"e*\" /db/apps' as guest", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '-g', 'e*', '/db/apps'], { env: { ...process.env, EXISTDB_USER: 'guest', EXISTDB_PASS: 'guest' } })

  console.log(stdout)
  if (stderr) t.fail(stderr)

  const lines = stdout.split('\n')
  t.ok(lines.includes('eXide'))
  t.end()
})
