import { test } from 'tape'
import { run } from '../../test.js'

test('package command errors when called without sub-command', async function (t) {
  const { stderr, code } = await run('xst', ['package'])
  t.equal(code, 1)
  t.equal(stderr, 'Not enough non-option arguments: got 0, need at least 1\n')
})

test('package command shows help', async function (t) {
  const { stdout, code } = await run('xst', ['package', '--help'])
  t.equal(code, 0)
  t.ok(stdout, 'Shows some helpful output')
})
