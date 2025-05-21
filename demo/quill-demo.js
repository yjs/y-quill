/* eslint-env browser */

import * as Y from 'yjs'
import { QuillBinding } from 'y-quill'
import { WebsocketProvider } from 'y-websocket'
import Delta from 'quill-delta'
import Quill from 'quill'
import QuillCursors from 'quill-cursors'
import QuillTableEmbed, { tableHandler } from 'quill/modules/tableEmbed'
import { Attributor, Scope } from 'parchment';

const AttributionType = new Attributor('attributionType', 'data-attribution-type', {
  scope: Scope.INLINE
});
const AttributionBy = new Attributor('attributionBy', 'data-attribution-by', {
  scope: Scope.INLINE
});
Quill.register(AttributionType);
Quill.register(AttributionBy);

Quill.register('modules/cursors', QuillCursors)

QuillTableEmbed.register()
Delta.registerEmbed('table-embed', tableHandler)


// @todo move this to a separate module

window.addEventListener('load', () => {
  const ydoc= new Y.Doc()
  const providerYdoc = new WebsocketProvider('wss://demos.yjs.dev/ws', 'quill-demo', ydoc)
  const suggestionDoc = new Y.Doc()
  const providerYdocSuggestions = new WebsocketProvider('wss://demos.yjs.dev/ws', 'quill-demo-suggestions', suggestionDoc)
  const am = Y.createAttributionManagerFromDiff(ydoc, suggestionDoc)

  // changes from ydoc should always flow into suggestionDoc
  // changes from suggestionDoc only flow into ydoc if suggestion-mode is disabled
  ydoc.on('update', update => {
    Y.applyUpdate(suggestionDoc, update)
  })
  suggestionDoc.on('update', update => {
    // @todo only if suggestionMode is off
    Y.applyUpdate(ydoc, update)
  })

  const type = suggestionDoc.getText('quill')
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

  const binding = new QuillBinding(type, editor, providerYdoc.awareness, { attributionManager: am })

  // Define user name and user name
  // Check the quill-cursors package on how to change the way cursors are rendered
  providerYdoc.awareness.setLocalStateField('user', {
    name: 'Typing Jimmy',
    color: 'blue'
  })
  // @ts-ignore
  window.example = { providerYdoc, providerYdocSuggestions, ydoc, suggestionDoc, type, binding, Y }
})
