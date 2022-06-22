#!/usr/bin/env node

import yargs from 'yargs'
import { commands } from './commands/index.js'
import { handleError } from './utility/errors.js'
import { hideBin } from 'yargs/helpers'
import { readConnection } from './utility/connection.js'

/**
 * if package was linked to global strip relative path from output
 * @param {String} $0 raw value of argv.$0
 * @returns {String} script name with relative path stripped if linked
 */
function getScriptName ($0) {
  if ($0.startsWith('.')) {
    return $0.substring($0.lastIndexOf('/') + 1)
  }
  return $0
}

function showCompletionHelp (scriptName) {
  console.log(`
You can install completions for ZSH and BASH. For details have a look at the
comments in the output of

  ${scriptName} completion`)
}

function showExamples (scriptName) {
  console.log(`
Examples:
  ${scriptName} ls --extended /db/apps
  ${scriptName} install ./my-package.xar
  ${scriptName} run 'count(//p)'
`)
}

function showLogo () {
  console.log(`
 ╲ ╱  ╓───   ──┰──
  ╳   ╰───╮    │ 
 ╱ ╲  ▂▁▁▁│    ┇
`)
}

const parser = yargs(hideBin(process.argv))
  .middleware(readConnection)
  .command('$0', 'interact with an exist-db instance', () => {}, (argv) => {
    showLogo()
    parser.showHelp()
    const scriptName = getScriptName(argv.$0)
    showCompletionHelp(scriptName)
    // append examples
    showExamples(scriptName)
  })
  .help()
  .completion('completion', false)
  .command(commands)
  .demandCommand(1)
  .strict(true)
  .fail(false)

parser.wrap(parser.terminalWidth())

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
