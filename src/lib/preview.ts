// Builds the document for the web playground's live preview.
//
// Isolation comes from three layers, and the document never depends on the
// learner's code behaving:
//   1. The iframe is sandboxed with only `allow-scripts`. Without
//      `allow-same-origin` it runs on an opaque origin, so it cannot read the
//      app's cookies, localStorage (where the session token lives) or DOM.
//   2. A Content-Security-Policy meta tag blocks every network request:
//      only inline styles and scripts, data:/blob: images and fonts.
//   3. Messages from the preview are accepted only from that iframe's window
//      and carrying this render's random token (see Preview in playground).
// Linked files (styles.css, script.js, script.ts) are inlined, so nothing is
// fetched. A script that never yields (an infinite loop) can still freeze the
// preview; scripts therefore run on request, not on every keystroke.

export interface PreviewFile {
  name: string
  content: string
}

export const PREVIEW_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; " +
  'img-src data: blob:; font-src data:; media-src data: blob:'

export const PREVIEW_SANDBOX = 'allow-scripts'

/** `</script>` inside inlined code would end the tag early. */
const safeScript = (code: string) => code.replace(/<\/(script)/gi, '<\\/$1')
const safeStyle = (css: string) => css.replace(/<\/(style)/gi, '<\\/$1')

function bridge(token: string): string {
  // Runs before any learner script. It forwards console output and uncaught
  // errors to the parent; it has no access to anything the parent owns.
  return `<script>(function () {
  var token = ${JSON.stringify(token)};
  function text(value) {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }
  function send(level, args) {
    try { parent.postMessage({ source: 'dsa-preview', token: token, level: level,
      text: Array.prototype.map.call(args, text).join(' ').slice(0, 2000) }, '*'); } catch (e) {}
  }
  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    var original = console[level];
    console[level] = function () { send(level, arguments); return original.apply(console, arguments); };
  });
  window.addEventListener('error', function (event) {
    send('error', [event.message + (event.lineno ? ' (line ' + event.lineno + ')' : '')]);
  });
  window.addEventListener('unhandledrejection', function (event) {
    send('error', ['Unhandled promise rejection: ' + text(event.reason && event.reason.message || event.reason)]);
  });
})();</script>`
}

/**
 * The preview document: index.html with linked stylesheets and scripts
 * inlined, compiled JavaScript used for .ts/.tsx/.jsx files, and the console
 * bridge, CSP and optional runtime (React) added to <head>. Unknown or external references are left in place and
 * are blocked by the CSP.
 */
export function buildPreview(files: PreviewFile[], compiled: Record<string, string>, token: string,
  runtime = ''): string {
  const byName = new Map(files.map((f) => [f.name, f.content]))
  let html = byName.get('index.html') ?? '<!doctype html><html><head></head><body></body></html>'

  html = html.replace(/<link\b[^>]*\brel=["']?stylesheet["']?[^>]*>/gi, (tag) => {
    const href = /\bhref=["']?([^"'\s>]+)/i.exec(tag)?.[1]
    const css = href ? byName.get(href.replace(/^\.\//, '')) : undefined
    return css === undefined ? tag : `<style data-file="${href}">${safeStyle(css)}</style>`
  })
  html = html.replace(/<script\b([^>]*)\bsrc=["']?([^"'\s>]+)["']?([^>]*)>\s*<\/script>/gi, (tag, before, src, after) => {
    const name = String(src).replace(/^\.\//, '')
    const code = /\.(ts|tsx|jsx)$/.test(name) ? compiled[name] : byName.get(name)
    if (code === undefined) return tag
    return `<script${before}${after} data-file="${name}">${safeScript(code)}</script>`
  })

  const head = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' + bridge(token) +
    (runtime ? `<script data-file="react-runtime.js">${safeScript(runtime)}</script>` : '')
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (m) => m + head)
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, (m) => `${m}<head>${head}</head>`)
  return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`
}

/** Whether a change to this file should refresh the preview automatically.
 * Markup and styles cannot hang the page; scripts run on request. */
export const autoRefreshable = (name: string) => /\.(html|css)$/i.test(name)

/** React projects get React and ReactDOM as globals in the preview. */
export const needsReact = (files: PreviewFile[]) => files.some((f) => /\.(tsx|jsx)$/.test(f.name))
export const needsCompile = (files: PreviewFile[]) => files.some((f) => /\.(ts|tsx|jsx)$/.test(f.name))

let reactRuntime: Promise<string> | null = null
/** The prebuilt runtime (scripts/build-preview-runtime.mjs), served by the app itself. */
export function loadReactRuntime(fetcher: typeof fetch = fetch): Promise<string> {
  reactRuntime ??= fetcher('/preview/react-runtime.js').then((response) => {
    if (!response.ok) throw new Error('The React preview runtime is missing. Run npm run dev or npm run build to create it.')
    return response.text()
  }).catch((error) => { reactRuntime = null; throw error })
  return reactRuntime
}
