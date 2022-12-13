import * as install from './install.js'

export const command = ['package <command>', 'pkg']
export const describe = 'do something with packages'
export async function handler (argv) {
  if (argv.help) {
    return 0
  }
}
export const builder = function (yargs) {
  return yargs.command([install]).recommendCommands()
}
