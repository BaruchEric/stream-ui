import { type ActionEvent, type ComponentSpec, VERSION, append, render } from '../src/index'

const chatLog = document.getElementById('chat-log') as HTMLElement
const chatInput = document.getElementById('chat-input') as HTMLInputElement
const chatForm = document.getElementById('chat-form') as HTMLFormElement
const aiStream = document.getElementById('ai-stream') as HTMLElement
const uiStage = document.getElementById('ui-stage') as HTMLElement
const sendBtn = chatForm.querySelector('button[type="submit"]') as HTMLButtonElement

console.log(`[stream-ui] playground v${VERSION} ready`)

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function pushChat(who: 'human' | 'agent' | 'system', text: string): void {
  const el = document.createElement('div')
  el.className = `chat-msg chat-${who}`
  el.textContent = text
  chatLog.appendChild(el)
  chatLog.scrollTop = chatLog.scrollHeight
}

function pushAI(text: string, variant: 'thinking' | 'normal' | 'action' = 'normal'): void {
  const el = document.createElement('div')
  el.className = `ai-line ${variant === 'normal' ? '' : variant}`.trim()
  el.textContent = text
  aiStream.appendChild(el)
  aiStream.scrollTop = aiStream.scrollHeight
}

const onAction = (event: ActionEvent): void => {
  const payload = event.payload ? ` ${JSON.stringify(event.payload)}` : ''
  pushAI(`← UI action: ${event.action}${payload}`, 'action')
  pushChat('system', `[ui] ${event.action}${payload}`)
}

type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'render'; spec: ComponentSpec }
  | { type: 'append'; spec: ComponentSpec }

async function* mockAgent(prompt: string): AsyncGenerator<AgentEvent> {
  yield { type: 'thinking', text: 'Parsing prompt…' }
  await sleep(250)
  yield { type: 'thinking', text: `Heard: "${prompt}"` }
  await sleep(300)

  const lower = prompt.toLowerCase()
  const append_ = lower.includes('add') || lower.includes('append') || lower.includes('also')

  if (lower.includes('button')) {
    yield { type: 'thinking', text: 'Component → button' }
    await sleep(250)
    const spec: ComponentSpec = {
      kind: 'button',
      label: extractAfter(prompt, ['button']) || 'Click me',
      action: 'demo-click',
    }
    yield { type: append_ ? 'append' : 'render', spec }
  } else if (lower.includes('form')) {
    yield { type: 'thinking', text: 'Component → form (name + email)' }
    await sleep(250)
    const spec: ComponentSpec = {
      kind: 'form',
      submitLabel: 'Submit',
      fields: [
        { name: 'name', label: 'Name', type: 'text', placeholder: 'Your name' },
        { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
      ],
    }
    yield { type: append_ ? 'append' : 'render', spec }
  } else if (lower.includes('list')) {
    yield { type: 'thinking', text: 'Component → list' }
    await sleep(250)
    const spec: ComponentSpec = {
      kind: 'list',
      items: ['First item', 'Second item', 'Third item'],
    }
    yield { type: append_ ? 'append' : 'render', spec }
  } else if (lower.includes('card')) {
    yield { type: 'thinking', text: 'Component → card' }
    await sleep(250)
    const spec: ComponentSpec = {
      kind: 'card',
      title: extractAfter(prompt, ['card', 'titled', 'about']) || 'Generated card',
      body: 'This card was rendered by the agent in response to your prompt.',
    }
    yield { type: append_ ? 'append' : 'render', spec }
  } else if (lower.includes('clear') || lower.includes('reset')) {
    yield { type: 'thinking', text: 'Clearing UI region' }
    await sleep(150)
    yield { type: 'render', spec: { kind: 'text', content: '(cleared)' } }
  } else {
    yield { type: 'thinking', text: 'No component match — echoing as text' }
    await sleep(200)
    yield { type: append_ ? 'append' : 'render', spec: { kind: 'text', content: prompt } }
  }
}

function extractAfter(prompt: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    const idx = prompt.toLowerCase().indexOf(kw)
    if (idx >= 0) {
      const tail = prompt.slice(idx + kw.length).trim()
      if (tail.length > 0 && tail.length < 60) return tail.replace(/^[:\-—\s"']+|["'\s]+$/g, '')
    }
  }
  return null
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const prompt = chatInput.value.trim()
  if (!prompt) return
  pushChat('human', prompt)
  chatInput.value = ''
  chatInput.disabled = true
  sendBtn.disabled = true

  for await (const event of mockAgent(prompt)) {
    if (event.type === 'thinking') {
      pushAI(event.text, 'thinking')
    } else if (event.type === 'render') {
      pushAI(`→ render ${event.spec.kind}`)
      render(event.spec, uiStage, onAction)
    } else if (event.type === 'append') {
      pushAI(`→ append ${event.spec.kind}`)
      append(event.spec, uiStage, onAction)
    }
  }

  pushChat('agent', 'Done.')
  chatInput.disabled = false
  sendBtn.disabled = false
  chatInput.focus()
})

// Initial state
render(
  {
    kind: 'card',
    title: 'Welcome to stream-ui',
    body: 'Type a prompt in the CHAT pane. The AI pane shows the agent\'s reasoning. The UI pane shows the components the agent renders. Try: "make a button", "build a form", "show a list", "add a card".',
  },
  uiStage,
  onAction,
)
pushAI('Agent ready.')
pushChat('system', 'session started')
