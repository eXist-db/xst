import { test } from 'tape'
import { run, asAdmin } from '../test.js'
import { ct } from '../../utility/console.js'

const testCollection = '/db/list-test'
const testSourceFolder = 'spec'

async function prepare (t) {
  try {
    const phase1 = await run('xst', ['up', '-D', '-e', 'tests', testSourceFolder, testCollection], asAdmin)
    if (phase1.stderr) { throw Error(phase1.stderr) }
    const ensureTestsOlder = await run('xst', ['up', '-e', 'package,utility', testSourceFolder + '/tests', testCollection + '/tests'], asAdmin)
    if (ensureTestsOlder.stderr) { throw Error(ensureTestsOlder.stderr) }
    await storeResource(testCollection, 'b', '"test"')
    await storeResource(testCollection, 'a.txt', '"test"')
    await storeResource(testCollection, 'a1.txt', '"test"')
    await storeResource(testCollection, 'a11.json', '\'{"a":1}\'')
    await storeResource(testCollection, 'a20.txt', '"test"')
    await storeResource(testCollection, 'a22.xml', '<test />')
    await storeResource(testCollection, 'index.html', '<html><body>1</body></html>')
    await storeResource(testCollection, 'test.xq', '"1"')
  } catch (e) {
    t.fail(e)
    t.end()
  }
}

async function storeResource (collection, fileName, content) {
  const query = `xmldb:store("${collection}", "${fileName}", ${content})`
  const { stderr } = await run('xst', ['run', query], asAdmin)
  if (stderr) { throw Error(stderr) }
}

async function cleanup (t) {
  const { stderr, stdout } = await run('xst', ['rm', '-rf', testCollection], asAdmin)
  if (stderr) {
    t.fail(stderr)
  }
  console.log(stdout)
}

test("calling 'xst ls -l /db/system'", async (t) => {
  const { stderr, stdout } = await run('xst', ['ls', '-l', '/db/system'])
  if (stderr) t.fail(stderr)

  const lines = stdout.split('\n')

  t.equal(lines.length, 3, 'only a subset of entries is shown')
  t.ok(/crwxr-xr-x SYSTEM dba {4}0 B {2}\w{3} [ 12]\d [0-2]\d:[0-5]\d config/.test(lines[0]))
  t.ok(/crwxr-xr-x SYSTEM dba {4}0 B {2}\w{3} [ 12]\d [0-2]\d:[0-5]\d repo/.test(lines[1]))
  t.end()
})

test("calling 'xst ls -l /db/system' as admin", async (t) => {
  const { stderr, stdout } = await run('xst', ['ls', '-l', '/db/system'], asAdmin)
  if (stderr) t.fail(stderr)
  const lines = stdout.split('\n')
  t.ok(lines.length > 3, 'all items are listed')
  t.ok(/crwxr-xr-x SYSTEM dba {4}0 B {2}\w{3} [ 12]\d [0-2]\d:[0-5]\d config/.test(lines[0]))
  t.end()
})

