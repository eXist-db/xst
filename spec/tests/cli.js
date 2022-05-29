import { test } from 'tape'
import yargs from 'yargs'

import { commands } from '../../commands/index.js'
import { run } from '../test.js'

const parser = yargs()
  .scriptName('xst')
  .command(commands)
  .completion('completion', function (current, argv) {
    return commands.map(a => a.command)
  })
  .demandCommand(1)

test('shows help', async function (t) {
  const output = await new Promise((resolve, reject) => {
    parser.parse(['xst', 'help'], (err, argv, output) => {
      if (err) { return reject(err) }
      resolve(output)
    })
  })
  const firstLine = output.split('\n')[0]
  t.equal(firstLine, 'xst <command>', firstLine)
})

test('calling xst with no arguments', async (t) => {
  const { stderr, stdout } = await run('xst')
  if (stderr) t.fail(stderr)
  t.ok(stdout)
  t.end()
})
