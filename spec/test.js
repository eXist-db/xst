import { spawn } from 'node:child_process'

/**
 * @typedef {Promise<{stderr?: string, stdout?: string, code: number}>} CommandResult
 */

/**
 * Run an shell command
 *
 * @param   {string}   cmd     - The command
 * @param   {string[]} args    - The arguments
 * @param   {Record<string, unknown>} [options] - Any options to the command, like environment variables
 * @returns {CommandResult} The result of running the command
 */
export async function run (cmd, args, options = cleanEnv) {
  return new Promise((resolve, reject) => {
    let stderr
    let stdout
    const proc = spawn(cmd, args, options)
    proc.stdout.on('data', (data) => {
      stdout ? (stdout += data.toString()) : (stdout = data.toString())
    })

    proc.stderr.on('data', (data) => {
      stderr ? (stderr += data.toString()) : (stderr = data.toString())
    })
    proc.on('error', (error) => {
      reject(error)
    })
    proc.on('close', (code) => {
      resolve({ stderr, stdout, code })
    })
  })
}

/**
 * run two shell commands piped together
 * [options.env] cmd1 <args1> | cmd2 <args2>

 * @param {string}   cmd1    the first command
 * @param {string[]} args1   arguments for the first command
 * @param {string}   cmd2    the command run after the pipe
 * @param {string[]} args2   arguments for the second command
 * @param   {Record<string, unknown>} [options] - Any options to the command, like environment variables
 * @returns {CommandResult} The result of the pipe
 */
export async function runPipe (cmd1, args1, cmd2, args2, options = cleanEnv) {
  return new Promise((resolve, reject) => {
    let stderr
    let stdout
    const proc1 = spawn(cmd1, args1, options)
    const proc2 = spawn(cmd2, args2, options)
    proc1.stdout.pipe(proc2.stdin)

    proc2.stdout.on('data', (data) => {
      stdout ? (stdout += data.toString()) : (stdout = data.toString())
    })

    proc2.stderr.on('data', (data) => {
      stderr ? (stderr += data.toString()) : (stderr = data.toString())
    })
    proc2.on('close', (_) => resolve({ stderr, stdout }))
    proc1.on('error', (error) => reject(error))
    proc2.on('error', (error) => reject(error))
  })
}

// guard test execution against environment variables in development setups
const { EXISTDB_PASS, EXISTDB_USER, EXISTDB_SERVER, ...filteredEnv } = process.env
export const cleanEnv = {
  env: filteredEnv
}
export const asGuest = {
  env: { ...filteredEnv, EXISTDB_USER: 'guest', EXISTDB_PASS: 'guest' }
}
export const asAdmin = {
  env: { ...filteredEnv, EXISTDB_USER: 'admin', EXISTDB_PASS: '' }
}
export function forceColorLevel (level) {
  return { env: { ...filteredEnv, FORCE_COLOR: level } }
}
