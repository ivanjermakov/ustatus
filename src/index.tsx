/* @refresh reload */

import { format, sub } from 'date-fns'
import { Component, For, Show, createEffect, createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import { Dashboard, Resource, Series, TimeFrame } from './api'
import './index.css'

const [resources, setResources] = createSignal<Resource[]>([])
const [dashboard, setDashboard] = createSignal<Dashboard[]>([])
const [timeFrame, setTimeFrame] = createSignal<TimeFrame>('1m')
const [hovered, setHovered] = createSignal<Series | undefined>()
const [mouse, setMouse] = createSignal<MouseEvent | undefined>()
let windowWidth = 640

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
        const since = sub(new Date(), { hours: 48 }).getTime()
        const res = await fetch(`/resources?since=${since}`)
        const resources_ = await res.json()
        setResources(resources_)

        document.addEventListener('mousemove', setMouse)
        windowWidth = window.innerWidth
    })

    createEffect(async () => {
        const resources_ = resources()
        const timeFrame_ = timeFrame()

        const dashboard = await Promise.all(
            resources_.map(
                async r =>
                    (await (
                        await fetch(`/dashboard?timeFrame=${timeFrame_}&name=${r.config.name}`)
                    ).json()) as Dashboard
            )
        )
        setDashboard(dashboard)
    })

    return (
        <>
            <header>
                <span>μstatus</span>
                <For each={['1m', '10m', '1h'] as const}>
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
                <For each={dashboard()}>
                    {d => (
                        <>
                            <span>{d.config.name}</span>
                            <div class="seriess">
                                <For each={d.series}>{series => <SeriesComponent series={series} />}</For>
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
                    <span>{format(new Date(hovered()!.from), 'yyyy-MM-dd HH:mm:ss')}</span>
                    <span>{hovered()!.statuses.length} stats</span>
                </div>
            </Show>
        </>
    )
}

render(() => <Main />, document.getElementById('root')!)
