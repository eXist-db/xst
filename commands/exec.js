import { getXmlRpcClient, getRestClient } from '@existdb/node-exist'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
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
 * Escape a query string for embedding as an XQuery string literal.
 * Uses XQuery's double-quote escaping: " becomes ""
 * @param {string} query the query to escape
 * @returns {string} escaped query wrapped in double quotes
 */
export function escapeXQuery (query) {
  return '"' + query.replace(/"/g, '""') + '"'
}

/**
 * Build XQuery to evaluate a query and return a cursor
 * @param {string} query the user's query
 * @returns {string} wrapper XQuery calling lsp:eval
 */
export function buildEvalQuery (query) {
  return 'import module namespace lsp="http://exist-db.org/xquery/lsp";\n' +
    'lsp:eval(' + escapeXQuery(query) + ', "xmldb:exist:///db")'
}

/**
 * Build XQuery to fetch a page of results from a cursor
 * @param {string} cursorId the cursor identifier
 * @param {number} start 1-based start index
 * @param {number} count number of items to fetch
 * @returns {string} wrapper XQuery calling lsp:fetch
 */
export function buildFetchQuery (cursorId, start, count) {
  return 'import module namespace lsp="http://exist-db.org/xquery/lsp";\n' +
    'lsp:fetch("' + cursorId + '", ' + start + ', ' + count + ')'
}

/**
 * Prompt the user for input on stderr
 * @param {string} message the prompt message
 * @returns {Promise<string>} the user's answer
 */
function promptUser (message) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr
    })
    rl.question(message + ' ', (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

/**
 * Execute query via cursor-based pagination using REST API
 *
 * @param {object} connectionOptions
 * @param {string} query the query to execute
 * @param {number} pageSize number of results per page
 * @param {string} outputFormat output format ('text' or 'json')
 * @param {boolean} showTiming whether to show timing info
 * @returns {Promise<Number>} exit code
 */
async function executeCursor (connectionOptions, query, pageSize, outputFormat, showTiming) {
  const restClient = getRestClient(connectionOptions)

  // Evaluate query and obtain cursor
  const evalResult = await restClient.get('exist/rest/db', {
    _query: buildEvalQuery(query),
    _wrap: 'no'
  })
  const cursor = JSON.parse(evalResult.bodyText)
  const totalHits = cursor.hits ?? cursor.summary?.hits ?? 0

  if (showTiming && cursor.timing) {
    const t = cursor.timing
    const parts = []
    if (t.parse != null) parts.push('Parse: ' + t.parse + 'ms')
    if (t.compile != null) parts.push('Compile: ' + t.compile + 'ms')
    if (t.evaluate != null) parts.push('Eval: ' + t.evaluate + 'ms')
    if (t.total != null) parts.push('Total: ' + t.total + 'ms')
    if (parts.length) console.error(parts.join(' | '))
  }

  if (totalHits === 0) {
    if (outputFormat === 'json') {
      console.log('[]')
    }
    return 0
  }

  const totalPages = Math.ceil(totalHits / pageSize)
  const isTTY = process.stdout.isTTY
  const jsonResults = outputFormat === 'json' ? [] : null

  let page = 1
  while (page <= totalPages) {
    const start = (page - 1) * pageSize + 1
    const fetchResult = await restClient.get('exist/rest/db', {
      _query: buildFetchQuery(cursor.cursor, start, pageSize),
      _wrap: 'no'
    })

    if (jsonResults) {
      // Collect results for JSON output
      try {
        const parsed = JSON.parse(fetchResult.bodyText)
        if (Array.isArray(parsed)) {
          jsonResults.push(...parsed)
        } else {
          jsonResults.push(parsed)
        }
      } catch {
        // If not parseable as JSON, store as string
        jsonResults.push(fetchResult.bodyText.trim())
      }
    } else {
      process.stdout.write(fetchResult.bodyText)
      if (!fetchResult.bodyText.endsWith('\n')) {
        process.stdout.write('\n')
      }
    }

    if (page >= totalPages) break

    if (!isTTY || jsonResults) {
      // When piped or collecting JSON, fetch all pages without prompting
      page++
      continue
    }

    const answer = await promptUser(
      '[Page ' + page + ' of ' + totalPages + '. Press Enter for next page, q to quit]'
    )
    if (answer.toLowerCase() === 'q') break
    page++
  }

  if (jsonResults) {
    console.log(JSON.stringify(jsonResults, null, 2))
  }

  return 0
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
    .option('page-size', {
      type: 'number',
      describe: 'Number of results per page (cursor mode)',
      default: 20
    })
    .option('o', {
      alias: 'output',
      type: 'string',
      describe: 'Output format (text, json)',
      choices: ['text', 'json'],
      default: 'text'
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
  const { file, bind, query, stream, timing, pageSize, output, connectionOptions } = argv
  const _query = getQuery(file, query)

  if (stream) {
    return await executeStream(connectionOptions, _query, timing)
  }

  const db = getXmlRpcClient(connectionOptions)

  // Use cursor-based pagination when no variables are bound
  const hasBindings = bind && Object.keys(bind).length > 0
  if (!hasBindings) {
    try {
      return await executeCursor(connectionOptions, _query, pageSize, output, timing)
    } catch {
      // Fall back to XML-RPC if cursor API is not available
      return await execute(db, _query, bind, timing)
    }
  }

  return await execute(db, _query, bind, timing)
}
