import { spawn } from 'node:child_process'

export async function run (cmd, args, options) {
  return new Promise((resolve, reject) => {
    let stderr
    let stdout
    const proc = spawn(cmd, args, options)
    proc.stdout.on('data', data => {
      stdout ? stdout += data.toString() : stdout = data.toString()
    })

    proc.stderr.on('data', data => {
      stderr ? stderr += data.toString() : stderr = data.toString()
    })
    proc.on('close', _ => resolve({ stderr, stdout }))
    // ls.on('exit', code => reject(code))
    proc.on('error', error => reject(error))
  })
}

export async function runPipe (cmd1, args1, cmd2, args2, options) {
  return new Promise((resolve, reject) => {
    let stderr
    let stdout
    const proc1 = spawn(cmd1, args1, options)
    const proc2 = spawn(cmd2, args2, options)
    proc1.stdout.pipe(proc2.stdin)

    proc2.stdout.on('data', data => {
      stdout ? stdout += data.toString() : stdout = data.toString()
    })

    proc2.stderr.on('data', data => {
      stderr ? stderr += data.toString() : stderr = data.toString()
    })
    proc2.on('close', _ => resolve({ stderr, stdout }))
    proc1.on('error', error => reject(error))
    proc2.on('error', error => reject(error))
  })
}

export const asAdmin = { env: { ...process.env, EXISTDB_USER: 'admin', EXISTDB_PASS: '' } }
export function forceColorLevel (level) {
  return { env: { ...process.env, FORCE_COLOR: level } }
}
