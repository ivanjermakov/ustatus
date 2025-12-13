export type ResourceType = 'httpPing'

export type ResourceConfig = {
    name: string
} & {
    type: 'httpPing'
    url: string
    /**
     * Ping period, ms
     */
    period: number
    /**
     * Request timeout, ms
     */
    timeout?: number
}

export type Resource = {
    config: ResourceConfig
    series: Status[]
}

export type Status = {
    /*
     * Unix epoch
     */
    timestamp: number
} & {
    type: 'httpPing'
    code?: number
    latency?: number
    error?: string
}
