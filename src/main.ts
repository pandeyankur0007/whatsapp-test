import './app.css'
import './lib/styles/animations.css'
import App from './App.svelte'
import { mount } from 'svelte'

mount(App, {
  target: document.getElementById('app')!,
})

