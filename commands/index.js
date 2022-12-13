import * as exec from './exec.js'
import * as pkg from './package/index.js'
import * as list from './list.js'
import * as upload from './upload.js'
import * as rm from './rm.js'
import * as get from './get.js'

export const commands = [
  exec,
  pkg,
  list,
  upload,
  rm,
  get
]
