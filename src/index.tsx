/* @refresh reload */
import { Component, For, createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import { Resource } from './api'
import './index.css'

const Main: Component = () => {
    const [resources, setResources] = createSignal<Resource[]>([])

    onMount(async () => {
        const res = await fetch('/resources')
        const resources_ = await res.json()
        setResources(resources_)
    })

    return <For each={resources()}>{resource => <pre>{JSON.stringify(resource)}</pre>}</For>
}

render(() => <Main />, document.getElementById('root')!)
