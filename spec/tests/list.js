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
  t.equal(actualLines[0], '/db/apps/dashboard:', 'parent collection headline')
  t.ok(/\.[rwx-]{9} \w+ \w+ [ .\d]{3}\d (B |KB|MB|GB) \w{3} [ 12]\d [0-2]\d:[0-5]\d .*?$/.test(actualLines[1]), actualLines[1])
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
  t.ok(/^\.[rwx-]{9} [^ ]+ [^ ]+ +\d+ \w{3} [ 12]\d [0-2]\d:[0-5]\d .*?$/.test(actualLines[0]), actualLines[0])
  t.end()
})

// test sorting

test('calling "xst list /db/apps/eXide" sorts by name', async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db/apps/eXide'])
  if (stderr) { t.fail(stderr) }
  const expectedlines = `build.js
collection.xconf
configuration.xml
controller.xql
cypress.json
docs
expath-pkg.xml
help.html
icon.png
index.html
keybindings.js
LICENSE.txt
modules
package.json
pre-install.xql
README.md
repo.xml
resources
src
templates
`

  t.equal(expectedlines, stdout, stdout)
  t.end()
})

test('calling "xst list /db/apps/eXide -r" reverts default sorting', async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db/apps/eXide', '-r'])
  if (stderr) { t.fail(stderr) }
  const expectedlines = `templates
src
resources
repo.xml
README.md
pre-install.xql
package.json
modules
LICENSE.txt
keybindings.js
index.html
icon.png
help.html
expath-pkg.xml
docs
cypress.json
controller.xql
configuration.xml
collection.xconf
build.js
`

  t.equal(expectedlines, stdout, stdout)
  t.end()
})

test('calling "xst list /db/apps/eXide -x"', async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db/apps/eXide', '-x'])
  if (stderr) { t.fail(stderr) }
  const expectedlines = `docs
modules
resources
src
templates
help.html
index.html
build.js
keybindings.js
cypress.json
package.json
README.md
icon.png
LICENSE.txt
collection.xconf
configuration.xml
expath-pkg.xml
repo.xml
controller.xql
pre-install.xql
`
  t.equal(expectedlines, stdout, stdout)
  t.end()
})

test('calling "xst list /db/apps/eXide -s"', async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db/apps/eXide', '-s'])
  if (stderr) { t.fail(stderr) }
  const expectedlines = `docs
modules
resources
src
templates
cypress.json
build.js
package.json
pre-install.xql
keybindings.js
README.md
collection.xconf
configuration.xml
expath-pkg.xml
icon.png
help.html
controller.xql
repo.xml
LICENSE.txt
index.html
`

  t.equal(expectedlines, stdout, stdout)
  t.end()
})

test('calling "xst list /db/apps/eXide -sr"', async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db/apps/eXide', '-sr'])
  if (stderr) { t.fail(stderr) }
  const expectedlines = `index.html
LICENSE.txt
repo.xml
controller.xql
help.html
icon.png
expath-pkg.xml
configuration.xml
collection.xconf
README.md
keybindings.js
pre-install.xql
package.json
build.js
cypress.json
templates
src
resources
modules
docs
`

  t.equal(expectedlines, stdout, stdout)
  t.end()
})

test('calling "xst list /db/apps/eXide -t"', async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db/apps/eXide', '-t'])
  if (stderr) { t.fail(stderr) }
  const expectedlines = `expath-pkg.xml
collection.xconf
icon.png
cypress.json
keybindings.js
help.html
index.html
controller.xql
build.js
configuration.xml
README.md
LICENSE.txt
package.json
pre-install.xql
resources
docs
templates
modules
src
repo.xml
`

  t.equal(expectedlines, stdout, stdout)
  t.end()
})

test('calling "xst list /db/apps/eXide -stxr"', async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db/apps/eXide', '-stxr'])
  if (stderr) { t.fail(stderr) }
  const expectedlines = `index.html
LICENSE.txt
repo.xml
controller.xql
help.html
icon.png
configuration.xml
collection.xconf
expath-pkg.xml
README.md
keybindings.js
pre-install.xql
package.json
build.js
cypress.json
src
modules
templates
docs
resources
`

  t.equal(expectedlines, stdout, stdout)
  t.end()
})

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
  t.equal(stderr, 'Arguments R and T are mutually exclusive\n')
  t.end()
})
