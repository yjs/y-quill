/**
 * @module bindings/quill
 */

import * as Y from 'yjs' // eslint-disable-line
import { Awareness } from 'y-protocols/awareness.js' // eslint-disable-line

/**
 * Removes the pending '\n's if it has no attributes.
 */
export const normQuillDelta = delta => {
  if (delta.length > 0) {
    const d = delta[delta.length - 1]
    const insert = d.insert
    if (d.attributes === undefined && insert !== undefined && insert.slice(-1) === '\n') {
      delta = delta.slice()
      let ins = insert.slice(0, -1)
      while (ins.slice(-1) === '\n') {
        ins = ins.slice(0, -1)
      }
      delta[delta.length - 1] = { insert: ins }
      if (ins.length === 0) {
        delta.pop()
      }
      return delta
    }
  }
  return delta
}

/**
 * @param {any} quillCursors
 */
const updateCursor = (quillCursors, aw, clientId, doc, type) => {
  try {
    if (aw && aw.cursor && clientId !== doc.clientID) {
      const user = aw.user || {}
      const color = user.color || '#ffa500'
      const name = user.name || `User: ${clientId}`
      quillCursors.createCursor(clientId.toString(), name, color)
      const anchor = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(aw.cursor.anchor), doc)
      const head = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(aw.cursor.head), doc)
      if (anchor && head && anchor.type === type) {
        quillCursors.moveCursor(clientId.toString(), { index: anchor.index, length: head.index - anchor.index })
      }
    } else {
      quillCursors.removeCursor(clientId.toString())
    }
  } catch (err) {
    console.error(err)
  }
}

export class QuillBinding {
  /**
   * @param {Y.Text} type
   * @param {any} quill
   * @param {Awareness} [awareness]
   */
  constructor (type, quill, awareness) {
    const doc = /** @type {Y.Doc} */ (type.doc)
    this.type = type
    this.doc = doc
    this.quill = quill
    const quillCursors = quill.getModule('cursors') || null
    this.quillCursors = quillCursors
    // This object contains all attributes used in the quill instance
    this._negatedUsedFormats = {}
    this.awareness = awareness
    this._awarenessChange = ({ added, removed, updated }) => {
      const states = /** @type {Awareness} */ (awareness).getStates()
      added.forEach(id => {
        updateCursor(quillCursors, states.get(id), id, doc, type)
      })
      updated.forEach(id => {
        updateCursor(quillCursors, states.get(id), id, doc, type)
      })
      removed.forEach(id => {
        quillCursors.removeCursor(id.toString())
      })
    }
    /**
     * @param {Y.YTextEvent} event
     */
    this._typeObserver = event => {
      if (event.transaction.origin !== this) {
        const eventDelta = event.delta
        // We always explicitly set attributes, otherwise concurrent edits may
        // result in quill assuming that a text insertion shall inherit existing
        // attributes.
        const delta = []
        for (let i = 0; i < eventDelta.length; i++) {
          const d = eventDelta[i]
          if (d.insert !== undefined) {
            delta.push(Object.assign({}, d, { attributes: Object.assign({}, this._negatedUsedFormats, d.attributes || {}) }))
          } else {
            delta.push(d)
          }
        }
        quill.updateContents(delta, this)
      }
    }
    type.observe(this._typeObserver)
    this._quillObserver = (eventType, delta, state, origin) => {
      if (delta && delta.ops) {
        // update content
        const ops = delta.ops
        ops.forEach(op => {
          if (op.attributes !== undefined) {
            for (let key in op.attributes) {
              if (this._negatedUsedFormats[key] === undefined) {
                this._negatedUsedFormats[key] = false
              }
            }
          }
        })
        if (origin !== this) {
          doc.transact(() => {
            type.applyDelta(ops)
          }, this)
        }
      }
      // always check selection
      if (awareness && quillCursors) {
        const sel = quill.getSelection()
        const aw = /** @type {any} */ (awareness.getLocalState())
        if (sel === null) {
          if (awareness.getLocalState() !== null) {
            awareness.setLocalStateField('cursor', /** @type {any} */ (null))
          }
        } else {
          const anchor = Y.createRelativePositionFromTypeIndex(type, sel.index)
          const head = Y.createRelativePositionFromTypeIndex(type, sel.index + sel.length)
          if (!aw || !aw.cursor || !Y.compareRelativePositions(anchor, aw.cursor.anchor) || !Y.compareRelativePositions(head, aw.cursor.head)) {
            awareness.setLocalStateField('cursor', {
              anchor,
              head
            })
          }
        }
        // update all remote cursor locations
        awareness.getStates().forEach((aw, clientId) => {
          updateCursor(quillCursors, aw, clientId, doc, type)
        })
      }
    }
    quill.on('editor-change', this._quillObserver)
    // This indirectly initializes _negatedUsedFormats.
    // Make sure that this call this after the _quillObserver is set.
    quill.setContents(type.toDelta(), this)
    // init remote cursors
    if (quillCursors !== null && awareness) {
      awareness.getStates().forEach((aw, clientId) => {
        updateCursor(quillCursors, aw, clientId, doc, type)
      })
      awareness.on('change', this._awarenessChange)
    }
  }
  destroy () {
    this.type.unobserve(this._typeObserver)
    this.quill.off('editor-change', this._quillObserver)
    if (this.awareness) {
      this.awareness.off('change', this._awarenessChange)
    }
  }
}
