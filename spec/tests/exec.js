import { test } from 'tape'
import yargs from 'yargs'
import * as exec from '../../commands/exec.js'
import { getWsUrl, getAuthHeader } from '../../commands/exec.js'
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

// --timing integration (HTTP mode, no WebSocket needed)

test('--timing prints timing to stderr', async function (t) {
  const { stdout, stderr } = await run('xst', ['exec', '--timing', '1+1'], asAdmin)
  t.equal(stdout, '2\n', 'query result on stdout')
  t.ok(stderr && stderr.match(/Total: \d+ms/), 'timing on stderr')
})
