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
    if (config.type !== 'httpPing') throw Error()
    const start = performance.now()
    const timestamp = new Date().getTime()
    try {
        const response = await fetch(config.url)
        return {
            timestamp,
            type: config.type,
            code: response.status,
            latency: Math.floor(performance.now() - start)
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
