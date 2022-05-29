import { test } from 'tape'
import { run } from '../test.js'

test("calling 'xst tree /db/system' as admin", async (t) => {
  const { stderr, stdout } = await run('xst', ['tree', '-l', '1', '/db/system'])
  if (stderr) t.fail(stderr)
  t.ok(stdout.startsWith('system'), stdout)
  t.end()
})

test("calling 'xst tree /db/system' as guest", async (t) => {
  const { stderr, stdout } = await run('xst', ['tree', '-l', '1', '/db/system'], { env: { ...process.env, EXISTDB_USER: 'guest', EXISTDB_PASS: 'guest' } })
  if (stderr) t.fail(stderr)
  t.ok(stdout.startsWith('system'), stdout)
  t.end()
})
