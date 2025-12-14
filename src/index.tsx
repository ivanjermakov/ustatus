import { format } from 'date-fns'
/* @refresh reload */
import { Component, For, Show, createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import { Resource, Status } from './api'
import './index.css'

type TimeFrame = '1m' | '10m'

const [resources, setResources] = createSignal<Resource[]>([])
const [timeFrame, setTimeFrame] = createSignal<TimeFrame>('1m')
const [hovered, setHovered] = createSignal<Series | undefined>()
const [mouse, setMouse] = createSignal<MouseEvent | undefined>()
let windowWidth = 640

type Series = {
    from: number
    to: number
    statuses: Status[]
}

type SeriesProps = {
    series: Series
}
const SeriesComponent: Component<SeriesProps> = (props: SeriesProps) => {
    const scores = props.series.statuses.map(s => {
        switch (s.type) {
            case 'httpPing':
                if (s.code === undefined || s.code >= 300) return 0
                return Math.min(1, s.latency ? 1000 / s.latency : 0)
            case 'ping':
                if (s.error !== undefined) return 0
                return Math.min(1, s.latency ? 1000 / s.latency : 0)
        }
    })
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : undefined
    return (
        <div
            class="series"
            classList={{
                ok: avgScore === 1,
                degraded: avgScore !== undefined && avgScore < 1 && avgScore > 0,
                down: avgScore === 0
            }}
            onMouseEnter={() => setHovered(props.series)}
            onMouseLeave={() => setHovered(undefined)}
        />
    )
}

const Main: Component = () => {
    onMount(async () => {
        const res = await fetch('/resources')
        const resources_ = await res.json()
        setResources(resources_)

        document.addEventListener('mousemove', setMouse)
        windowWidth = window.innerWidth
    })

    const resourcesView = () => {
        const resources_ = resources()
        const timeFrame_ = timeFrame()

        const view = resources_.map(r => resourceView(r, timeFrame_))
        return view
    }

    const resourceView = (res: Resource, tf: TimeFrame) => {
        const { step, stepsTotal } = (() => {
            switch (tf) {
                case '1m':
                    return { step: 60 * 1000, stepsTotal: 240 }
                case '10m':
                    return { step: 10 * 60 * 1000, stepsTotal: 288 }
            }
        })()
        let now = new Date().getTime()
        now = Math.floor(now / 1000) * 1000
        const series: Series[] = []
        for (let t = now - stepsTotal * step; t < now; t += step) {
            const from = t
            const to = t + step
            const statuses = res.series.filter(status => status.timestamp >= from && status.timestamp < to)
            series.push({
                from,
                to,
                statuses
            })
        }
        return {
            config: res.config,
            series
        }
    }

    return (
        <>
            <header>
                <span>μstatus</span>
                <For each={['1m', '10m'] as const}>
                    {tf => (
                        <button
                            type="button"
                            classList={{ active: timeFrame() === tf }}
                            onClick={() => setTimeFrame(tf)}
                        >
                            {tf}
                        </button>
                    )}
                </For>
            </header>
            <div class="resources">
                <For each={resourcesView()}>
                    {view => (
                        <>
                            <span>{view.config.name}</span>
                            <div class="seriess">
                                <For each={view.series}>{series => <SeriesComponent series={series} />}</For>
                            </div>
                        </>
                    )}
                </For>
            </div>
            <Show when={hovered() && mouse()}>
                <div
                    class="hover"
                    style={{
                        left: `${mouse()!.clientX + (mouse()!.clientX < windowWidth / 2 ? 0 : -220)}px`,
                        top: `${mouse()!.clientY}px`
                    }}
                >
                    <span>{format(new Date(hovered()!.from), 'yyyy-MM-dd H:mm:ss')}</span>
                    <span>{hovered()!.statuses.length} stats</span>
                </div>
            </Show>
        </>
    )
}

render(() => <Main />, document.getElementById('root')!)
