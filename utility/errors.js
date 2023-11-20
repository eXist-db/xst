const NETWORK_ERRORS = [
  'EPROTO',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EHOSTUNREACH'
]

export function isNetworkError (error) {
  return NETWORK_ERRORS.includes(error.code)
}

const FS_ERRORS = [
  'ENOENT',
  'EISDIR',
  'ENOTDIR',
  'EACCES',
  'EEXIST',
  'EPERM'
]

export function isFilesystemError (error) {
  return FS_ERRORS.includes(error.code)
}

const XPATH_EXCEPTION = 'org.exist.xquery.XPathException: '

export function isXMLRPCFault (error) {
  return Boolean(error.faultString)
}

const XMLRPC_FAULT = 'org.exist.xmlrpc.RpcConnection: '

export function isYargsError (error) {
  return error.name === 'YError'
}

export function formatErrorMessage (error) {
  if (isNetworkError(error)) {
    return `Could not connect to DB! Reason: ${error.code}`
  }
  if (isXMLRPCFault(error)) {
    const xpathExceptionStart = error.faultString.indexOf(XPATH_EXCEPTION)
    if (xpathExceptionStart > 0) {
      const trimmed = error.faultString.substring(xpathExceptionStart + XPATH_EXCEPTION.length)
      return `XPathException: ${trimmed}`
    }

    const isMethodError = error.faultString.startsWith('Failed to invoke method')
    if (isMethodError) {
      const xmlrpcConnectionErrorStart = error.faultString.indexOf(XMLRPC_FAULT)
      const trimmed = error.faultString.substring(xmlrpcConnectionErrorStart + XMLRPC_FAULT.length)
      return `Error: ${trimmed}`
    }

    return `Error executing your query ${error.faultString}`
  }
  if (isYargsError(error)) {
    return `Problem with a provided Argument:\n${error.message}`
  }
  return error.message
}

export function handleError (error) {
  if (isNetworkError(error)) {
    return console.error(`Could not connect to DB! Reason: ${error.code}`)
  }
  if (isXMLRPCFault(error)) {
    const startOfError = error.faultString.indexOf('org.exist.xquery.XPathException:')
    if (startOfError > 0) {
      // console.debug("XPATHEXCEPTION")
      const trimmed = error.faultString.substring(startOfError + 33)
      console.error(`XPathException:\n${trimmed}`)
      return
    }
    // console.debug("OTHER XMLRPC")
    console.error(`Error executing your query\n${error.faultString}`)
    return
  }
  if (isYargsError(error)) {
    // console.debug("YERROR")
    console.error(`Problem with a provided Argument:\n${error.message}`)
    return
  }
  // console.debug("OTHER", error)
  console.error(error.message)
}
