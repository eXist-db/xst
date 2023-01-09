import { connect } from '@existdb/node-exist'
import { readXquery } from '../../utility/xq.js'
import { ct } from '../../utility/console.js'

const query = readXquery('uninstall.xq')

async function getUserInfo (db) {
  const { user } = db.client.options.basic_auth
  return await db.users.getUserInfo(user)
}

async function uninstall (nameOrAbbrev, db, options) {
  const { force, raw, color } = options
  const { pages } = await db.queries.readAll(query, { variables: { 'name-or-abbrev': nameOrAbbrev, force } })
  const rawResult = pages.toString()
  const result = JSON.parse(rawResult)
  if (result.error && !result.error.code.startsWith('local:')) {
    throw new Error(result.error.description)
  }
  const success = Boolean(result.error)
  if (raw) {
    console.log(rawResult)
    return success
  }
  if (result.error) {
    const errorIndicator = color ? ct('✘', 'FgRed') : '✘'
    const extra = result.error.value ? `: ${result.error.value.join(', ')}` : ''
    console.error(`${errorIndicator} ${result.error.description}${extra}`)
    return success
  }
  const successIndicator = color ? ct('✔︎', 'FgGreen') : '✔︎'
  console.log(`${successIndicator} ${result.name} uninstalled`)
  return success
}

export const command = ['uninstall [options] <packages..>', 'remove']
export const describe = 'Uninstall packages'

const options = {
  G: {
    alias: 'color',
    describe: 'Color the output',
    default: false,
    type: 'boolean'
  },
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
  const db = connect(argv.connectionOptions)
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
