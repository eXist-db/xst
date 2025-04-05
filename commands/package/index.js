import * as install from './install/index.js'
import * as list from './list.js'
import * as uninstall from './uninstall.js'

const commands = [list, install, uninstall]

export const command = ['package <command>', 'pkg <command>']
export const describe = 'Work with packages'

export const builder = function (yargs) {
  return yargs.command(commands).recommendCommands()
}
