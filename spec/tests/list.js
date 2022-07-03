import { test } from 'tape'
import { run, asGuest } from '../test.js'
import { cc } from '../../utility/console.js'

test("calling 'xst ls -l /db/system' as admin", async (t) => {
  const { stderr, stdout } = await run('xst', ['ls', '-l', '/db/system'])
  if (stderr) t.fail(stderr)
  t.ok(stdout, stdout)
  t.end()
})

test("calling 'xst ls -l /db/system' as guest", async (t) => {
  const { stderr, stdout } = await run('xst', ['ls', '-l', '/db/system'], asGuest)
  if (stderr) t.fail(stderr)

  const lines = stdout.split('\n')

  t.equal(lines.length, 3)
  t.ok(/crwxr-xr-x SYSTEM dba {4}0 B {2}\w{3} [ 12]\d [0-2]\d:[0-5]\d config/.test(lines[0]))
  t.ok(/crwxr-xr-x SYSTEM dba {4}0 B {2}\w{3} [ 12]\d [0-2]\d:[0-5]\d repo/.test(lines[1]))
  t.end()
})

test("calling 'xst ls -g \"e*\" /db/apps' as guest", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '-g', 'e*', '/db/apps'], asGuest)

  if (stderr) { t.fail(stderr) }

  const lines = stdout.split('\n')
  t.ok(lines.includes('eXide'))
  t.end()
})

test("calling 'xst ls --recursive /db/apps/eXide'", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '--recursive', '/db/apps/eXide'])

  if (stderr) { t.fail(stderr) }
  const lines = stdout.split('\n')
  t.ok(lines.includes('/db/apps/eXide/expath-pkg.xml'))
  t.end()
})

test("calling 'xst list /db/apps/dashboard --recursive --extended'", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db/apps/dashboard', '--recursive', '--extended'])
  if (stderr) t.fail(stderr)
  t.ok(stdout, 'got output')
  const actualLines = stdout.split('\n')
  t.equal(actualLines[0], '/db/apps/dashboard:')
  t.ok(/.rw-r--r-- SYSTEM dba {2}4.0 KB \w{3} [ 12]\d [0-2]\d:[0-5]\d repo.xml/.test(actualLines[1]), actualLines[1])
  t.end()
})

test("calling 'xst ls --color /db/apps/eXide'", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '--color', '/db/apps/eXide'])

  if (stderr) { t.fail(stderr) }
  const lines = stdout.split('\n')
  t.ok(lines.includes(cc('FgWhite') + 'index.html' + cc('Reset')))
  t.ok(lines.includes(cc('FgGreen') + 'expath-pkg.xml' + cc('Reset')))
  t.ok(lines.includes(cc('FgCyan') + 'controller.xql' + cc('Reset')))
  t.ok(lines.includes(cc('Bright') + cc('FgBlue') + 'resources' + cc('Reset')))
  t.end()
})

test("calling 'xst list /db/apps/dashboard --tree --depth 2 --glob \"*.css\"'", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db/apps/dashboard', '--tree', '--depth', '2', '--glob', '*.css'])
  if (stderr) t.fail(stderr)
  const expectedlines = [
    'dashboard',
    '└── resources',
    '    └── styles.css'
  ]
  const actualLines = stdout.split('\n')
  t.plan(expectedlines.length)
  expectedlines.forEach((line, index) => t.ok(actualLines[index] === line, actualLines[index]))
  t.end()
})

test("calling \"xst list /db/apps/eXide --extended --size 'bytes'\"", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db/apps/eXide', '--extended', '--size', 'bytes'])

  if (stderr) { t.fail(stderr) }
  const actualLines = stdout.split('\n')
  t.ok(/\.rwxrwxr-x eXide eXide {2}\d\d\d\d \w{3} [ 12]\d [0-2]\d:[0-5]\d expath-pkg.xml/.test(actualLines[0]), actualLines[0])
  t.end()
})

test("calling \"xst list /db/apps/eXide --extended --size 'short'\"", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db/apps/eXide', '--extended', '--size', 'short'])

  if (stderr) { t.fail(stderr) }
  const actualLines = stdout.split('\n')
  t.ok(/\.rwxrwxr-x eXide eXide {2}4.0 KB \w{3} [ 12]\d [0-2]\d:[0-5]\d expath-pkg.xml/.test(actualLines[0]), actualLines[0])
  t.end()
})

// TODO test sorting

// errors

test.skip("calling \"xst list /db --size 'bytes'\"", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db', '--size', 'bytes'])
  if (stdout) t.fail(stdout)
  t.equal(stderr, 'Invalid values:\n  Argument: size, Given: "qqq", Choices: "short", "bytes"\n')
  t.end()
})

test("calling \"xst list /db --extended --size 'qqq'\"", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db', '--extended', '--size', 'qqq'])
  if (stdout) t.fail(stdout)
  t.equal(stderr, 'Invalid values:\n  Argument: size, Given: "qqq", Choices: "short", "bytes"\n')
  t.end()
})

test("calling \"xst list /db --glob '**'\"", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db', '--glob', '**'])
  if (stdout) t.fail(stdout)
  t.ok(stderr, 'got error')
  const actualLines = stderr.split('\n')
  t.equal(actualLines[0], 'Invalid value for option "glob"; "**" is not supported yet')
  t.end()
})

test('calling "xst list /db --recursive --tree"', async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db', '--recursive', '--tree'])
  if (stdout) t.fail(stdout)
  t.equal(stderr, 'Arguments R and t are mutually exclusive\n')
  t.end()
})
