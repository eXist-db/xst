#!/usr/bin/env -S node --dns-result-order ipv4first

import yargs from 'yargs'
import { commands } from './commands/index.js'
import { handleError } from './utility/errors.js'
import { hideBin } from 'yargs/helpers'
import { readConnection } from './utility/connection.js'
import { configure } from './utility/configure.js'
import { ct } from './utility/console.js'

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
${ct('Install command completions for ZSH and BASH', 'FgWhite', 'Dim')}
  ${scriptName} completion`)
}

function showExamples (scriptName) {
  console.log(`
${ct('Examples:', 'FgWhite', 'Dim')}
  ${scriptName} run 'count(//p)'
  ${scriptName} ls --tree --depth 1 /db/apps
  ${scriptName} package install ./my-package.xar
`)
}

function showLogo () {
  console.log(ct(`
 ╲ ╱  ╓───  ──┰──
  ╳   ╰───╮   │
 ╱ ╲  ▂▁▁▁│   ┇
`, 'FgYellow', 'Bright'))
  console.log('A modern exist-db command line interface')
}

const parser = yargs(hideBin(process.argv))
  .config('config', 'Read configuration file', configure)
  .middleware(readConnection)
  .command('$0 [<command>]', 'Interact with an eXist-db', () => {}, async (argv) => {
    showLogo()
    const scriptName = getScriptName(argv.$0)
    showCompletionHelp(scriptName)
    // append examples
    showExamples(scriptName)
  })
  .help()
  .completion('completion', false)
  .command(commands)
  .demandCommand(1)
  // .recommendCommands()
  .strict(false)
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
