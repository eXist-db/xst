import { test } from 'tape'
import { run } from '../test.js'

test('shows ascii logo', async function (t) {
  const { stderr, stdout } = await run('xst')
  if (stderr) t.fail(stderr)
  const actualLines = stdout.split('\n')

  t.equal(actualLines[1], ' ╲ ╱  ╓───  ──┰──', actualLines[1])
  t.equal(actualLines[2], '  ╳   ╰───╮   │', actualLines[2])
  t.equal(actualLines[3], ' ╱ ╲  ▂▁▁▁│   ┇', actualLines[3])
  t.end()
})

test('shows description', async function (t) {
  const { stderr, stdout } = await run('xst')
  if (stderr) t.fail(stderr)
  const actualLines = stdout.split('\n')

  t.equal(actualLines[5], 'A modern exist-db command line interface', actualLines[5])
})

test('calling xst with no arguments', async (t) => {
  const { stderr, stdout } = await run('xst')
  if (stderr) t.fail(stderr)
  t.ok(stdout)
  t.end()
})
