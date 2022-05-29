const NETWORK_ERRORS = [
  'EPROTO',
  'ECONNREFUSED',
  'ECONNRESET'
]

function isNetworkError (error) {
  return NETWORK_ERRORS.includes(error.code)
}

function isXMLRPCFault (error) {
  return Boolean(error.faultString)
}

function isYargsError (error) {
  return error.name === 'YError'
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
