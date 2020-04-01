
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

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
  'MutationObserver'
].forEach(name => {
  global[name] = window[name]
})

// @ts-ignore
document.getSelection = () => ({ rangeCount: 0, removeAllRanges: () => {}, addRange: () => {} })
// @ts-ignore
document.execCommand = () => {}
// @ts-ignore
document.createRange = () => ({
  setStart: () => {},
  setEnd: () => {}
})

// @ts-ignore
require('../dist/test.cjs')
