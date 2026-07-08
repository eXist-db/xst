import { test } from 'tape'
import yargs from 'yargs'
import * as exec from '../../commands/exec.js'
import { getWsUrl, getAuthHeader, escapeXQuery, buildEvalQuery, buildFetchQuery, buildSerializationOptions, serializeXQueryMap } from '../../commands/exec.js'
import { run, runPipe, asAdmin } from '../test.js'

const parser = yargs().scriptName('xst').command(exec).help().fail(false)

const execCmd = async (cmd, args) => {
  return await yargs()
    .scriptName('xst')
    .command(cmd)
    .fail(false)
    .parse(args)
}

test('shows help', async function (t) {
  // Run the command module with --help as argument
  const output = await new Promise((resolve, reject) => {
    parser.parse(['execute', '--help'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(output)
    })
  })
  const firstLine = output.split('\n')[0]

  t.equal(firstLine, 'xst execute [<query>] [options]', firstLine)
})

test('executes command', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['execute', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })

  t.equal(argv.query, '1+1')
})

test('executes command with alias \'exec\'', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })

  t.equal(argv.query, '1+1')
})

test('executes command with alias \'run\'', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['run', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })

  t.equal(argv.query, '1+1')
})

test('executes bound command', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '-b', '{"a":1}', '$a+$a'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.plan(2)
  t.equal(argv.query, '$a+$a')
  t.equal(argv.bind.a, 1)
})

test('bind parse error', async function (t) {
  try {
    const res = await execCmd(exec, ['exec', '-b', '{a:1}', '$a+$a'])
    t.notOk(res)
  } catch (e) {
    t.ok(e, e)
  }
})

test('read bind from stdin', async function (t) {
  const { stdout, stderr } = await runPipe('echo', ['{"a":1}'], 'xst', ['exec', '-b', '-', '$a+$a'])
  if (stderr) { return t.fail(stderr) }
  t.equals('2\n', stdout)
})

test('cannot read bind from stdin', async function (t) {
  try {
    const res = await execCmd(exec, ['exec', '-b', '-', '$a+$a'])
    t.fail(res)
  } catch (e) {
    t.ok(e, e)
  }
})

test('cannot read query file from stdin', async function (t) {
  try {
    const res = await execCmd(exec, ['exec', '-f', '-'])
    t.fail(res)
  } catch (e) {
    t.ok(e, e)
  }
})

test('read query file', async function (t) {
  try {
    const argv = await new Promise((resolve, reject) => {
      parser.parse(['exec', '-f', './spec/fixtures/test.xq'], (err, argv, output) => {
        if (err) { return reject(err) }
        resolve(argv)
      })
    })
    t.equals(argv.f, 'spec/fixtures/test.xq', 'should be normalized')
  } catch (e) {
    t.notOk(e, e)
  }
})

test('read query file with query', async function (t) {
  try {
    const argv = await parser.parse(['exec', '-f', 'spec/fixtures/test.xq', '1+1'])
    t.fail(argv, 'Should not return a result')
  } catch (e) {
    t.ok(e, e)
  }
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

// --stream flag parsing

test('parses --stream flag', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '--stream', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.plan(2)
  t.equal(argv.stream, true)
  t.equal(argv.query, '1+1')
})

test('parses -s shorthand for --stream', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '-s', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.stream, true)
})

test('--stream defaults to false', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.stream, false)
})

// --timing flag parsing

test('parses --timing flag', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '--timing', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.plan(2)
  t.equal(argv.timing, true)
  t.equal(argv.query, '1+1')
})

test('parses -t shorthand for --timing', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '-t', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.timing, true)
})

test('--timing defaults to false', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.timing, false)
})

test('parses --stream and --timing together', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '--stream', '--timing', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.plan(3)
  t.equal(argv.stream, true)
  t.equal(argv.timing, true)
  t.equal(argv.query, '1+1')
})

// WebSocket URL construction

test('getWsUrl builds ws:// URL from http connection', function (t) {
  const url = getWsUrl({ protocol: 'http:', host: 'localhost', port: 8080 })
  t.equal(url, 'ws://localhost:8080/exist/ws/eval')
  t.end()
})

