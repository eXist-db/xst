import * as local from './local.js'
import * as github from './github.js'
// import * as registry from './registry.js'

const commands = [
  local,
  github
  // registry
]

export const command = ['install <command>', 'i']
export const describe = 'Install XAR packages'
export async function handler (argv) {
  if (argv.help) {
    return 0
  }
}

const options = {
  registry: {
    describe: 'Where to resolve dependencies from, if they are not already installed',
    default: 'https://exist-db.org/exist/apps/public-repo/'
  }
}

export const builder = function (yargs) {
  return yargs
    .options(options)
    .command(commands)
    .recommendCommands()
}
