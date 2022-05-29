#!/usr/bin/env node

import yargs from 'yargs'
import { commands } from './commands/index.js'
import { handleError } from './utility/errors.js'
import { hideBin } from 'yargs/helpers'
import { readConnection } from './utility/connection.js'

const parser = yargs(hideBin(process.argv))
  .scriptName('xst')
  .middleware(readConnection)
  .command('$0', 'interact with an exist-db instance', () => {}, (argv) => {
    commands.map(a => console.log(a.command, a.describe))
  })
  .help()
  // .completion('completion', function (current, argv, completionFilter, done) {
  //   completionFilter()
  // })
  .command(commands)
  .demandCommand(1)
  .strict(true)
  .wrap(96)
  .fail(false)

async function run () {
  return await parser.parse()
}

run()
  .then(argv => {})
  .catch((error) => {
    handleError(error)
    parser.getHelp()
    process.exit(1)
  })