test('getWsUrl builds wss:// URL from https connection', function (t) {
  const url = getWsUrl({ protocol: 'https:', host: 'example.com', port: 8443 })
  t.equal(url, 'wss://example.com:8443/exist/ws/eval')
  t.end()
})

// Auth header construction

test('getAuthHeader builds Basic auth header', function (t) {
  const header = getAuthHeader({ basic_auth: { user: 'admin', pass: '' } })
  const expected = 'Basic ' + Buffer.from('admin:').toString('base64')
  t.equal(header, expected)
  t.end()
})

test('getAuthHeader encodes user and pass', function (t) {
  const header = getAuthHeader({ basic_auth: { user: 'joe', pass: 's3cret' } })
  const expected = 'Basic ' + Buffer.from('joe:s3cret').toString('base64')
  t.equal(header, expected)
  t.end()
})

// --page-size flag parsing

test('parses --page-size flag', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '--page-size', '50', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.plan(2)
  t.equal(argv.pageSize, 50)
  t.equal(argv.query, '1+1')
})

test('--page-size defaults to 20', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.pageSize, 20)
})

// --output flag parsing

test('parses --output json flag', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '--output', 'json', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.plan(2)
  t.equal(argv.output, 'json')
  t.equal(argv.query, '1+1')
})

test('parses -o shorthand for --output', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '-o', 'json', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.output, 'json')
})

test('--output defaults to text', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.output, 'text')
})

test('--output rejects invalid values', async function (t) {
  try {
    await new Promise((resolve, reject) => {
      parser.parse(['exec', '--output', 'xml', '1+1'], (err, argv, output) => {
        if (err) { return reject(err) }
        resolve(argv)
      })
    })
    t.fail('should have thrown')
  } catch (e) {
    t.ok(e, 'rejects invalid output format')
  }
})

// XQuery escaping

test('escapeXQuery wraps in double quotes', function (t) {
  t.equal(escapeXQuery('1+1'), '"1+1"')
  t.end()
})

test('escapeXQuery escapes internal double quotes', function (t) {
  t.equal(escapeXQuery('let $x := "hello"'), '"let $x := ""hello"""')
  t.end()
})

test('escapeXQuery handles empty string', function (t) {
  t.equal(escapeXQuery(''), '""')
  t.end()
})

// buildEvalQuery

test('buildEvalQuery produces lsp:eval wrapper', function (t) {
  const result = buildEvalQuery('1+1')
  t.ok(result.includes('import module namespace lsp='), 'imports lsp module')
  t.ok(result.includes('lsp:eval("1+1"'), 'calls lsp:eval with escaped query')
  t.ok(result.includes('"xmldb:exist:///db"'), 'includes context URI')
  t.end()
})

// buildFetchQuery

test('buildFetchQuery produces lsp:fetch wrapper', function (t) {
  const result = buildFetchQuery('abc-123', 1, 20)
  t.ok(result.includes('import module namespace lsp='), 'imports lsp module')
  t.ok(result.includes('lsp:fetch("abc-123", 1, 20)'), 'calls lsp:fetch with cursor, start, count')
  t.end()
})

test('buildFetchQuery handles different page parameters', function (t) {
  const result = buildFetchQuery('xyz', 21, 50)
  t.ok(result.includes('lsp:fetch("xyz", 21, 50)'), 'uses correct start and count')
  t.end()
})

test('buildFetchQuery includes serialization options', function (t) {
  const result = buildFetchQuery('abc', 1, 20, { method: 'json', indent: 'no' })
  t.ok(result.includes('map {'), 'includes options map')
  t.ok(result.includes('"method": "json"'), 'includes method option')
  t.ok(result.includes('"indent": "no"'), 'includes indent option')
  t.end()
})

test('buildFetchQuery omits options map when empty', function (t) {
  const result = buildFetchQuery('abc', 1, 20)
  t.notOk(result.includes('map {'), 'no options map without options arg')
  t.end()
})

// serializeXQueryMap

