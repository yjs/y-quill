/* eslint-env browser */

import * as Y from 'yjs'
import * as error from 'lib0/error'
import { QuillBinding } from 'y-quill'
import { WebsocketProvider } from 'y-websocket'
import Delta from 'quill-delta'
import Quill from 'quill'
import QuillCursors from 'quill-cursors'
import QuillTableEmbed, { tableHandler } from 'quill/modules/tableEmbed'
import { register as registerSuggestionBlots } from '../src/blots/suggestion.js'

registerSuggestionBlots()
Quill.register('modules/cursors', QuillCursors)
QuillTableEmbed.register()
Delta.registerEmbed('table-embed', tableHandler)

/*
 * # Logic for toggling suggestion mode
 */

/**
 * @type {HTMLInputElement?}
 */
const elemToggleShowSuggestions = document.querySelector('#toggle-show-suggestions')
/**
 * @type {HTMLInputElement?}
 */
const elemToggleSuggestMode = document.querySelector('#toggle-suggest-mode')
if (elemToggleShowSuggestions == null || elemToggleSuggestMode == null) error.unexpectedCase()

elemToggleShowSuggestions.addEventListener('change', () => initEditorBinding())

elemToggleSuggestMode.addEventListener('change', () => {
  const enabled = elemToggleSuggestMode.checked
  if (enabled) {
    elemToggleShowSuggestions.checked = true
    elemToggleShowSuggestions.disabled = true
  } else {
    elemToggleShowSuggestions.disabled = false
  }
  initEditorBinding()
})

/*
 * # Initialize the Quill editor
 */
const editorContainer = document.createElement('div')
editorContainer.setAttribute('id', 'editor')
document.body.insertBefore(editorContainer, null)
const editor = new Quill(editorContainer, {
  modules: {
    cursors: true,
    toolbar: [
      [{ header: [1, 2, false] }],
      ['bold', 'italic', 'underline'],
      ['image', 'code-block']
    ],
    history: {
      userOnly: true
    }
  },
  placeholder: 'Start collaborating...',
  theme: 'snow' // or 'bubble'
})

/*
 * # Init two Yjs documents.
 *
 * The suggestion document is a fork of the original document. By keeping them separate, we can
 * enforce different permissions on these documents.
 */

const ydoc = new Y.Doc()
const providerYdoc = new WebsocketProvider('wss://demos.yjs.dev/ws', 'quill-demo-1', ydoc, { connect: false })
const suggestionDoc = new Y.Doc()
const providerYdocSuggestions = new WebsocketProvider('wss://demos.yjs.dev/ws', 'quill-demo-suggestions-1', suggestionDoc, { connect: false })
const am = Y.createAttributionManagerFromDiff(ydoc, suggestionDoc)

// Define user name and user name
// Check the quill-cursors package on how to change the way cursors are rendered
providerYdoc.awareness.setLocalStateField('user', {
  name: 'Typing Jimmy',
  color: 'blue'
})

// changes from ydoc should always flow into suggestionDoc
// changes from suggestionDoc only flow into ydoc if suggestion-mode is disabled
ydoc.on('update', update => {
  Y.applyUpdate(suggestionDoc, update)
})
suggestionDoc.on('update', (update, origin, _doc, tr) => {
  // only if event is local and suggestion mode is enabled
  if (!elemToggleSuggestMode.checked && tr.local && [currentBinding, null].some(o => o === origin)) {
    Y.applyUpdate(ydoc, update)
  }
})

/*
 * # implement a function to (re-)initialize the Yjs<>Quill editor binding.
 *
 * Render suggestionsDocument only if suggestion-mode is enabled.
 */

/**
 * @type {QuillBinding?}
 */
let currentBinding = null
const initEditorBinding = () => {
  const withSuggestions = elemToggleShowSuggestions.checked
  const ytext = (withSuggestions ? suggestionDoc : ydoc).getText('quill')
  currentBinding?.destroy()
  currentBinding = new QuillBinding(ytext, editor, providerYdoc.awareness, withSuggestions ? { attributionManager: am } : {})
}
initEditorBinding()

// @ts-ignore
window.example = { editor, providerYdoc, providerYdocSuggestions, ydoc, suggestionDoc, ytext: ydoc.getText('quill'), ytextSuggestions: suggestionDoc.getText('quill'), Y }
