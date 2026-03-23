# XST API Documentation

This document describes how to use `@existdb/xst` programmatically in your Node.js applications.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Connection Configuration](#connection-configuration)
- [Command API Reference](#command-api-reference)
  - [Upload](#upload)
  - [Get (Download)](#get-download)
  - [List](#list)
  - [Execute (Run XQuery)](#execute-run-xquery)
  - [Remove](#remove)
  - [Edit](#edit)
  - [Info](#info)
  - [Package Management](#package-management)
- [Utility Functions](#utility-functions)
- [TypeScript Support](#typescript-support)
- [Examples](#examples)

## Installation

```bash
npm install @existdb/xst
```

**Requirements:** Node.js 18.19.0+ or 20.5.0+

## Quick Start

```javascript
import { connect } from '@existdb/node-exist'
import { handler as upload } from '@existdb/xst/commands/upload.js'

// Create a database connection
const db = connect({
  host: 'localhost',
  port: 8080,
  basic_auth: {
    user: 'admin',
    pass: 'admin'
  }
})

// Upload a directory
await upload({
  source: './local-directory',
  target: '/db/apps/myapp',
  verbose: true,
  connectionOptions: db.client.options
})
```

## Connection Configuration

XST uses [@existdb/node-exist](https://www.npmjs.com/package/@existdb/node-exist) for database connections. You can configure connections in several ways:

### 1. Programmatic Configuration

```javascript
import { connect } from '@existdb/node-exist'

const db = connect({
  host: 'localhost',
  port: 8080,
  protocol: 'http:',
  basic_auth: {
    user: 'admin',
    pass: 'admin'
  }
})
```

### 2. Environment Variables

```bash
export EXISTDB_SERVER=http://localhost:8080
export EXISTDB_USER=admin
export EXISTDB_PASS=admin
```

```javascript
import { connect, readOptionsFromEnv } from '@existdb/node-exist'

const db = connect(readOptionsFromEnv())
```

### 3. Configuration File

Create `.xstrc` or `.existdb.json`:

```json
{
  "servers": {
    "localhost": {
      "server": "http://localhost:8080",
      "user": "admin",
      "password": "admin"
    }
  }
}
```

```javascript
import { configure } from '@existdb/xst/utility/configure.js'
import { connect } from '@existdb/node-exist'

const config = configure('.xstrc')
const db = connect(config.connectionOptions)
```

### 4. Using Connection Utilities

```javascript
import { connect } from '@existdb/node-exist'
import { getUserInfo, getServerUrl, isDBAdmin } from '@existdb/xst/utility/connection.js'

const db = connect({
  host: 'localhost',
  port: 8080,
  basic_auth: { user: 'admin', pass: 'admin' }
})

// Get user information
const userInfo = await getUserInfo(db)
console.log('User:', userInfo.name)
console.log('Groups:', userInfo.groups)
console.log('Is Admin:', isDBAdmin(userInfo))

// Get server URL
console.log('Connected to:', getServerUrl(db))
```

## Command API Reference

All commands export a `handler` function that can be used programmatically. Each handler expects an `argv` object with the command options and `connectionOptions`.

### Upload

Upload files and directories to eXist-db.

```javascript
import { handler as upload } from '@existdb/xst/commands/upload.js'

await upload({
  source: './local-path',           // Local file or directory path
  target: '/db/apps/myapp',         // Target collection in database
  verbose: false,                   // Log each file uploaded
  dryRun: false,                    // Show what would be uploaded
  include: ['**'],                  // Include patterns (glob)
  exclude: [],                      // Exclude patterns (glob)
  threads: 4,                       // Max concurrent uploads
  mintime: 0,                       // Minimum time per upload (ms)
  applyXconf: false,                // Upload .xconf files to system collection
  dotFiles: false,                  // Include dot-files
  connectionOptions: {              // Connection options
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})
```

**Returns:** `Promise<ExitCode>` (0 = success, 1 = error, 2 = partial success, 9 = nothing matched)

**Example:**

```javascript
import { connect } from '@existdb/node-exist'
import { handler as upload } from '@existdb/xst/commands/upload.js'

const db = connect({
  host: 'localhost',
  port: 8080,
  basic_auth: { user: 'admin', pass: 'admin' }
})

const exitCode = await upload({
  source: './src',
  target: '/db/apps/myapp',
  exclude: ['node_modules/**', '*.test.js'],
  verbose: true,
  connectionOptions: db.client.options
})

if (exitCode === 0) {
  console.log('Upload successful!')
}
```

### Get (Download)

Download resources or collections from eXist-db.

```javascript
import { handler as get } from '@existdb/xst/commands/get.js'

await get({
  source: '/db/apps/myapp',         // Source path in database
  target: './local-path',           // Local target path
  verbose: false,                   // Log each file downloaded
  indent: false,                    // Indent XML output
  overwrite: false,                 // Overwrite existing files
  connectionOptions: {
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})
```

**Returns:** `Promise<ExitCode>` (0 = success, 1 = error)

**Example:**

```javascript
import { connect } from '@existdb/node-exist'
import { handler as get } from '@existdb/xst/commands/get.js'

const db = connect(readOptionsFromEnv())

await get({
  source: '/db/apps/myapp/data.xml',
  target: './backup/data.xml',
  indent: true,
  overwrite: true,
  verbose: true,
  connectionOptions: db.client.options
})
```

### List

List collection contents.

```javascript
import { handler as list } from '@existdb/xst/commands/list.js'

await list({
  collection: '/db/apps',           // Collection to list
  long: false,                      // Show detailed information
  tree: false,                      // Show tree structure
  color: false,                     // Colorize output
  depth: Infinity,                  // Maximum depth for tree
  glob: null,                       // Filter by glob pattern
  resources: false,                 // Show only resources
  collections: false,               // Show only collections
  debug: false,                     // Show debug information
  connectionOptions: {
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})
```

**Returns:** `Promise<ExitCode>` (0 = success, 1 = error)

**Example:**

```javascript
import { connect } from '@existdb/node-exist'
import { handler as list } from '@existdb/xst/commands/list.js'

const db = connect({
  host: 'localhost',
  port: 8080,
  basic_auth: { user: 'guest', pass: 'guest' }
})

// List all apps with details in tree format
await list({
  collection: '/db/apps',
  long: true,
  tree: true,
  color: true,
  depth: 2,
  connectionOptions: db.client.options
})
```

### Execute (Run XQuery)

Execute XQuery code.

```javascript
import { handler as exec } from '@existdb/xst/commands/exec.js'

await exec({
  query: 'count(//p)',              // XQuery string or file path
  raw: false,                       // Output raw XML
  output: null,                     // Write output to file
  connectionOptions: {
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})
```

**Returns:** `Promise<ExitCode>` (0 = success, 1 = error)

**Example:**

```javascript
import { connect } from '@existdb/node-exist'
import { handler as exec } from '@existdb/xst/commands/exec.js'

const db = connect(readOptionsFromEnv())

// Execute XQuery from string
await exec({
  query: `
    xquery version "3.1";
    for $doc in collection('/db/apps/myapp')//document
    return $doc/title
  `,
  raw: true,
  connectionOptions: db.client.options
})

// Execute XQuery from file
await exec({
  query: './queries/report.xq',
  output: './results.xml',
  connectionOptions: db.client.options
})
```

### Remove

Remove collections or resources.

```javascript
import { handler as rm } from '@existdb/xst/commands/rm.js'

await rm({
  paths: ['/db/test/file.xml'],    // Paths to remove
  verbose: false,                   // Log each removal
  debug: false,                     // Show debug information
  connectionOptions: {
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})
```

**Returns:** `Promise<ExitCode>` (0 = success, 1 = error)

**Example:**

```javascript
import { connect } from '@existdb/node-exist'
import { handler as rm } from '@existdb/xst/commands/rm.js'

const db = connect({
  host: 'localhost',
  port: 8080,
  basic_auth: { user: 'admin', pass: 'admin' }
})

// Remove multiple paths
await rm({
  paths: [
    '/db/test/temp.xml',
    '/db/test/old-collection'
  ],
  verbose: true,
  connectionOptions: db.client.options
})
```

### Edit

Edit a resource in a local editor.

```javascript
import { handler as edit } from '@existdb/xst/commands/edit.js'

await edit({
  resource: '/db/apps/myapp/config.xml',  // Resource to edit
  editor: 'vim',                          // Editor command (optional)
  connectionOptions: {
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})
```

**Returns:** `Promise<void>`

**Note:** This command downloads the resource, opens it in an editor, and re-uploads it after editing.

**Example:**

```javascript
import { connect } from '@existdb/node-exist'
import { handler as edit } from '@existdb/xst/commands/edit.js'

const db = connect(readOptionsFromEnv())

// Edit with default editor
await edit({
  resource: '/db/apps/myapp/controller.xql',
  connectionOptions: db.client.options
})

// Edit with specific editor
await edit({
  resource: '/db/apps/myapp/view.html',
  editor: 'code --wait',
  connectionOptions: db.client.options
})
```

### Info

Get system information.

```javascript
import { handler as info } from '@existdb/xst/commands/info.js'

await info({
  verbose: false,                   // Show detailed information
  debug: false,                     // Show debug information
  connectionOptions: {
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})
```

**Returns:** `Promise<ExitCode>` (0 = success, 1 = error)

**Example:**

```javascript
import { connect } from '@existdb/node-exist'
import { handler as info } from '@existdb/xst/commands/info.js'

const db = connect({
  host: 'localhost',
  port: 8080,
  basic_auth: { user: 'admin', pass: 'admin' }
})

await info({
  verbose: true,
  connectionOptions: db.client.options
})
```

### Package Management

Install, list, and uninstall XAR packages.

#### List Packages

```javascript
import { handler as listPackages } from '@existdb/xst/commands/package/list.js'

await listPackages({
  long: false,                      // Show detailed information
  connectionOptions: {
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})
```

#### Install Package

```javascript
import { handler as installFromRegistry } from '@existdb/xst/commands/package/install/registry.js'
import { handler as installFromGitHub } from '@existdb/xst/commands/package/install/github.js'
import { handler as installFromFile } from '@existdb/xst/commands/package/install/file.js'

// Install from public-repo
await installFromRegistry({
  packages: ['demo-apps'],
  force: false,
  connectionOptions: {
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})

// Install from GitHub release
await installFromGitHub({
  packages: ['eXist-db/documentation@latest'],
  force: false,
  connectionOptions: {
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})

// Install from local file
await installFromFile({
  packages: ['./mypackage.xar'],
  force: false,
  connectionOptions: {
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})
```

#### Uninstall Package

```javascript
import { handler as uninstall } from '@existdb/xst/commands/package/uninstall.js'

await uninstall({
  packages: ['demo-apps'],
  force: false,                     // Skip dependency check
  connectionOptions: {
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  }
})
```

## Utility Functions

XST provides several utility functions for common tasks.

### Connection Utilities

```javascript
import {
  readConnection,
  getUserInfo,
  getServerUrl,
  isDBAdmin
} from '@existdb/xst/utility/connection.js'

// Get user information
const userInfo = await getUserInfo(db)
// Returns: { name: string, groups: string[], ... }

// Get server URL
const url = getServerUrl(db)
// Returns: "http://localhost:8080"

// Check if user is admin
const isAdmin = isDBAdmin(userInfo)
// Returns: boolean
```

### Error Handling

```javascript
import {
  handleError,
  formatErrorMessage,
  isNetworkError,
  isFileSystemError,
  isXMLRPCError,
  isXPathError
} from '@existdb/xst/utility/errors.js'

try {
  // Your code here
} catch (error) {
  if (isNetworkError(error)) {
    console.error('Network error:', formatErrorMessage(error))
  } else if (isXPathError(error)) {
    console.error('XPath error:', formatErrorMessage(error))
  } else {
    handleError(error)  // Formats and logs the error
  }
}
```

### Message Utilities

```javascript
import { logSuccess, logFailure } from '@existdb/xst/utility/message.js'

logSuccess('File uploaded successfully')
logFailure('Upload failed: connection timeout')
```

### Size Formatting

```javascript
import { formatBytes } from '@existdb/xst/utility/size.js'

console.log(formatBytes(1024))      // "1 KB"
console.log(formatBytes(1048576))   // "1 MB"
```

### Version Utilities

```javascript
import { getVersion } from '@existdb/xst/utility/version.js'

const version = getVersion()
console.log('XST version:', version)
```

### Glob Utilities

```javascript
import { createGlobber } from '@existdb/xst/utility/glob.js'

const globber = createGlobber({
  include: ['**/*.xml'],
  exclude: ['test/**'],
  cwd: './data'
})

const files = await globber()
console.log('Matched files:', files)
```

## TypeScript Support

XST includes JSDoc type annotations. For TypeScript projects, you can use type definitions:

```typescript
import type { NodeExist } from '@existdb/node-exist'
import type { AccountInfo } from '@existdb/xst/utility/account.js'
import { getUserInfo } from '@existdb/xst/utility/connection.js'
import { connect } from '@existdb/node-exist'

const db: NodeExist = connect({
  host: 'localhost',
  port: 8080,
  basic_auth: { user: 'admin', pass: 'admin' }
})

const userInfo: AccountInfo = await getUserInfo(db)
```

## Examples

### Complete Upload Workflow

```javascript
import { connect } from '@existdb/node-exist'
import { handler as upload } from '@existdb/xst/commands/upload.js'
import { getUserInfo, isDBAdmin } from '@existdb/xst/utility/connection.js'
import { handleError } from '@existdb/xst/utility/errors.js'

async function deployApp() {
  try {
    // Connect to database
    const db = connect({
      host: 'localhost',
      port: 8080,
      basic_auth: {
        user: process.env.EXISTDB_USER || 'admin',
        pass: process.env.EXISTDB_PASS || 'admin'
      }
    })

    // Verify user has admin privileges
    const userInfo = await getUserInfo(db)
    if (!isDBAdmin(userInfo)) {
      throw new Error('Admin privileges required')
    }

    // Upload application
    const exitCode = await upload({
      source: './build',
      target: '/db/apps/myapp',
      exclude: ['node_modules/**', '.git/**', '*.log'],
      applyXconf: true,
      verbose: true,
      threads: 8,
      connectionOptions: db.client.options
    })

    if (exitCode === 0) {
      console.log('Deployment successful!')
    } else {
      console.error('Deployment failed with code:', exitCode)
      process.exit(exitCode)
    }
  } catch (error) {
    handleError(error)
    process.exit(1)
  }
}

deployApp()
```

### Backup and Restore

```javascript
import { connect, readOptionsFromEnv } from '@existdb/node-exist'
import { handler as get } from '@existdb/xst/commands/get.js'
import { handler as upload } from '@existdb/xst/commands/upload.js'
import { existsSync, mkdirSync } from 'node:fs'

async function backup(collection, backupDir) {
  const db = connect(readOptionsFromEnv())

  // Create backup directory
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true })
  }

  // Download collection
  console.log(`Backing up ${collection}...`)
  await get({
    source: collection,
    target: backupDir,
    verbose: true,
    indent: true,
    connectionOptions: db.client.options
  })

  console.log('Backup complete!')
}

async function restore(backupDir, collection) {
  const db = connect(readOptionsFromEnv())

  console.log(`Restoring ${backupDir} to ${collection}...`)
  await upload({
    source: backupDir,
    target: collection,
    verbose: true,
    threads: 8,
    connectionOptions: db.client.options
  })

  console.log('Restore complete!')
}

// Usage
await backup('/db/apps/myapp', './backups/myapp-2025-12-26')
await restore('./backups/myapp-2025-12-26', '/db/apps/myapp-restored')
```

### Bulk Operations

```javascript
import { connect } from '@existdb/node-exist'
import { handler as exec } from '@existdb/xst/commands/exec.js'
import { handler as rm } from '@existdb/xst/commands/rm.js'

async function cleanupOldFiles() {
  const db = connect({
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  })

  // Find files older than 30 days
  const query = `
    xquery version "3.1";

    let $cutoff := current-dateTime() - xs:dayTimeDuration('P30D')
    for $doc in collection('/db/temp')//document
    where xmldb:last-modified(base-uri($doc)) lt $cutoff
    return base-uri($doc)
  `

  // Execute query and get list of files
  const result = await exec({
    query,
    raw: true,
    connectionOptions: db.client.options
  })

  // Parse results and remove files
  const files = result.split('\n').filter(f => f.trim())

  if (files.length > 0) {
    console.log(`Removing ${files.length} old files...`)
    await rm({
      paths: files,
      verbose: true,
      connectionOptions: db.client.options
    })
  } else {
    console.log('No old files to remove')
  }
}

cleanupOldFiles()
```

### Package Management Automation

```javascript
import { connect } from '@existdb/node-exist'
import { handler as listPackages } from '@existdb/xst/commands/package/list.js'
import { handler as installFromRegistry } from '@existdb/xst/commands/package/install/registry.js'
import { handler as uninstall } from '@existdb/xst/commands/package/uninstall.js'

async function setupDevEnvironment() {
  const db = connect({
    host: 'localhost',
    port: 8080,
    basic_auth: { user: 'admin', pass: 'admin' }
  })

  const options = { connectionOptions: db.client.options }

  // Install required packages
  const requiredPackages = [
    'shared-resources',
    'functx',
    'eXide'
  ]

  console.log('Installing required packages...')
  for (const pkg of requiredPackages) {
    await installFromRegistry({
      packages: [pkg],
      ...options
    })
  }

  // List all installed packages
  console.log('\nInstalled packages:')
  await listPackages({
    long: true,
    ...options
  })
}

setupDevEnvironment()
```

## Best Practices

1. **Error Handling**: Always wrap operations in try-catch blocks and use the error utilities provided.

2. **Connection Management**: Reuse database connections when performing multiple operations.

3. **Environment Variables**: Use environment variables for sensitive credentials instead of hardcoding them.

4. **Verbose Logging**: Enable verbose mode during development, disable in production.

5. **Throttling**: Use the `threads` and `mintime` options for upload to avoid overwhelming the server.

6. **Dry Run**: Use `dryRun: true` to preview operations before executing them.

7. **Type Safety**: Use JSDoc comments or TypeScript for better type checking.

## Further Reading

- [eXist-db Documentation](https://exist-db.org/exist/apps/doc/)
- [@existdb/node-exist API](https://www.npmjs.com/package/@existdb/node-exist)
- [XST CLI Documentation](./README.md)
