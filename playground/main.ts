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

function paletteSpecs(): ComponentSpec[] {
  return [
    { kind: 'heading', level: 2, content: 'Component palette' },
    { kind: 'paragraph', content: 'Every kind in stream-ui v0.2, rendered in sequence.' },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Feedback' },
    { kind: 'alert', variant: 'info', content: 'Info: this is an info alert.' },
    { kind: 'alert', variant: 'success', content: 'Success: operation complete.' },
    { kind: 'alert', variant: 'warning', content: 'Warning: heads up.' },
    { kind: 'alert', variant: 'error', content: 'Error: something failed.' },
    { kind: 'badge', content: 'New', variant: 'success' },
    { kind: 'spinner', label: 'Loading…' },
    { kind: 'progress', value: 65, label: 'Indexing' },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Container & data' },
    { kind: 'card', title: 'Card title', body: 'A card groups related content.' },
    { kind: 'list', items: ['First', 'Second', 'Third'] },
    { kind: 'list', items: ['Step one', 'Step two', 'Step three'], ordered: true },
    {
      kind: 'table',
      headers: ['Name', 'Role', 'City'],
      rows: [
        ['Alice', 'Engineer', 'NYC'],
        ['Bob', 'Designer', 'LA'],
        ['Carol', 'PM', 'SF'],
      ],
    },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Inputs' },
    {
      kind: 'input',
      name: 'search',
      label: 'Search',
      placeholder: 'Type to search…',
      action: 'search',
    },
    {
      kind: 'textarea',
      name: 'notes',
      label: 'Notes',
      placeholder: 'Write something',
      rows: 3,
      action: 'note',
    },
    {
      kind: 'select',
      name: 'city',
      label: 'City',
      options: [
        { value: 'nyc', label: 'New York' },
        { value: 'la', label: 'Los Angeles' },
        { value: 'sf', label: 'San Francisco' },
      ],
      action: 'pick-city',
    },
    { kind: 'checkbox', name: 'agree', label: 'I agree to the terms', action: 'toggle-agree' },
    {
      kind: 'form',
      submitLabel: 'Save',
      fields: [
        { name: 'name', label: 'Name', type: 'text', placeholder: 'Your name' },
        { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
      ],
    },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Actions' },
    { kind: 'button', label: 'Default', action: 'demo-default' },
    { kind: 'button', label: 'Primary', action: 'demo-primary', variant: 'primary' },
    { kind: 'button', label: 'Danger', action: 'demo-danger', variant: 'danger' },
    { kind: 'link', label: 'Open repo on GitHub', href: 'https://github.com/BaruchEric/stream-ui' },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Composition (nested)' },
    {
      kind: 'card',
      title: 'Card with children',
      children: [
        { kind: 'paragraph', content: 'Cards can hold any components, not just text.' },
        {
          kind: 'row',
          gap: 'sm',
          children: [
            { kind: 'badge', content: 'NEW', variant: 'success' },
            { kind: 'badge', content: 'beta', variant: 'warning' },
            { kind: 'badge', content: 'v0.3', variant: 'default' },
          ],
        },
        {
          kind: 'row',
          gap: 'sm',
          children: [
            { kind: 'button', label: 'Cancel', action: 'composite-cancel' },
            { kind: 'button', label: 'Save', action: 'composite-save', variant: 'primary' },
          ],
        },
      ],
    },
    {
      kind: 'stack',
      gap: 'sm',
      children: [
        { kind: 'heading', level: 5, content: 'Vertical stack' },
        { kind: 'alert', variant: 'info', content: 'Children stacked vertically with sm gap.' },
        { kind: 'progress', value: 80, label: 'Stack demo' },
      ],
    },
    {
      kind: 'grid',
      columns: 2,
      gap: 'sm',
      children: [
        { kind: 'card', title: 'Tile A', body: '2-col grid cell.' },
        { kind: 'card', title: 'Tile B', body: '2-col grid cell.' },
        { kind: 'card', title: 'Tile C', body: '2-col grid cell.' },
        { kind: 'card', title: 'Tile D', body: '2-col grid cell.' },
      ],
    },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Misc' },
    {
      kind: 'image',
      src: 'https://placehold.co/400x100/333/fff?text=stream-ui',
      alt: 'Placeholder',
    },
    { kind: 'code', content: "import { render } from 'stream-ui'", language: 'typescript' },
    { kind: 'text', content: 'Plain text content (no semantic wrapper).' },
  ]
}

function detectAlertVariant(prompt: string): 'info' | 'success' | 'warning' | 'error' {
  const l = prompt.toLowerCase()
  if (l.includes('error') || l.includes('fail')) return 'error'
  if (l.includes('success') || l.includes('done')) return 'success'
  if (l.includes('warning') || l.includes('warn')) return 'warning'
  return 'info'
}

function extractAfter(prompt: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    const idx = prompt.toLowerCase().indexOf(kw)
    if (idx >= 0) {
      const tail = prompt.slice(idx + kw.length).trim()
      const cleaned = tail.replace(/^(labeled|saying|titled|with|to|about|:)\s+/i, '')
      if (cleaned.length > 0 && cleaned.length < 80)
        return cleaned.replace(/^[:\-—\s"']+|["'\s]+$/g, '')
    }
  }
  return null
}

async function* mockAgent(prompt: string): AsyncGenerator<AgentEvent> {
  yield { type: 'thinking', text: 'Parsing prompt…' }
  await sleep(200)
  yield { type: 'thinking', text: `Heard: "${prompt}"` }
  await sleep(250)

  const lower = prompt.toLowerCase()
  const append_ = lower.includes('add') || lower.includes('append') || lower.includes('also')
  const op = (append_ ? 'append' : 'render') as 'append' | 'render'

  // Palette / show all
  if (
    lower.includes('palette') ||
    lower.includes('all components') ||
    lower.includes('show all') ||
    lower.includes('show everything') ||
    lower === 'demo' ||
    lower === 'everything'
  ) {
    const specs = paletteSpecs()
    yield { type: 'thinking', text: `Rendering palette: ${specs.length} components` }
    await sleep(200)
    yield { type: 'render', spec: specs[0] }
    for (let i = 1; i < specs.length; i++) {
      await sleep(60)
      yield { type: 'append', spec: specs[i] }
    }
    return
  }

  // Clear / reset
  if (lower.includes('clear') || lower.includes('reset')) {
    yield { type: 'thinking', text: 'Clearing UI region' }
    await sleep(120)
    yield { type: 'render', spec: { kind: 'text', content: '(cleared)' } }
    return
  }

  // Order matters: more specific keywords first
  if (lower.includes('textarea')) {
    yield { type: 'thinking', text: 'Component → textarea' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'textarea',
        name: 'demo',
        label: extractAfter(prompt, ['textarea']) || 'Notes',
        placeholder: 'Write something',
        rows: 4,
        action: 'demo-textarea',
      },
    }
  } else if (lower.includes('checkbox') || lower.includes('toggle')) {
    yield { type: 'thinking', text: 'Component → checkbox' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'checkbox',
        name: 'demo',
        label: extractAfter(prompt, ['checkbox', 'toggle']) || 'Enable demo',
        action: 'demo-checkbox',
      },
    }
  } else if (lower.includes('select') || lower.includes('dropdown')) {
    yield { type: 'thinking', text: 'Component → select' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'select',
        name: 'demo',
        label: extractAfter(prompt, ['select', 'dropdown']) || 'Pick one',
        options: [
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
          { value: 'c', label: 'Option C' },
        ],
        action: 'demo-select',
      },
    }
  } else if (lower.includes('text field') || lower.includes('textbox') || lower.includes('input')) {
    yield { type: 'thinking', text: 'Component → input' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'input',
        name: 'demo',
        label: extractAfter(prompt, ['input', 'textbox', 'text field']) || 'Demo input',
        placeholder: 'Type something',
        action: 'demo-input',
      },
    }
  } else if (lower.includes('form')) {
    yield { type: 'thinking', text: 'Component → form (name + email)' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'form',
        submitLabel: 'Submit',
        fields: [
          { name: 'name', label: 'Name', type: 'text', placeholder: 'Your name' },
          { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
        ],
      },
    }
  } else if (lower.includes('button')) {
    yield { type: 'thinking', text: 'Component → button' }
    await sleep(200)
    const variant = lower.includes('danger')
      ? 'danger'
      : lower.includes('primary')
        ? 'primary'
        : 'default'
    yield {
      type: op,
      spec: {
        kind: 'button',
        label: extractAfter(prompt, ['button']) || 'Click me',
        action: 'demo-click',
        variant,
      },
    }
  } else if (lower.includes('link')) {
    yield { type: 'thinking', text: 'Component → link' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'link',
        label: extractAfter(prompt, ['link']) || 'Open GitHub',
        href: 'https://github.com/BaruchEric/stream-ui',
      },
    }
  } else if (lower.includes('table')) {
    yield { type: 'thinking', text: 'Component → table' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'table',
        headers: ['Name', 'Value'],
        rows: [
          ['Alpha', '1'],
          ['Beta', '2'],
          ['Gamma', '3'],
        ],
      },
    }
  } else if (lower.includes('list')) {
    yield { type: 'thinking', text: 'Component → list' }
    await sleep(200)
    const ordered = lower.includes('numbered') || lower.includes('ordered') || lower.includes('1.')
    yield {
      type: op,
      spec: { kind: 'list', items: ['First item', 'Second item', 'Third item'], ordered },
    }
  } else if (lower.includes('card')) {
    yield { type: 'thinking', text: 'Component → card' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'card',
        title: extractAfter(prompt, ['card']) || 'Generated card',
        body: 'This card was rendered by the agent.',
      },
    }
  } else if (lower.includes('alert') || lower.includes('warning') || lower.includes('error')) {
    const variant = detectAlertVariant(prompt)
    yield { type: 'thinking', text: `Component → alert (${variant})` }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'alert',
        variant,
        content:
          extractAfter(prompt, ['alert', 'warning', 'error', 'message']) || `${variant} alert`,
      },
    }
  } else if (lower.includes('badge') || lower.includes('tag')) {
    yield { type: 'thinking', text: 'Component → badge' }
    await sleep(200)
    yield {
      type: op,
      spec: { kind: 'badge', content: extractAfter(prompt, ['badge', 'tag']) || 'New' },
    }
  } else if (lower.includes('spinner') || lower.includes('loading')) {
    yield { type: 'thinking', text: 'Component → spinner' }
    await sleep(200)
    yield { type: op, spec: { kind: 'spinner', label: 'Loading…' } }
  } else if (lower.includes('progress')) {
    yield { type: 'thinking', text: 'Component → progress (50%)' }
    await sleep(200)
    yield { type: op, spec: { kind: 'progress', value: 50, label: 'Working' } }
  } else if (lower.includes('image') || lower.includes('picture')) {
    yield { type: 'thinking', text: 'Component → image' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'image',
        src: 'https://placehold.co/400x200/444/fff?text=stream-ui',
        alt: 'Placeholder image',
      },
    }
  } else if (lower.includes('divider') || lower.includes('separator')) {
    yield { type: 'thinking', text: 'Component → divider' }
    await sleep(200)
    yield { type: op, spec: { kind: 'divider' } }
  } else if (lower.includes('code')) {
    yield { type: 'thinking', text: 'Component → code' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'code',
        content: extractAfter(prompt, ['code']) || "console.log('hi')",
        language: 'typescript',
      },
    }
  } else if (lower.includes('heading') || lower.includes('title')) {
    yield { type: 'thinking', text: 'Component → heading' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'heading',
        level: 2,
        content: extractAfter(prompt, ['heading', 'title']) || 'Heading',
      },
    }
  } else if (lower.includes('stack') || lower.includes('vertical')) {
    yield { type: 'thinking', text: 'Component → stack' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'stack',
        gap: 'sm',
        children: [
          { kind: 'heading', level: 4, content: 'Stacked' },
          { kind: 'paragraph', content: 'Vertical layout primitive.' },
          { kind: 'button', label: 'Action', action: 'stack-demo' },
        ],
      },
    }
  } else if (
    lower.includes('row') ||
    lower.includes('horizontal') ||
    lower.includes('side by side')
  ) {
    yield { type: 'thinking', text: 'Component → row' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'row',
        gap: 'sm',
        align: 'center',
        children: [
          { kind: 'badge', content: 'one' },
          { kind: 'badge', content: 'two', variant: 'success' },
          { kind: 'badge', content: 'three', variant: 'warning' },
        ],
      },
    }
  } else if (lower.includes('grid')) {
    yield { type: 'thinking', text: 'Component → grid (2-col)' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'grid',
        columns: 2,
        gap: 'sm',
        children: [
          { kind: 'card', title: 'A', body: 'Cell' },
          { kind: 'card', title: 'B', body: 'Cell' },
          { kind: 'card', title: 'C', body: 'Cell' },
          { kind: 'card', title: 'D', body: 'Cell' },
        ],
      },
    }
  } else if (lower.includes('paragraph')) {
    yield { type: 'thinking', text: 'Component → paragraph' }
    await sleep(200)
    yield {
      type: op,
      spec: {
        kind: 'paragraph',
        content: extractAfter(prompt, ['paragraph']) || 'A paragraph of text.',
      },
    }
  } else {
    yield { type: 'thinking', text: 'No component match — echoing as text' }
    await sleep(150)
    yield { type: op, spec: { kind: 'text', content: prompt } }
  }
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
    body: 'Type a prompt in CHAT. Type "palette" to see every component at once. Try: "make a button", "alert error", "show a table", "add a checkbox".',
  },
  uiStage,
  onAction,
)
pushAI('Agent ready. Type "palette" to see all components.')
pushChat('system', 'session started')
