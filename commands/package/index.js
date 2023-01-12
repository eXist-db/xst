import * as install from './install.js'
import * as list from './list.js'

const commands = [
  install,
  list
]

export const command = ['package <command>', 'pkg']
export const describe = 'Work with packages'
export async function handler (argv) {
  if (argv.help) {
    return 0
  }
}
export const builder = function (yargs) {
  return yargs.command(commands).recommendCommands()
}
