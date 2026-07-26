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
    /**
     * Whether to send notification when resource goes down/up
     */
    quiet?: boolean
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
          code?: number
      }
)

export type TimeFrame = '1m' | '10m' | '1h'

export type Dashboard = {
    config: ResourceConfig
    series: Series[]
}

export type Series = {
    from: number
    to: number
    statuses: Status[]
}
