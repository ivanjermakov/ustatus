/* @refresh reload */
import { Component, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import './index.css'

const Main: Component = () => {

    onMount(async () => {
        const res = await fetch('/stats')
        const stats = await res.json()
        console.log(stats)
    })

    return <h1>μstatus</h1>
}

render(() => <Main />, document.getElementById('root')!)
