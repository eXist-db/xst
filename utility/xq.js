import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const xqueryPath = '../modules'

export function readXquery (filename) {
  const fileUrl = new URL(join(xqueryPath, filename), import.meta.url)
  return readFileSync(fileUrl)
}
