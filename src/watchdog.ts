import { spawn } from 'child_process'
import { format } from 'date-fns'
import { ResourceConfig, Status } from './api'
import { db, sql, write } from './db'
import { debug, error } from './log'

export const start = (configs: ResourceConfig[]) => {
    configs.forEach(config => {
        setInterval(async () => {
            try {
                const status = await check(config)
                await write(config, status)
                await notify(config)
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
                const { stderr, code } = await runCmd(['ping', '-c', '1', config.ip], config.timeout)
                const latency = Math.floor(performance.now() - start)
                if (code === 0) {
                    return {
                        timestamp,
                        type: config.type,
                        latency,
                        code
                    }
                } else {
                    return {
                        timestamp,
                        type: config.type,
                        latency,
                        code,
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

const notify = async (config: ResourceConfig): Promise<void> => {
    const url = process.env.NOTIFY_URL
    if (!url) return
    const notification = await computeNotification(config)
    if (!notification) return
    debug('notification', notification)
    await fetch(url, { method: 'POST', body: notification })
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

const computeNotification = async (config: ResourceConfig): Promise<string | undefined> => {
    if (config.quiet === true) return
    const statuses = (
        await db.all(
            sql`
            select status, timestamp from Status
            where name = ?
            order by timestamp desc
            limit 6
        `,
            config.name
        )
    ).toReversed()
    if (statuses.length !== 6) return
    const oks = statuses.map(s => ok(JSON.parse(s.status) as Status))
    const timestamp = Number.parseFloat(statuses[1].timestamp)
    if (oks[0] && !oks[1] && oks.slice(1).every(o => !o)) {
        // was up and now down
        return `\
ustatus: *${config.name}* is DOWN
\`\`\`
since ${format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss').replaceAll('-', '\\-')}
\`\`\`
`
    }
    if (!oks[0] && oks[1] && oks.slice(1).every(o => o)) {
        // was down and now up
        // TODO: report for how long it was down
        return `\
ustatus: *${config.name}* is UP
\`\`\`
since ${format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss').replaceAll('-', '\\-')}
\`\`\`
`
    }
    return
}

const ok = (status: Status): boolean => {
    switch (status.type) {
        case 'httpPing':
            return status.code !== undefined && status.code < 300
        case 'ping':
            return status.code === 0
    }
}
