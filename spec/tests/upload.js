import { test } from 'tape'
import { run, asAdmin } from '../test.js'

test("calling 'xst up modules/test.xq /db/tmp' as admin", async (t) => {
  const { stderr, stdout } = await run('xst', ['up', 'spec/fixtures/test.xq', '/db/tmp'], asAdmin)
  if (stderr) t.fail(stderr)
  t.ok(stdout, stdout)
  t.end()
})

test("calling 'xst up modules /db/tmp' as admin", async (t) => {
  const { stderr, stdout } = await run('xst', ['up', 'spec/fixtures', '/db/tmp'], asAdmin)
  if (stderr) t.fail(stderr)
  t.ok(stdout, stdout)
  t.end()
})

test.skip("calling 'xst up modules/test.xq /db/foo' as guest", async (t) => {
  const { stderr, stdout } = await run('xst', ['up', 'modules', '/db/foo'])
  if (stdout) t.fail(stdout)

  const lines = stderr.split('\n')

  t.equal(lines[0], 'XPathException:')
  t.ok(lines[1].startsWith('exerr:ERROR Permission to retrieve permissions is denied for user \'guest\' on \'/db/system/security\':'))
  t.end()
})