// reliable tests using fixed set
test('with fixtures uploaded', async (t) => {
  await prepare(t)

  // glob
  t.test(`calling 'xst ls -g "qqq*" ${testCollection}' as guest`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', '-g', 'qqq*', testCollection])

    if (stderr) { st.fail(stderr) }
    st.notOk(stdout, 'should output nothing')
    st.end()
  })

  t.test(`calling 'xst ls -g "\\*" ${testCollection}' as guest`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', '-g', '\\*', testCollection])

    if (stderr) { st.fail(stderr) }
    st.notOk(stdout, 'should output nothing')
    st.end()
  })

  t.test(`calling 'xst ls -g "*.js" ${testCollection}' as guest`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', '-g', '*.js', testCollection])

    if (stderr) { st.fail(stderr) }
    st.ok(stdout, stdout)
    st.end()
  })

  t.test(`calling 'xst ls --recursive ${testCollection}'`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', '--recursive', testCollection])

    if (stderr) { st.fail(stderr) }
    const lines = stdout.split('\n')
    st.ok(lines.includes(testCollection + '/a22.xml'), 'found xml in root')
    st.ok(lines.includes(testCollection + '/fixtures/.xstrc'), 'found configfile in fixtures')
    st.end()
  })

  t.test(`calling 'xst ls -g "*.js" -R ${testCollection}' as guest`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', '-g', '*.js', '-R', testCollection])

    if (stderr) { st.fail(stderr) }
    const lines = stdout.split('\n')
    st.ok(lines.includes(testCollection + '/test.js'), 'found js in root-collection')
    st.ok(lines.includes(testCollection + '/tests/list.js'), 'found js in sub-collection')
    st.end()
  })

  t.test(`calling 'xst list ${testCollection} --recursive --long'`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '--recursive', '--long'])
    if (stderr) st.fail(stderr)
    st.ok(stdout, 'got output')
    const actualLines = stdout.split('\n')
    st.equal(actualLines[0], testCollection + ':', 'parent collection headline')
    st.ok(/\.[rwx-]{9} \w+ \w+ [ .\d]{3}\d (B |KB|MB|GB) \w{3} [ 12]\d [0-2]\d:[0-5]\d .*?$/.test(actualLines[1]), actualLines[1])
    st.end()
  })

  t.test(`calling 'xst list ${testCollection} --tree --depth 2 --glob .env'`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '--tree', '--depth', '2', '--glob', '.env'])
    if (stderr) st.fail(stderr)
    const expectedlines = [
      'list-test',
      '└── fixtures',
      '    └── .env'
    ]
    const actualLines = stdout.split('\n')
    st.plan(expectedlines.length)
    expectedlines.forEach((line, index) => st.equal(actualLines[index], line, actualLines[index]))
    st.end()
  })

  // size

  t.test(`calling "xst list ${testCollection} --long --size 'bytes'"`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '--long', '--size', 'bytes'])

    if (stderr) { st.fail(stderr) }
    const actualLines = stdout.split('\n')
    st.ok(/^(\.|c)[rwx-]{9} [^ ]+ [^ ]+ +\d+ \w{3} [ 123]\d [0-2]\d:[0-5]\d .*?$/.test(actualLines[0]), actualLines[0])
    st.end()
  })

  // date
  t.test(`calling "xst list ${testCollection} --long --date iso"`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '--long', '--date', 'iso'])

    if (stderr) { st.fail(stderr) }
    const actualLines = stdout.split('\n')
    st.ok(/^(\.|c)[rwx-]{9} [^ ]+ [^ ]+ [ .\d]{3}\d (B |KB|MB|GB) \d{4}-[0-1]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d{3}Z .*?$/.test(actualLines[0]), actualLines[0])
    st.end()
  })

  t.test(`calling "xst list ${testCollection} --long --date short"`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '--long', '--date', 'short'])

    if (stderr) { st.fail(stderr) }
    const actualLines = stdout.split('\n')
    st.ok(/^(\.|c)[rwx-]{9} [^ ]+ [^ ]+ [ .\d]{3}\d (B |KB|MB|GB) \w{3} [ 123]\d [0-2]\d:[0-5]\d .*?$/.test(actualLines[0]), actualLines[0])
    st.end()
  })

  // color
  t.test(`calling 'xst ls --color ${testCollection}'`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', '--color', testCollection])

    if (stderr) { t.fail(stderr) }
    const lines = stdout.split('\n')

    st.ok(lines.includes(ct('index.html', 'FgWhite')), 'html file shown in white')
    st.ok(lines.includes(ct('a22.xml', 'FgGreen')), 'xml file shown in green')
    st.ok(lines.includes(ct('test.xq', 'FgCyan')), 'xquery file shown in cyan')
    st.ok(lines.includes(ct('fixtures', 'FgBlue', 'Bright')), 'collection shown in bright blue')
    st.end()
  })

  t.test(`calling "xst list ${testCollection}" sorts by name`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection])
    if (stderr) { st.fail(stderr) }
    const expectedlines = 'a.txt\na1.txt\na11.json\na20.txt\na22.xml\nb\nfixtures\nindex.html\ntest.js\ntest.xq\ntests\n'

    st.equal(expectedlines, stdout, stdout)
    st.end()
  })

  t.test(`calling "xst list ${testCollection} -r" reverses default sorting`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '-r'])
    if (stderr) { st.fail(stderr) }
    const expectedlines = 'tests\ntest.xq\ntest.js\nindex.html\nfixtures\nb\na22.xml\na20.txt\na11.json\na1.txt\na.txt\n'

    st.equal(expectedlines, stdout, stdout)
    st.end()
  })

  t.test(`calling "xst list ${testCollection} -x"`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '-x'])
    if (stderr) { st.fail(stderr) }
    const expectedlines = 'b\nfixtures\ntests\nindex.html\ntest.js\na11.json\na.txt\na1.txt\na20.txt\na22.xml\ntest.xq\n'

    st.equal(expectedlines, stdout, stdout)
    st.end()
  })

  t.test(`calling "xst list ${testCollection} -s"`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '-s'])
    if (stderr) { st.fail(stderr) }
    const expectedlines = 'a22.xml\nindex.html\ntest.js\na11.json\na.txt\na1.txt\na20.txt\nb\ntest.xq\nfixtures\ntests\n'

    st.equal(expectedlines, stdout, stdout)
    st.end()
  })

  t.test(`calling "xst list ${testCollection} -sr"`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '-sr'])
    if (stderr) { t.fail(stderr) }
    const expectedlines = 'tests\nfixtures\ntest.xq\nb\na20.txt\na1.txt\na.txt\na11.json\ntest.js\nindex.html\na22.xml\n'

    st.equal(expectedlines, stdout, stdout)
    st.end()
  })

  t.test(`calling "xst list ${testCollection} -t"`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '-t'])
    if (stderr) { st.fail(stderr) }

    const expectedlines = 'test.xq\nindex.html\na22.xml\na20.txt\na11.json\na1.txt\na.txt\nb\ntests\ntest.js\nfixtures\n'

    st.equal(expectedlines, stdout, stdout)
    st.end()
  })

  t.test(`calling "xst list ${testCollection} -stxr"`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '-stxr'])
    if (stderr) { st.fail(stderr) }
    const expectedlines = 'fixtures\ntests\ntest.xq\nb\na.txt\na1.txt\na20.txt\na11.json\ntest.js\na22.xml\nindex.html\n'

    st.equal(expectedlines, stdout, stdout)
    st.end()
  })

  t.test(`calling "xst list ${testCollection} -R"`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '-R'])
    if (stderr) { st.fail(stderr) }
    const expectedlines = `/db/list-test/a.txt
/db/list-test/a1.txt
/db/list-test/a11.json
/db/list-test/a20.txt
/db/list-test/a22.xml
/db/list-test/b
/db/list-test/fixtures
/db/list-test/fixtures/.env
/db/list-test/fixtures/.env.staging
/db/list-test/fixtures/.existdb.json
/db/list-test/fixtures/.xstrc
/db/list-test/fixtures/binding.json
/db/list-test/fixtures/broken-test-app.xar
/db/list-test/fixtures/test-app.xar
/db/list-test/fixtures/test.xml
/db/list-test/fixtures/test.xq
/db/list-test/index.html
/db/list-test/test.js
/db/list-test/test.xq
/db/list-test/tests
/db/list-test/tests/cli.js
/db/list-test/tests/configuration.js
/db/list-test/tests/exec.js
/db/list-test/tests/get.js
/db/list-test/tests/info.js
/db/list-test/tests/list.js
/db/list-test/tests/rm.js
/db/list-test/tests/upload.js
`
    st.equal(expectedlines, stdout, stdout)
    st.end()
  })

  t.test(`calling "xst list ${testCollection} -stxrR"`, async (st) => {
    const { stderr, stdout } = await run('xst', ['list', testCollection, '-stxrR'])
    if (stderr) { st.fail(stderr) }
    const expectedlines = `/db/list-test/fixtures
/db/list-test/fixtures/test.xq
/db/list-test/fixtures/.env
/db/list-test/fixtures/.env.staging
/db/list-test/fixtures/binding.json
/db/list-test/fixtures/.xstrc
/db/list-test/fixtures/.existdb.json
/db/list-test/fixtures/test-app.xar
/db/list-test/fixtures/broken-test-app.xar
/db/list-test/fixtures/test.xml
/db/list-test/tests
/db/list-test/tests/info.js
/db/list-test/tests/cli.js
/db/list-test/tests/upload.js
/db/list-test/tests/configuration.js
/db/list-test/tests/exec.js
/db/list-test/tests/rm.js
/db/list-test/tests/get.js
/db/list-test/tests/list.js
/db/list-test/test.xq
/db/list-test/b
/db/list-test/a.txt
/db/list-test/a1.txt
/db/list-test/a20.txt
/db/list-test/a11.json
/db/list-test/test.js
/db/list-test/a22.xml
/db/list-test/index.html
`
    st.equal(expectedlines, stdout, stdout)
    st.end()
  })

  t.teardown(cleanup)
})

// errors

test("calling \"xst list /db --long --size 'qqq'\"", async (t) => {
  const { stderr, stdout } = await run('xst', ['list', '/db', '--long', '--size', 'qqq'])
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
