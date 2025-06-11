/* eslint-env browser */

import * as Y from 'yjs'
import * as error from 'lib0/error'
import { QuillBinding } from 'y-quill'
import { WebsocketProvider } from '@y/websocket'
import Delta from 'quill-delta'
import Quill from 'quill'
import QuillCursors from 'quill-cursors'
import QuillTableEmbed, { tableHandler } from 'quill/modules/tableEmbed'
import { register as registerSuggestionBlots } from '../src/blots/suggestion.js'
import * as random from 'lib0/random'

registerSuggestionBlots()
Quill.register('modules/cursors', QuillCursors)
QuillTableEmbed.register()
Delta.registerEmbed('table-embed', tableHandler)

const roomName = 'quill-suggestion-demo-3'

/*
 * # Logic for toggling connection & suggestion mode
 */

/**
 * @type {HTMLInputElement?}
 */
const elemToggleConnect = document.querySelector('#toggle-connect')

/**
 * @type {HTMLInputElement?}
 */
const elemToggleShowSuggestions = document.querySelector('#toggle-show-suggestions')
/**
 * @type {HTMLInputElement?}
 */
const elemToggleSuggestMode = document.querySelector('#toggle-suggest-mode')
if (elemToggleShowSuggestions == null || elemToggleSuggestMode == null || elemToggleConnect == null) error.unexpectedCase()

if (localStorage.getItem('should-connect') != null) {
  elemToggleConnect.checked = localStorage.getItem('should-connect') === 'true'
}

elemToggleShowSuggestions.addEventListener('change', () => initEditorBinding())

// when in suggestion-mode, we should use a different clientId to reduce some overhead. This is not
// strictly necessary.
let otherClientID = random.uint53()
elemToggleSuggestMode.addEventListener('change', () => {
  const enabled = elemToggleSuggestMode.checked
  am.suggestionMode = enabled
  if (enabled) {
    elemToggleShowSuggestions.checked = true
    elemToggleShowSuggestions.disabled = true
  } else {
    elemToggleShowSuggestions.disabled = false
  }
  const nextClientId = otherClientID
  otherClientID = suggestionDoc.clientID
  suggestionDoc.clientID = nextClientId
  initEditorBinding()
})

elemToggleConnect.addEventListener('change', () => {
  if (elemToggleConnect.checked) {
    providerYdoc.connectBc()
    providerYdocSuggestions.connectBc()
  } else {
    providerYdoc.disconnectBc()
    providerYdocSuggestions.disconnectBc()
  }
  localStorage.setItem('should-connect', elemToggleConnect.checked ? 'true' : 'false')
})

/*
 * # Initialize the Quill editor
 */
const editorContainer = document.createElement('div')
editorContainer.setAttribute('id', 'editor')
editorContainer.setAttribute('spellcheck', 'false')
document.body.insertBefore(editorContainer, null)
const editor = new Quill(editorContainer, {
  modules: {
    cursors: true,
    toolbar: {
      container: [
        [{ header: [1, 2, false] }],
        ['bold', 'italic', 'underline'],
        ['image', 'code-block'],
        [{ suggestion: 'accept' }, { suggestion: 'reject' }]
      ],
      handlers: {
        /**
         * @type {function(this:{quill: Quill}, string):void}
         */
        suggestion: function (action) {
          switch (action) {
            case 'accept': {
              const sel = this.quill.getSelection(false)
              if (sel != null) {
                currentBinding?.acceptChangesAt(sel.index, sel.index + sel.length)
              }
              console.log('accepted suggestion')
              break
            }
            case 'reject': {
              const sel = this.quill.getSelection(false)
              if (sel != null) {
                currentBinding?.rejectChangesAt(sel.index, sel.index + sel.length)
              }
              console.log('rejected suggestion :(')
              break
            }
          }
        }
      }
    },
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
const providerYdoc = new WebsocketProvider('wss://demos.yjs.dev/ws', roomName, ydoc, { connect: false })
elemToggleConnect.checked && providerYdoc.connectBc()
const suggestionDoc = new Y.Doc({ isSuggestionDoc: true })
const providerYdocSuggestions = new WebsocketProvider('wss://demos.yjs.dev/ws', roomName + '--suggestions', suggestionDoc, { connect: false })
elemToggleConnect.checked && providerYdocSuggestions.connectBc()
const am = Y.createAttributionManagerFromDiff(ydoc, suggestionDoc)

// Define user name and user name
// Check the quill-cursors package on how to change the way cursors are rendered
providerYdoc.awareness.setLocalStateField('user', {
  name: 'Typing Jimmy',
  color: 'blue'
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
