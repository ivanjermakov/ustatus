import { createReadStream } from 'fs'
import { IncomingMessage, ServerResponse, createServer } from 'http'
import { extname, join, normalize } from 'path'
import { readFile, stat } from 'fs/promises'
import { exit } from 'process'
import { db, getResources, initDb } from './db'
import { debug, error, info, request } from './log'
import { start } from './watchdog'

const streamFile = (filePath: string, res: ServerResponse): void => {
    const ext = extname(filePath).toLowerCase()
    const ctype = contentType[ext] ?? contentType['.txt']
    res.setHeader('Content-Type', ctype)
    const stream = createReadStream(filePath)
    stream.on('error', () => {
        res.statusCode = 500
        res.end('Server error')
    })
    stream.pipe(res)
}

const contentType: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
}

const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    request(req)
    const host = req.headers.host ?? 'localhost'
    const rawUrl = `http://${host}${req.url ?? '/'}`
    const url = new URL(rawUrl)

    if (url.pathname === '/resources') {
        const resources = await getResources()
        res.write(JSON.stringify(resources))
        res.statusCode = 200
        res.end()
        return
    }

    if (await tryServeFile(url.pathname, res)) {
        return
    }

    if (url.pathname === '/' && await tryServeFile('/', res)) {
        return
    }

    res.statusCode = 404
    res.end()
}

const tryServeFile = async (url: string | undefined, res: ServerResponse): Promise<boolean> => {
    try {
        let urlPath = decodeURIComponent(url ?? '/')
        if (urlPath === '/') urlPath = '/index.html'
        const truePath = normalize(join(distPath, urlPath))
        if (!truePath.startsWith(normalize(`${distPath}/`))) return false

        const stats = await stat(truePath)
        if (stats.isFile()) {
            streamFile(truePath, res)
            return true
        }
    } catch (e) {}
    return false
}

let deinitizlized = false
const deinit = async (): Promise<void> => {
    if (deinitizlized) return
    deinitizlized = true
    debug('deinitializing')

    await new Promise<void>((resolve, reject) =>
        server.listening ? server.close(e => (e ? reject(e) : resolve())) : resolve()
    )
    await db.close()
    info('deinitialized')
    exit(0)
}

const distPath = process.env.USTATUS_DIST!
if (!distPath) {
    error('no dist path')
    exit(1)
}
process.on('SIGINT', deinit)
process.on('SIGTERM', deinit)

await initDb()

const server = createServer((req, res) => {
    handleRequest(req, res).catch(e => {
        error('request error', e)
        res.statusCode = 500
        res.end('Server error')
    })
})

const port = Number.parseInt(process.env.USTATUS_PORT ?? '3000', 10)
server.listen(port, () => {
    info(`server started :${port}`)
})

const configs = JSON.parse((await readFile('ustatus.json')).toString())
debug('using config', configs)
start(configs)
