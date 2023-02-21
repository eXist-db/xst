import { resolve, basename } from 'node:path'
import {
  writeFileSync, readFileSync,
  watchFile, unwatchFile,
  statSync, unlinkSync
} from 'node:fs'
import * as readline from 'node:readline'

import chalk from 'chalk'
import { execa } from 'execa'
import { getEditor } from 'env-editor'
import { connect } from '@existdb/node-exist'

/**
 * @typedef { import("@existdb/node-exist").NodeExist } NodeExist
 */
/**
 * @typedef { import("env-editor").Editor } Editor
 */

/**
 *
 * @param {Editor} editor
 * @param {Array} args
 * @param {Function} cb
 * @returns {Promise}
 */
async function openEditor (editor, args, cb) {
  const stdio = editor.isTerminalEditor ? 'inherit' : 'ignore'
  const subprocess = execa(editor.binary, args, { detached: true, stdio })
  return new Promise((resolve, reject) => {
    subprocess.on('exit', async _ => resolve(await cb()))
    subprocess.on('error', error => reject(error))
  })
}

/**
 * query db, output to standard out
 *
 * @param {NodeExist} db NodeExist client
 * @param {string} resource db path
 * @param {Editor} editor identified editor
 * @returns {Number}
 */
async function edit (db, resource, editor) {
  try {
    const info = await db.resources.describe(resource)
    // console.log(info, editor)
    let fileContents
    if (info.type === 'BinaryResource') {
      console.log('read binary')
      fileContents = await db.documents.readBinary(resource)
    } else {
      // get XML with default serialization
      console.log('read XML')
      fileContents = await db.documents.read(resource, {})
    }
    const resourceName = basename(resource)
    const tempFile = resolve('./~xst-edit~' + resourceName)
    await writeFileSync(tempFile, fileContents)
    const init = await statSync(tempFile)

    // watch for changes while editor is running
    watchFile(tempFile, async (curr, prev) => {
      if (curr.mtime === prev.mtime) {
        return console.log('unchanged')
      }
      const newFileContents = readFileSync(tempFile)
      const fileHandle = await db.documents.upload(newFileContents)
      const uploadResult = await db.documents.parseLocal(fileHandle, resource, null)
      if (!editor.isTerminalEditor) {
        console.log('upload: ', uploadResult)
      }
    })

    let cb = () => {
      console.log(`Stop watching file with ${chalk.yellow('q')} or ${chalk.yellow('ctrl+c')}`)
      readline.emitKeypressEvents(process.stdin)
      if (process.stdin.isTTY) { process.stdin.setRawMode(true) }
      const abort = (resolve, reject) => {
        process.stdin.on('keypress', (ch, key) => {
          if (key && (key.name === 'q' || (key.ctrl && key.name === 'c'))) {
            unwatchFile(tempFile)
            unlinkSync(tempFile)
            process.stdin.pause()
            console.log('stopped watching, temporary file removed')
            resolve(0)
          }
        })
      }
      return new Promise(abort)
    }

    if (editor.isTerminalEditor) {
      cb = async () => {
        const curr = await statSync(tempFile)
        const unchanged = curr.mtime.getTime() === init.mtime.getTime()
        if (unchanged) {
          console.log('unchanged')
        } else {
          const newFileContents = readFileSync(tempFile)
          const fileHandle = await db.documents.upload(newFileContents)
          const uploadResult = await db.documents.parseLocal(fileHandle, resource, {})
          console.log('upload: ', uploadResult)
        }

        // unwatch because editor was closed
        unwatchFile(tempFile)
        unlinkSync(tempFile)
        console.log('stopped watching, temporary file removed')
      }
    }

    await openEditor(editor, [tempFile], cb)
    return 0
  } catch (e) {
    console.error(e)
    return 1
  }
}

function coerceEditor (id) {
  if (!id || id === '') {
    throw Error('No editor specified. Set with --editor or $EDITOR')
  }
  const editor = getEditor(id)
  if (!editor) {
    throw Error('No editor found with id', id)
  }
  console.log('opening resource with ', editor.id)
  return editor
}

export const command = ['edit <resource>']
export const describe = 'Edit a resource in an editor'

export function builder (yargs) {
  yargs
    .option('editor', {
      describe: 'The editor to open the resource with, defaults to $EDITOR',
      default: process.env.EDITOR,
      coerce: coerceEditor
    })
}

export async function handler (argv) {
  if (argv.help) {
    return 0
  }
  const { resource, connectionOptions, editor } = argv
  return await edit(connect(connectionOptions), resource, editor)
}
