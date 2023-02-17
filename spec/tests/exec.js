import { test } from 'tape'
import { run, runPipe } from '../test.js'

test("calling 'xst execute --help'", async (t) => {
  const { stderr, stdout } = await run('xst', ['execute', '--help'])
  if (stderr) { return t.fail(stderr) }

  const firstLine = stdout.split('\n')[0]

  t.equal(firstLine, 'xst execute [<query>] [options]', firstLine)
  t.end()
})

test('executes command', async (t) => {
  const { stderr, stdout } = await run('xst', ['execute', '1+1'])
  if (stderr) { return t.fail(stderr) }

  t.equal(stdout, '2\n')
})

test('executes command with alias \'exec\'', async function (t) {
  const { stderr, stdout } = await run('xst', ['exec', '1+1'])
  if (stderr) { return t.fail(stderr) }

  t.equal(stdout, '2\n')
})

test('executes command with alias \'run\'', async function (t) {
  const { stderr, stdout } = await run('xst', ['run', '1+1'])
  if (stderr) { return t.fail(stderr) }

  t.equal(stdout, '2\n')
})

test('executes bound command', async function (t) {
  const { stderr, stdout } = await run('xst', ['execute', '-b', '{"a":1}', '$a+$a'])
  if (stderr) { return t.fail(stderr) }

  t.equal(stdout, '2\n')
})

test('bind parse error', async function (t) {
  const { stderr, stdout } = await run('xst', ['execute', '-b', '{a:1}', '$a+$a'])
  t.notOk(stdout)
  t.ok(stderr, stderr)
})

test('read bind from stdin', async function (t) {
  const { stdout, stderr } = await runPipe('echo', ['{"a":1}'], 'xst', ['exec', '-b', '-', '$a+$a'])
  if (stderr) { return t.fail(stderr) }
  t.equals('2\n', stdout)
})

test('cannot read bind from stdin', async function (t) {
  const { stderr, stdout } = await run('xst', ['execute', '-b', '-', '$a+$a'])
  if (stdout) { return t.fail(stdout) }
  t.ok(stderr, stderr)
})

test('cannot read query file from stdin', async function (t) {
  const { stderr, stdout } = await run('xst', ['execute', '-f', '-'])
  if (stdout) { return t.fail(stdout) }
  t.ok(stderr, stderr)
})

test('read query file', async function (t) {
  const { stderr, stdout } = await run('xst', ['execute', '-f', './spec/fixtures/test.xq'])
  if (stderr) { return t.fail(stderr) }
  t.ok(stdout, stdout)
})

test('read query file with query', async function (t) {
  const { stderr, stdout } = await run('xst', ['execute', '-f', './spec/fixtures/test.xq', '1+1'])
  if (stdout) { return t.fail(stdout) }
  t.ok(stderr, stderr)
})

test('read file from stdin', async function (t) {
  const { stdout, stderr } = await runPipe('echo', ['./spec/fixtures/test.xq'], 'xst', ['exec', '-f', '-'])
  if (stderr) { return t.fail(stderr) }
  t.equals('2\n', stdout)
})

test('read query from stdin', async function (t) {
  const { stdout, stderr } = await runPipe('echo', ['1+1'], 'xst', ['exec', '-'])
  if (stderr) { return t.fail(stderr) }
  t.equals('2\n', stdout)
})
