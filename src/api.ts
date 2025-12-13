export type ResourceType = 'httpPing' | 'ping'

export type ResourceConfig = {
    name: string
    /**
     * Ping period, ms
     */
    period: number
    /**
     * Request timeout, ms
     */
    timeout?: number
} & (
    | {
          type: 'httpPing'
          url: string
      }
    | {
          type: 'ping'
          ip: string
      }
)

export type Resource = {
    config: ResourceConfig
    series: Status[]
}

export type Status = {
    /*
     * Unix epoch
     */
    timestamp: number
    latency?: number
    error?: string
} & (
    | {
          type: 'httpPing'
          code?: number
      }
    | {
          type: 'ping'
      }
)