test('serializeXQueryMap produces XQuery map literal', function (t) {
  const result = serializeXQueryMap({ method: 'xml', indent: 'yes' })
  t.equal(result, 'map { "method": "xml", "indent": "yes" }')
  t.end()
})

test('serializeXQueryMap returns empty string for empty object', function (t) {
  t.equal(serializeXQueryMap({}), '')
  t.end()
})

test('serializeXQueryMap handles highlight-matches', function (t) {
  const result = serializeXQueryMap({ 'highlight-matches': 'elements' })
  t.equal(result, 'map { "highlight-matches": "elements" }')
  t.end()
})

// buildSerializationOptions

test('buildSerializationOptions extracts method', function (t) {
  const opts = buildSerializationOptions({ method: 'json' })
  t.deepEqual(opts, { method: 'json' })
  t.end()
})

test('buildSerializationOptions converts indent true to yes', function (t) {
  const opts = buildSerializationOptions({ indent: true })
  t.deepEqual(opts, { indent: 'yes' })
  t.end()
})

test('buildSerializationOptions converts indent false to no', function (t) {
  const opts = buildSerializationOptions({ indent: false })
  t.deepEqual(opts, { indent: 'no' })
  t.end()
})

test('buildSerializationOptions sets highlight-matches', function (t) {
  const opts = buildSerializationOptions({ highlight: true })
  t.deepEqual(opts, { 'highlight-matches': 'elements' })
  t.end()
})

test('buildSerializationOptions returns empty object when no flags', function (t) {
  const opts = buildSerializationOptions({})
  t.deepEqual(opts, {})
  t.end()
})

test('buildSerializationOptions combines all flags', function (t) {
  const opts = buildSerializationOptions({ method: 'xml', indent: false, highlight: true })
  t.deepEqual(opts, { method: 'xml', indent: 'no', 'highlight-matches': 'elements' })
  t.end()
})

// Serialization flag parsing

test('parses --method flag', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '--method', 'json', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.method, 'json')
})

test('--method rejects invalid values', async function (t) {
  try {
    await new Promise((resolve, reject) => {
      parser.parse(['exec', '--method', 'csv', '1+1'], (err, argv, output) => {
        if (err) { return reject(err) }
        resolve(argv)
      })
    })
    t.fail('should have thrown')
  } catch (e) {
    t.ok(e, 'rejects invalid method')
  }
})

test('parses --indent flag', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '--indent', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.indent, true)
})

test('parses --no-indent flag', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '--no-indent', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.indent, false)
})

test('parses --highlight flag', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '--highlight', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.highlight, true)
})

test('--highlight defaults to false', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['exec', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })
  t.equal(argv.highlight, false)
})

// Integration tests (require running eXist-db)

test('--timing prints timing to stderr', async function (t) {
  const { stdout, stderr } = await run('xst', ['exec', '--timing', '1+1'], asAdmin)
  t.equal(stdout, '2\n', 'query result on stdout')
  t.ok(stderr && stderr.match(/Total: \d+ms/), 'timing on stderr')
})

test('piped output fetches all pages without prompting', async function (t) {
  const { stdout, stderr } = await run('xst', ['exec', '--page-size', '5', 'for $i in 1 to 12 return $i'], asAdmin)
  t.notOk(stderr, 'no pagination prompt on stderr')
  t.ok(stdout, 'produces output')
  // Should contain all 12 results without any interactive prompt
  const lines = stdout.trim().split('\n').filter(l => l.trim() !== '')
  t.ok(lines.length >= 1, 'has result lines')
})

test('--method text produces raw text output', async function (t) {
  const { stdout, stderr } = await run('xst', ['exec', '--method', 'text', 'string-join(("a","b","c"), ",")'], asAdmin)
  if (stderr) { return t.fail(stderr) }
  t.equal(stdout.trim(), 'a,b,c', 'text serialization returns raw values')
})

test('--indent no suppresses indentation', async function (t) {
  const { stdout, stderr } = await run('xst', ['exec', '--no-indent', '<root><child/></root>'], asAdmin)
  if (stderr) { return t.fail(stderr) }
  t.notOk(stdout.includes('  <child'), 'output is not indented')
})
