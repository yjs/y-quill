import fs from 'fs'
import path from 'path'
import { JSDOM } from 'jsdom'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const documentContent = fs.readFileSync(path.join(__dirname, '../test.html'))
const { window } = new JSDOM(documentContent)

// @ts-ignore
global.innerHeight = 0

;[
  'window',
  'document',
  'Node',
  'navigator',
  'Text',
  'HTMLElement',
  'MutationObserver',
  'Element'
].forEach(name => {
  // @ts-ignore
  global[name] = window[name]
})

// @ts-ignore
document.getSelection = () => ({ rangeCount: 0, removeAllRanges: () => {}, addRange: () => {} })
// @ts-ignore
document.createRange = () => ({
  setStart: () => {},
  setEnd: () => {}
})

await import('./index.js')
