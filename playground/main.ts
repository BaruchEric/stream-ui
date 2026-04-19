import { VERSION } from '../src/index'

const app = document.getElementById('app') as HTMLElement
const startBtn = document.getElementById('start') as HTMLButtonElement

console.log(`[stream-ui] playground v${VERSION} ready`)

const mockStream = async function* (): AsyncGenerator<string> {
  const fragments = [
    'Thinking',
    '...',
    '\n\nHere is a streamed response from the agent:',
    '\n- First fragment',
    '\n- Second fragment',
    '\n- Final fragment',
  ]
  for (const f of fragments) {
    await new Promise((r) => setTimeout(r, 250))
    yield f
  }
}

startBtn.addEventListener('click', async () => {
  app.textContent = ''
  startBtn.disabled = true
  for await (const chunk of mockStream()) {
    app.textContent += chunk
  }
  startBtn.disabled = false
})

app.textContent = `stream-ui v${VERSION} ready. Click the button to mock an agent stream.`
