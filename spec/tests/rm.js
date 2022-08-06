import { test } from 'tape'
import { run, asAdmin } from '../test.js'

const testCollection = '/db/rm-test'

async function ensureCollectionIsRemoved (t) {
  const { stderr, stdout } = await run('xst', ['ls', testCollection])
  if (stdout) { return t.fail(stdout) }
  t.equal(stderr, `✘ ${testCollection} - ${testCollection} does not exist`)
}

async function prepare (t) {
  const query = [
    'xmldb:create-collection("/db", "rm-test")',
    `xmldb:create-collection("${testCollection}", "empty-subcollection")`,
    storeResourceQuery(testCollection, 'b', '"test"'),
    storeResourceQuery(testCollection, 'a.txt', '"test"'),
    storeResourceQuery(testCollection, 'a1.txt', '"test"'),
    storeResourceQuery(testCollection, 'a11.json', '\'{"a":1}\''),
    storeResourceQuery(testCollection, 'a20.txt', '"test"'),
    storeResourceQuery(testCollection, 'a22.xml', '<test />'),
    storeResourceQuery(testCollection, 'index.html', '<html><body>1</body></html>'),
    storeResourceQuery(testCollection, 'test.xq', '"1"')
  ].join(',')
  const { stderr } = await run('xst', ['run', query], asAdmin)
  if (stderr) { return t.fail(stderr) }
  t.end()
}

function storeResourceQuery (collection, fileName, content) {
  return `xmldb:store("${collection}", "${fileName}", ${content})`
}

test("calling 'xst rm --help'", async (t) => {
  const { stderr, stdout } = await run('xst', ['rm', '--help'])
  if (stderr) { return t.fail(stderr) }

  t.ok(stdout, stdout)
  t.end()
})

test('admin cannot remove protected paths', async (t) => {
  const protectedPaths = [
    '/',
    '/db/',
    '/db/apps',
    '/db/apps/',
    '/db/system',
    '/db/system/',
    '/db/system/config',
    '/db/system/repo',
    '/db/system/security',
    '/db/system/security/',
    '/db/system/security/exist',
    '/db/system/security/exist/accounts',
    '/db/system/security/exist/groups'
  ]

  protectedPaths.forEach(p => {
    t.test(`cannot remove protected path ${p}`, async (st) => {
      const { stderr, stdout } = await run('xst', ['rm', '-rf', p], asAdmin)

      if (stdout) { return st.fail(stdout) }
      const path = p !== '/' && p.endsWith('/') ? p.substring(0, p.length - 1) : p

      st.equal(stderr, `Cannot remove protected path: ${path}\n`, stderr)
      st.end()
    })
  })
})

// reliable tests using fixed set
test('with test collection', async (t) => {
  await prepare(t)

  t.test(`cannot remove ${testCollection} as guest`, async (st) => {
    const { stderr, stdout } = await run('xst', ['rm', '-rf', testCollection])

    if (stdout) { return st.fail(stdout) }
    st.equal(stderr, `✘ /db/rm-test - Account 'guest' is not allowed to remove collection '${testCollection}'. Cannot remove collection: Account 'guest' is not allowed to remove collection '${testCollection}'\n`, stderr)
    st.end()
  })

  t.test(`cannot remove ${testCollection} as admin without -r`, async (st) => {
    const { stderr, stdout } = await run('xst', ['rm', testCollection], asAdmin)

    if (stdout) { return st.fail(stdout) }
    st.equal(stderr, `✘ ${testCollection} - ${testCollection} is a collection, but the recursive option is not set\n`, stderr)
    st.end()
  })

  t.test(`can remove ${testCollection}/empty-subcollection as admin without -f`, async (st) => {
    const { stderr, stdout } = await run('xst', ['rm', '-r', testCollection + '/empty-subcollection'], asAdmin)

    if (stderr) { return st.fail(stderr) }
    st.equal(stdout, `✔︎ ${testCollection}/empty-subcollection\n`, 'empty subcollection was removed')
    st.end()
  })

  t.test('cannot remove non-empty collection as admin without -f', async (st) => {
    const { stderr, stdout } = await run('xst', ['rm', '-r', testCollection], asAdmin)

    if (stdout) { return st.fail(stdout) }
    st.equal(stderr, `✘ ${testCollection} - ${testCollection} is a non-empty collection, but the force option is not set\n`, stderr)
    st.end()
  })

  t.test('can remove several resources', async (st) => {
    const { stderr, stdout } = await run('xst', ['rm', testCollection + '/a.txt', testCollection + '/a1.txt'], asAdmin)

    if (stderr) { return st.fail(stderr) }
    const lines = stdout.split('\n')
    st.equal(lines.length, 3, 'expected number of results')
    st.equal(lines[0], `✔︎ ${testCollection}/a.txt`, 'first file was removed')
    st.equal(lines[1], `✔︎ ${testCollection}/a1.txt`, 'second file was removed')
    st.end()
  })

  t.test('admin can remove entire collection with -rf', async (st) => {
    const { stderr, stdout } = await run('xst', ['rm', '-rf', testCollection], asAdmin)

    if (stderr) { return st.fail(stderr) }
    const lines = stdout.split('\n')
    st.equal(lines.length, 2, 'expected number of results')
    st.equal(lines[0], `✔︎ ${testCollection}`, 'test collection was removed')
    st.end()
  })

  t.teardown(ensureCollectionIsRemoved)
})
