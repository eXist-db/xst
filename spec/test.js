import { spawn } from 'node:child_process'

export async function run (cmd, args, options) {
  return new Promise((resolve, reject) => {
    let stderr
    let stdout
    const ls = spawn(cmd, args, options)
    ls.stdout.on('data', data => {
      stdout ? stdout += data.toString() : stdout = data.toString()
    })

    ls.stderr.on('data', data => {
      stderr ? stderr += data.toString() : stderr = data.toString()
    })
    ls.on('close', _ => resolve({ stderr, stdout }))
    // ls.on('exit', code => reject(code))
    ls.on('error', error => reject(error))
  })
}
