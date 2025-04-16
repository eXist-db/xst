import { test } from 'tape'
import { run, asAdmin } from '../test.js'
import { readdirSync } from 'node:fs'

const testCollectionName = 'get-test'
const testCollection = '/db/' + testCollectionName

async function removeLocalDownload () {
  const { stderrRmLocal } = await run('rm', ['-rf', testCollectionName])
  if (stderrRmLocal) { return console.error(stderrRmLocal) }
}

async function removeRemoteCollection (t) {
  const { stderrRmRemote } = await run('xst', ['rm', '-rf', testCollection])
  if (stderrRmRemote) { return console.error(stderrRmRemote) }
}

async function tearDown (t) {
  await removeLocalDownload()
  await removeRemoteCollection()
}

const expectedDirectoryListing = [
  'a.txt',
  'a1.txt',
  'a11.json',
  'a20.txt',
  'a22.xml',
  'b',
  'empty-subcollection',
  'index.html',
  'subcollection',
  'test.xq'
]

async function prepare (t) {
  t.plan(1)
  const query = [
    `xmldb:create-collection("/db", "${testCollectionName}")`,
    `xmldb:create-collection("${testCollection}", "empty-subcollection")`,
    `xmldb:create-collection("${testCollection}", "subcollection")`,
    `sm:chmod(xs:anyURI("${testCollection}/subcollection"), "rwxrwx---")`,
    storeResourceQuery(testCollection + '/subcollection', 'b', '"test"'),
    storeResourceQuery(testCollection, 'b', '"test"'),
    storeResourceQuery(testCollection, 'a.txt', '"test"'),
    storeResourceQuery(testCollection, 'a1.txt', '"test"'),
    storeResourceQuery(testCollection, 'a11.json', '\'{"a":1}\''),
    storeResourceQuery(testCollection, 'a20.txt', '"test"'),
    storeResourceQuery(testCollection, 'a22.xml', '<test />'),
    storeResourceQuery(testCollection, 'index.html', '<html><body>1</body></html>'),
    storeResourceQuery(testCollection, 'test.xq', '"1"')
  ].join(',')
  const { stderr, stdout } = await run('xst', ['run', query], asAdmin)
  if (stderr) { return t.fail(stderr) }
  t.true(stdout)
}

function storeResourceQuery (collection, fileName, content) {
  return `xmldb:store("${collection}", "${fileName}", ${content})`
}

test("calling 'xst get --help'", async (t) => {
  const { stderr, stdout } = await run('xst', ['get', '--help'])
  if (stderr) { return t.fail(stderr) }

  t.ok(stdout, stdout)
  t.end()
})

// reliable tests using fixed set
test('with test collection', async (t) => {
  t.test(prepare)

  t.test(`can get ${testCollection} as admin`, async (st) => {
    const { stderr, stdout } = await run('xst', ['get', testCollection, '.'], asAdmin)
    if (stderr) { return st.fail(stderr) }
    st.plan(3)

    st.notOk(stdout, 'no output')
    st.deepEqual(readdirSync(testCollectionName), expectedDirectoryListing, 'all files were downloaded')
    st.deepEqual(readdirSync(testCollectionName + '/subcollection'), ['b'], 'subcollection contents were downloaded')

    await removeLocalDownload()
  })

  t.test(`cannot get ${testCollection} as guest`, async (st) => {
    const { stderr, stdout } = await run('xst', ['get', testCollection, '.'])
    if (stdout) {
      await removeLocalDownload()
      return st.ok(stderr)
    }

    st.notOk(stdout, 'was downloaded')

    await removeLocalDownload()

    st.end()
  })

  t.test(`'xst get --verbose ${testCollection}' as admin`, async (st) => {
    const { stderr, stdout } = await run('xst', ['get', '--verbose', testCollection, '.'], asAdmin)
    st.plan(9)
    st.equal(stderr, 'Connecting to https://localhost:8443 as admin\n', stderr)

    const lines = stdout.split('\n')

    st.ok(lines[0].startsWith('Downloading: /db/get-test to '))
    // Server: https://localhost:8443 (v6.1.0-SNAPSHOT)
    st.ok(/Server: [^ ]+ \(v\d+\.\d+.\d+(-[\w\d]+)?\)/.exec(lines[1]))
    st.equal(lines[2], 'User: admin')
    st.equal(lines.length, 16, 'all expected lines in verbose output')
    // files are not downloaded in reproducible order
    st.equal(lines.filter(l => /^✔︎ created directory [/\w]+\/get-test/.exec(l)).length, 3, 'notify 3 directories created')
    st.equal(lines.filter(l => /^✔︎ downloaded resource [/\w]+\/get-test/.exec(l)).length, 9, 'notify 9 resources downloaded')

    st.deepEqual(readdirSync(testCollectionName), expectedDirectoryListing, 'all files were downloaded')
    st.deepEqual(readdirSync(testCollectionName + '/subcollection'), ['b'], 'subcollection contents were downloaded')

    await removeLocalDownload()
  })

  const additionalTestDirectory = 'test'

  t.test(`'xst get ${testCollection}/empty-subcollection ${additionalTestDirectory}' as admin`, async (st) => {
    await run('mkdir', [additionalTestDirectory])
    const { stderr, stdout } = await run('xst', ['get', testCollection + '/empty-subcollection', additionalTestDirectory], asAdmin)
    if (stderr) {
      st.fail(stderr)
      return st.end()
    }
    st.plan(2)
    st.notOk(stdout, 'no output')

    st.deepEqual(readdirSync(additionalTestDirectory), ['empty-subcollection'], `empty subcollection was created in ${additionalTestDirectory} folder`)
    await run('rm', ['-rf', additionalTestDirectory])
  })

  t.teardown(tearDown)
})
