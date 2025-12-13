import { spawn } from 'child_process'
import { ResourceConfig, Status } from './api'
import { write } from './db'
import { debug, error } from './log'

export const start = (configs: ResourceConfig[]) => {
    configs.forEach(config => {
        setInterval(async () => {
            try {
                const status = await check(config)
                await write(config, status)
            } catch (e) {
                error('check error', config, e)
            }
        }, config.period)
    })
}

const check = async (config: ResourceConfig): Promise<Status> => {
    debug('check', config.name)
    const start = performance.now()
    const timestamp = new Date().getTime()
    try {
        switch (config.type) {
            case 'httpPing':
                const response = await fetch(config.url)
                return {
                    timestamp,
                    type: config.type,
                    code: response.status,
                    latency: Math.floor(performance.now() - start)
                }
            case 'ping':
                debug('ping')
                const { stderr, code } = await runCmd(['ping', '-c', '1', config.ip], config.timeout)
                debug(stderr, code)
                const latency = Math.floor(performance.now() - start)
                if (code === 0) {
                    return {
                        timestamp,
                        type: config.type,
                        latency
                    }
                } else {
                    return {
                        timestamp,
                        type: config.type,
                        latency,
                        error: stderr
                    }
                }
        }
    } catch (e) {
        return {
            timestamp,
            type: config.type,
            latency: Math.floor(performance.now() - start),
            error: JSON.stringify(e)
        }
    }
}

type RunCmdResult = {
    stdout: string
    stderr: string
    code: number
}
const runCmd = async (args: string[], timeout?: number) => {
    return new Promise<RunCmdResult>((resolve, reject) => {
        const child = spawn(args[0], args.slice(1), {
            stdio: ['ignore', 'pipe', 'pipe']
        })
        let timedOut = false
        const timeoutHandle = timeout
            ? setTimeout(() => {
                  timedOut = true
                  child.kill('SIGTERM')
                  setTimeout(() => child.kill('SIGKILL'), 2000)
              }, timeout)
            : undefined

        const stdoutBuf: Buffer[] = []
        const stderrBuf: Buffer[] = []
        child.stdout?.on('data', (chunk: Buffer) => stdoutBuf.push(chunk))
        child.stderr?.on('data', (chunk: Buffer) => stderrBuf.push(chunk))

        child.on('error', err => {
            if (timeoutHandle) clearTimeout(timeoutHandle)
            reject(err)
        })

        child.on('close', code => {
            if (timeoutHandle) clearTimeout(timeoutHandle)
            const stdout = Buffer.concat(stdoutBuf).toString()
            const stderr = Buffer.concat(stderrBuf).toString()
            if (timedOut) {
                resolve({ stdout, stderr, code: code ?? 1 })
            } else {
                resolve({ stdout, stderr, code: code ?? 1 })
            }
        })
    })
}
