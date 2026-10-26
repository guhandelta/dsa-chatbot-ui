// React for the web playground preview. Built into one classic script
// (scripts/build-preview-runtime.mjs) that the playground inlines into the
// sandboxed preview, because the preview cannot fetch anything itself.
import * as React from 'react'
import * as ReactDOMClient from 'react-dom/client'

const scope = window as unknown as Record<string, unknown>
scope.React = React
scope.ReactDOM = ReactDOMClient
