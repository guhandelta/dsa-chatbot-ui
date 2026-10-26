import { describe, expect, it } from 'vitest'
import { PREVIEW_CSP, PREVIEW_SANDBOX, autoRefreshable, buildPreview } from './preview'

const page = `<!doctype html><html><head><title>x</title><link rel="stylesheet" href="styles.css"></head>
<body><p>hi</p><script src="script.ts"></script><script src="./app.js"></script><script src="https://cdn.example.com/lib.js"></script></body></html>`

describe('buildPreview', () => {
  const html = buildPreview([
    { name: 'index.html', content: page },
    { name: 'styles.css', content: 'p { color: red } </style><script>alert(1)</script>' },
    { name: 'app.js', content: 'console.log("</script><b>")' },
    { name: 'script.ts', content: 'let n: number = 1' },
  ], { 'script.ts': 'let n = 1;' }, 'tok-123')

  it('puts the network-blocking CSP and the console bridge first in <head>', () => {
    const head = html.slice(html.indexOf('<head>'), html.indexOf('<title>'))
    expect(head).toContain(`content="${PREVIEW_CSP}"`)
    expect(head).toContain('"tok-123"')
    expect(PREVIEW_CSP).toContain("default-src 'none'")
    expect(PREVIEW_CSP).not.toMatch(/connect-src|https?:/)
  })

  it('inlines local styles and scripts, using compiled JavaScript for TypeScript', () => {
    expect(html).toContain('<style data-file="styles.css">p { color: red } <\\/style>')
    expect(html).toContain('data-file="script.ts">let n = 1;</script>')
    expect(html).not.toContain('let n: number')
    expect(html).toContain('console.log("<\\/script><b>")')
    // External references are left alone and blocked by the CSP.
    expect(html).toContain('src="https://cdn.example.com/lib.js"')
  })

  it('wraps fragments that have no document structure', () => {
    const fragment = buildPreview([{ name: 'index.html', content: '<p>bare</p>' }], {}, 't')
    expect(fragment.startsWith('<!doctype html><html><head><meta http-equiv="Content-Security-Policy"')).toBe(true)
    expect(fragment).toContain('<body><p>bare</p></body>')
  })

  it('sandboxes scripts without same-origin access and refreshes only markup automatically', () => {
    expect(PREVIEW_SANDBOX).toBe('allow-scripts')
    expect(autoRefreshable('index.html') && autoRefreshable('styles.css')).toBe(true)
    expect(autoRefreshable('script.js') || autoRefreshable('script.ts')).toBe(false)
  })
})
