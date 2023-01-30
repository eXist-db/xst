import { test } from 'tape'
import { run, asAdmin } from '../test.js'

test("calling 'xst info'", async (t) => {
  const { stderr, stdout } = await run('xst', ['info'], asAdmin)
  if (stderr) { return t.fail(stderr) }

  const lines = stdout.split('\n')
  t.plan(4)
  t.equal(lines.length, 4, 'outputs four lines')
  t.ok(lines[0].startsWith('Build: '), 'has build info')
  t.ok(lines[1].startsWith('Java: '), 'has Java info')
  t.ok(lines[2].startsWith('OS: '), 'has OS info')
})
