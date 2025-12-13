import { Database, open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { Resource, ResourceConfig, Status } from './api'
import { groupBy } from './array'
import { debug } from './log'

const sql = String.raw

export let db: Database

export const initDb = async (): Promise<Database> => {
    const db_ = await open({ filename: 'database.db', driver: sqlite3.Database })
    db = new Proxy(db_, {
        get: (target, key) => {
            const ret = (<any>target)[key]
            if (typeof ret !== 'function') return ret

            const start = performance.now()
            return (...args: any[]) => {
                const queryMethods = ['run', 'exec', 'all']
                if (queryMethods.includes(<string>key)) {
                    debug('query', args[0], 'with args', args.slice(1))
                }
                const result = Reflect.apply(ret, db_, args)
                if (queryMethods.includes(<string>key)) {
                    const end = performance.now()
                    debug(`query took ${(end - start).toFixed(2)}ms`)
                }
                return result
            }
        }
    })
    db.on('close', () => debug('db close'))
    await db.exec(sql`pragma journal_mode = WAL`)

    await db.run(sql`create table if not exists Status (
        name        TEXT     NOT NULL,
        timestamp   TEXT     NOT NULL,
        config      TEXT     NOT NULL,
        status      TEXT     NOT NULL
    )`)

    debug('initialized')
    return db
}

export const getResources = async (configs: ResourceConfig[]): Promise<Resource[]> => {
    const raw = await db.all(sql`select * from Status`)
    const resources = groupBy(raw, r => r.name)
    return Object.entries(resources).map(([name, ss]) => ({
        config: configs.find(c => c.name === name)!,
        series: ss.map(s => JSON.parse(s.status))
    }))
}

export const write = async (config: ResourceConfig, status: Status): Promise<void> => {
    await db.run(
        sql`insert into Status (name, timestamp, config, status) values (?, ?, ?, ?)`,
        config.name,
        status.timestamp,
        JSON.stringify(config),
        JSON.stringify(status)
    )
}
