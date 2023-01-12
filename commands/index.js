import * as exec from './exec.js'
import * as get from './get.js'
import * as info from './info.js'
import * as list from './list.js'
import * as pkg from './package/index.js'
import * as rm from './rm.js'
import * as upload from './upload.js'

export const commands = [
  info,
  get,
  upload,
  rm,
  exec,
  list,
  pkg
]
