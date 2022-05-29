import { test } from 'tape'
import yargs from 'yargs'
import * as install from '../../commands/install.js'
import { readConnection } from '../../utility/connection.js'
const parser = yargs().scriptName('xst').command(install).help().fail(false)

const execCmd = async (cmd, args) => {
  return await yargs()
    .middleware(readConnection)
    .scriptName('xst')
    .command(cmd)
    .fail(false)
    .parse(args)
}

const execCmdAsGuest = async (cmd, args) => {
  return await yargs()
    .scriptName('xst')
    .command(cmd)
    .fail(false)
    .parse(args)
}

test('shows help', async function (t) {
  // Run the command module with --help as argument
  const output = await new Promise((resolve, reject) => {
    parser.parse(['install', '--help'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(output)
    })
  })
  const firstLine = output.split('\n')[0]

  t.equal(firstLine, 'xst install <package>', firstLine)
})

test.skip('installs package', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['install', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })

  t.equal(argv.query, '1+1')
})

test.skip('installs package with alias \'i\'', async function (t) {
  const argv = await new Promise((resolve, reject) => {
    parser.parse(['i', '1+1'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(argv)
    })
  })

  t.equal(argv.query, '1+1')
})

test('error', async function (t) {
  try {
    const res = await execCmd(install, ['i', 'asdf'])
    t.notOk(res)
  } catch (e) {
    t.ok(e, e)
  }
})

test('error file not found', async function (t) {
  try {
    const res = await execCmd(install, ['i', 'asdf.xar'])
    t.fail(res)
  } catch (e) {
    t.ok(e, e)
  }
})

test('error install as guest', async function (t) {
  try {
    const res = await execCmdAsGuest(install, ['i', 'asdf.xar'])
    t.fail(res)
  } catch (e) {
    t.ok(e, e)
  }
})
