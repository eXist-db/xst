import { getXmlRpcClient } from '@existdb/node-exist'
import { readFileSync } from 'node:fs'
import WebSocket from 'ws'

/**
 * parse bindings
 * '-' will read bindings from standard input
 * @param {'-'|JSON} raw JSON string or '-'
 * @returns {object} parsed variable bindings
 */
function parseBindings (raw) {
  try {
    const readFromStdIn = raw === '-'
    const stringified = readFromStdIn ? readFileSync(process.stdin.fd) : raw
    if (stringified) {
      return JSON.parse(stringified)
    }
    return {}
  } catch (e) {
    if (e.code === 'EAGAIN') {
      throw Error('Could not read bind from standard input!')
    }
    throw Error('Error parsing argument bind! Reason: ' + e.message)
  }
}

/**
 * get query from file or passed string
 *
 * @param {string} file path to query file
 * @param {string} query query string
 * @returns {string|Buffer}
 */
function getQuery (file, query) {
  const hasQueryFile = file && file !== ''
  const hasQueryString = query && query !== ''

  if (!hasQueryFile && !hasQueryString) {
    throw Error('No query given, nothing to do!')
  }

  if (hasQueryFile && hasQueryString) {
    throw Error('Cannot use both query string and query file')
  }

  // read query from standard input
  if (query === true) {
    return readFileSync(process.stdin.fd, 'utf-8')
  }

  if (hasQueryString) {
    return query
  }

  // read query file content
  let path = file

  // from standard input
  if (file === '-') {
    path = readFileSync(process.stdin.fd, 'utf-8').trim()
  }

  return readFileSync(path, 'utf-8')
}

/**
 * Build WebSocket URL from connection options
 * @param {object} connectionOptions
 * @returns {string} WebSocket URL
 */
export function getWsUrl (connectionOptions) {
  const { host, port } = connectionOptions
  const wsProtocol = connectionOptions.protocol === 'https:' ? 'wss' : 'ws'
  return `${wsProtocol}://${host}:${port}/exist/ws/eval`
}

/**
 * Build auth header from connection options
 * @param {object} connectionOptions
 * @returns {string} Basic auth header value
 */
export function getAuthHeader (connectionOptions) {
  const { user, pass } = connectionOptions.basic_auth
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
}

/**
 * Execute query via HTTP, output to standard out
 *
 * @param {object} db bound NodeExist modules
 * @param {string|Buffer} query the query to execute
 * @param {object} variables the bound variables
 * @param {boolean} showTiming whether to show timing info
 * @returns {Promise<Number>} exit code
 */
async function execute (db, query, variables, showTiming) {
  const start = performance.now()
  const result = await db.queries.readAll(query, { variables })
  const total = performance.now() - start

  console.log(result.pages.toString())

  if (showTiming) {
    console.error(`Total: ${Math.round(total)}ms`)
  }

  return 0
}

/**
 * Execute query via WebSocket with streaming output
 *
 * @param {object} connectionOptions
 * @param {string} query the query to execute
 * @param {boolean} showTiming whether to show timing info
 * @returns {Promise<Number>} exit code
 */
function executeStream (connectionOptions, query, showTiming) {
  return new Promise((resolve, reject) => {
    const wsUrl = getWsUrl(connectionOptions)
    const ws = new WebSocket(wsUrl, {
      headers: { Authorization: getAuthHeader(connectionOptions) }
    })

    const requestId = crypto.randomUUID()
    let itemCount = 0
    const start = performance.now()

    function printTiming (timing) {
      if (!showTiming) return
      if (timing) {
        const parts = []
        if (timing.parse != null) parts.push(`Parse: ${timing.parse}ms`)
        if (timing.compile != null) parts.push(`Compile: ${timing.compile}ms`)
        if (timing.evaluate != null) parts.push(`Eval: ${timing.evaluate}ms`)
        if (timing.serialize != null) parts.push(`Serialize: ${timing.serialize}ms`)
        if (timing.total != null) parts.push(`Total: ${timing.total}ms`)
        console.error(parts.join(' | '))
      } else {
        console.error(`Total: ${Math.round(performance.now() - start)}ms`)
      }
    }

    function handleCancel () {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'cancel', id: requestId }))
      }
    }

    process.on('SIGINT', handleCancel)

    ws.on('open', () => {
      ws.send(JSON.stringify({ action: 'eval', id: requestId, query }))
    })

    ws.on('message', (data) => {
      let msg
      try {
        msg = JSON.parse(data.toString())
      } catch {
        process.stdout.write(data.toString())
        itemCount++
        return
      }

      if (msg.type === 'error') {
        console.error(msg.message)
        printTiming(msg.timing)
        ws.close()
        resolve(1)
        return
      }

      if (msg.type === 'cancelled') {
        const elapsed = ((performance.now() - start) / 1000).toFixed(1)
        const count = msg.items != null ? msg.items : itemCount
        console.error(`Cancelled after ${count.toLocaleString()} items (${elapsed}s)`)
        printTiming(msg.timing)
        ws.close()
        resolve(1)
        return
      }

      if (msg.type === 'result') {
        if (msg.data != null) {
          process.stdout.write(msg.data)
          if (!msg.data.endsWith('\n')) {
            process.stdout.write('\n')
          }
        }
        itemCount = msg.items != null ? msg.items : itemCount + 1
        if (!msg.more) {
          printTiming(msg.timing)
          ws.close()
          resolve(0)
        }
      }

      // ignore progress messages silently
    })

    ws.on('error', (err) => {
      process.removeListener('SIGINT', handleCancel)
      if (err.code === 'ECONNREFUSED') {
        reject(Error(`WebSocket connection refused at ${wsUrl}`))
      } else {
        reject(err)
      }
    })

    ws.on('close', () => {
      process.removeListener('SIGINT', handleCancel)
    })
  })
}

export const command = ['execute [<query>] [options]', 'run', 'exec']
export const describe = 'Execute a query string or file'

export async function builder (yargs) {
  yargs
    .option('f', {
      alias: 'file',
      type: 'string',
      describe: 'Read query File (pass - to read from standard input)'
    })
    .option('b', {
      alias: 'bind',
      type: 'string',
      describe: 'Bind variables (either as JSON string or - to read from standard input)',
      defaultDescription: '{}',
      coerce: parseBindings,
      default: () => {}
    })
    .option('s', {
      alias: 'stream',
      type: 'boolean',
      describe: 'Stream results via WebSocket as they arrive',
      default: false
    })
    .option('t', {
      alias: 'timing',
      type: 'boolean',
      describe: 'Show execution timing',
      default: false
    })
    .option('h', { alias: 'help', type: 'boolean' })
    .nargs({ f: 1, b: 1 })
    .conflicts('f', 'query')
    .normalize('f')
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }
  const { file, bind, query, stream, timing, connectionOptions } = argv
  const _query = getQuery(file, query)

  if (stream) {
    return await executeStream(connectionOptions, _query, timing)
  }

  const db = getXmlRpcClient(connectionOptions)
  return await execute(db, _query, bind, timing)
}
