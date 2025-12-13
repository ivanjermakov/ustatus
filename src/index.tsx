/* @refresh reload */
import { Component, For, createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import { Resource, Status } from './api'
import './index.css'

type TimeFrame = '1m'

type Series = {
    from: number
    to: number
    statuses: Status[]
    totalMeasurements: number
    first: number
}

type SeriesProps = {
    series: Series
}
const SeriesComponent: Component<SeriesProps> = (props: SeriesProps) => {
    const uptimeRatio = props.series.statuses.length / props.series.totalMeasurements
    const beforeFirst = props.series.from < props.series.first
    return (
        <div
            class="series"
            classList={{
                ok: !beforeFirst && uptimeRatio === 1,
                degraded: !beforeFirst && uptimeRatio < 1 && uptimeRatio > 0,
                down: !beforeFirst && uptimeRatio === 0
            }}
        ></div>
    )
}

const Main: Component = () => {
    const [resources, setResources] = createSignal<Resource[]>([])
    const [timeFrame, setTimeFrame] = createSignal<TimeFrame>('1m')

    const resourcesView = () => {
        const resources_ = resources()
        const timeFrame_ = timeFrame()

        const view = resources_.map(r => resourceView(r, timeFrame_))
        return view
    }

    const resourceView = (res: Resource, tf: TimeFrame) => {
        const now = new Date().getTime()
        const step = 60 * 1000
        const series: Series[] = []
        const first = res.series[0].timestamp
        for (let t = now - 4 * 60 * 60 * 1000; t < now; t += step) {
            const from = t
            const to = t + step
            const statuses = res.series.filter(status => status.timestamp >= from && status.timestamp < to)
            series.push({
                from,
                to,
                statuses,
                totalMeasurements: Math.floor(step / res.config.period),
                first
            })
        }
        return {
            config: res.config,
            series
        }
    }

    onMount(async () => {
        const res = await fetch('/resources')
        const resources_ = await res.json()
        setResources(resources_)
    })

    return (
        <>
            <header>
                <span>μstatus</span>
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
        </>
    )
}

render(() => <Main />, document.getElementById('root')!)
