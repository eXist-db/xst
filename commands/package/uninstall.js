import chalk from 'chalk'
import { getXmlRpcClient } from '@existdb/node-exist'
import { readXquery } from '../../utility/xq.js'

const query = readXquery('uninstall.xq')

async function getUserInfo (db) {
  const { user } = db.connection
  return await db.users.getUserInfo(user)
}

async function uninstall (nameOrAbbrev, db, options) {
  const { force, raw } = options
  const { pages } = await db.queries.readAll(query, { variables: { 'name-or-abbrev': nameOrAbbrev, force } })
  const rawResult = pages.toString()
  const result = JSON.parse(rawResult)
  if (result.error && !result.error.code.startsWith('local:')) {
    throw new Error(result.error.description)
  }
  // success = no local error from the XQuery wrapper AND the underlying
  // repo:remove call actually returned true. The previous version of this
  // line was `const success = Boolean(result.error)`, which (a) reads
  // inverted relative to its name (the value is true when error exists)
  // and (b) didn't consider result.remove at all -- so when repo:remove
  // silently returned false (the eXist-side behavior where
  // RemoveFunction.eval swallows the underlying PackageException and
  // returns boolean false), xst still printed "✔︎ uninstalled" while the
  // package remained installed. Both arms now have to be true for the
  // operation to count as a success, and the display logic below uses
  // this to pick the success vs error indicator. (Note: the handler's
  // aggregated return value at line 75 is not currently propagated to
  // the process exit code -- yargs's `parser.parse()` in cli.js doesn't
  // wire it up -- so this change is about the display, not exit code.
  // Exit-code propagation is out of scope for this PR.)
  const success = !result.error && result.remove === true
  if (raw) {
    console.log(rawResult)
    return success
  }
  if (result.error) {
    const errorIndicator = chalk.red('✘')
    const extra = result.error.value ? `: ${result.error.value.join(', ')}` : ''
    console.error(`${errorIndicator} ${result.error.description}${extra}`)
    return success
  }
  if (!success) {
    // repo:remove returned false. The underlying eXist exception was
    // swallowed by RemoveFunction.eval (eXist <= 7.0.0-beta3). Surface as
    // best we can.
    const errorIndicator = chalk.red('✘')
    console.error(`${errorIndicator} ${result.name}: repo:remove returned false (no diagnostic available — check the eXist server log for the underlying exception)`)
    return success
  }
  const successIndicator = chalk.green('✔︎')
  console.log(`${successIndicator} ${result.name} uninstalled`)
  return success
}

export const command = ['uninstall [options] <packages..>', 'remove']
export const describe = 'Uninstall packages'

const options = {
  f: {
    alias: 'force',
    describe: 'Force uninstall without dependency check',
    type: 'boolean',
    default: false
  },
  raw: {
    describe: 'Return raw JSON returned from server',
    type: 'boolean',
    default: false
  }
}

export const builder = yargs => yargs.options(options)

export async function handler (argv) {
  if (argv.help) {
    return 0
  }

  // check permissions (and therefore implicitly the connection)
  const db = getXmlRpcClient(argv.connectionOptions)
  const accountInfo = await getUserInfo(db)
  const isAdmin = accountInfo.groups.includes('dba')
  if (!isAdmin) {
    throw Error(`User "${accountInfo.name}" is not a member of the "dba" group.`)
  }

  // main
  const results = []
  for (const i in argv.packages) {
    const nameOrAbbrev = argv.packages[i]
    results.push(await uninstall(nameOrAbbrev, db, argv))
  }

  return (results.filter(r => !r).length ? 1 : 0)
}
