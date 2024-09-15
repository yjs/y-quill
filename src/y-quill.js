/**
 * @module bindings/quill
 */

import * as Y from 'yjs' // eslint-disable-line
import * as object from 'lib0/object'
import Delta from 'quill-delta'

/**
 * @typedef {import('y-protocols/awareness').Awareness} Awareness
 */

/**
 * @typedef {Array<import('quill-delta').Op>} DeltaOps
 */

/**
 * Removes the pending '\n's if it has no attributes.
 *
 * @param {any} delta
 */
export const normQuillDelta = delta => {
  if (delta.length > 0) {
    const d = delta[delta.length - 1]
    const insert = d.insert
    if (d.attributes === undefined && insert !== undefined && insert.constructor === String && insert.slice(-1) === '\n') {
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
 * @param {any} aw
 * @param {number} clientId
 * @param {Y.Doc} doc
 * @param {Y.Text} type
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

/**
 * @template {any} EmbedDelta
 * @template {Y.XmlElement} YType
 *
 * @typedef {Object} EmbedDef
 * @property {(a:YType,b:EmbedDelta)=>YType} EmbedDef.update
 * @property {(src:YType,events:Array<Y.YXmlEvent>)=>EmbedDelta} EmbedDef.eventsToDelta
 * @property {(src:YType)=>EmbedDelta} EmbedDef.typeToDelta
 */

/**
 * @template {any} EmbedDelta
 * @template {Y.XmlElement} YType
 * @typedef {Object} QuillBindingOpts
 * @property {{ [k:string]: EmbedDef<EmbedDelta,YType> }} [QuillBindingOpts.embeds]
 */

/**
 * @param {Array<any>} delta
 * @param {QuillBinding} binding
 */
const typeDeltaToQuillDelta = (delta, binding) => delta.map(op => {
  if (op.insert != null && op.insert instanceof Y.XmlElement) {
    const embedName = op.insert.nodeName
    const embedDef = binding.embeds[embedName]
    if (embedDef != null) {
      return { insert: { [embedName]: embedDef.typeToDelta(op.insert) } }
    }
  }
  return op
})

export class QuillBinding {
  /**
   * @param {Y.Text} type
   * @param {any} quill
   * @param {Awareness} [awareness]
   * @param {QuillBindingOpts<any,any>} opts
   */
  constructor (type, quill, awareness, { embeds = {} } = {}) {
    const doc = /** @type {Y.Doc} */ (type.doc)
    this.type = type
    this.doc = doc
    this.quill = quill
    this.embeds = embeds
    const quillCursors = quill.getModule('cursors') || null
    this.quillCursors = quillCursors
    // This object contains all attributes used in the quill instance
    /**
     * @type {Record<string,any>}
     */
    this._negatedUsedFormats = {}
    this.awareness = awareness
    /**
     * @param {{ added: Array<number>, removed: Array<number>, updated: Array<number> }} change
     */
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
     * @param {Array<Y.YEvent<any>>} _events
     * @param {Y.Transaction} tr
     */
    this._typeObserver = (_events, tr) => {
      if (tr.origin !== this) {
        /**
         * @type {Map<Y.XmlElement, any>}
         */
        const embedEvents = new Map()
        tr.changedParentTypes.forEach((events, child) => {
          if (child.parent === this.type && child instanceof Y.XmlElement) {
            const embed = embeds[child.nodeName]
            if (embed == null) {
              console.warn(`Custom embed "${child.nodeName}" not defined!`)
            }
            embedEvents.set(child, { [child.nodeName]: embed.eventsToDelta(child, /** @type {Array<Y.YXmlEvent>} */ (events)) })
          }
        })
        /**
         * @type {Array<{ retain: number } | { retain: Record<string,any>}>}
         */
        const embedEventOps = []
        if (embedEvents.size > 0) {
          let missingEmbedEventPositions = embedEvents.size
          for (let item = type._start, offset = 0; item !== null && missingEmbedEventPositions > 0; item = item.right) {
            if (item.content.constructor === Y.ContentType) {
              const child = /** @type {Y.XmlElement} */ (/** @type {Y.ContentType} */ (item.content).type)
              if (embedEvents.has(child)) {
                if (offset > 0) {
                  embedEventOps.push({ retain: offset })
                  offset = 0
                }
                embedEventOps.push({ retain: embedEvents.get(child) })
                missingEmbedEventPositions--
                continue
              }
            }
            if (!item.deleted && item.countable) offset += item.length
          }
        }

        let delta = new Delta(embedEventOps)

        const event = (tr.changedParentTypes.get(/** @type {any} */ (type)) || []).find(event => event.target === type)
        if (event != null) {
          const eventDelta = event.delta
          // We always explicitly set attributes, otherwise concurrent edits may
          // result in quill assuming that a text insertion shall inherit existing
          // attributes.
          const sanitizedDelta = []
          for (let i = 0; i < eventDelta.length; i++) {
            const d = eventDelta[i]
            if (d.insert != null) {
              let op = d
              if (d.insert instanceof Y.XmlElement) {
                const nodeName = d.insert.nodeName
                const embedDef = embeds[nodeName]
                if (embedDef != null) {
                  op = { insert: { [/** @type {string} */ (nodeName)]: embedDef.typeToDelta(d.insert) } }
                }
              }
              sanitizedDelta.push(Object.assign({}, op, { attributes: Object.assign({}, this._negatedUsedFormats, d.attributes || {}) }))
            } else {
              sanitizedDelta.push(d)
            }
          }

          if (delta.ops.length === 0) {
            delta = new Delta(/** @type {any} */ (sanitizedDelta))
          } else {
            delta = new Delta(/** @type {any} */ (sanitizedDelta)).compose(delta)
          }
        }
        /**
         * @type {Delta}
         */
        const appliedDelta = quill.updateContents(delta, this)
        const equals = appliedDelta.ops.length === delta.ops.length && appliedDelta.ops.every((op, i) => {
          const otherOp = delta.ops[i]
          if (op.insert != null) return op.insert === otherOp.insert || (typeof op.insert === 'object' && typeof op.insert === typeof otherOp.insert)
          if (op.retain != null) return op.retain === otherOp.retain || (typeof op.retain === 'object' && typeof op.retain === typeof otherOp.retain)
          return op.delete === otherOp.delete
        })
        if (!equals) {
          // diff the documents if we find implicit changes from quill
          const { ops: implicitChanges } = new Delta(typeDeltaToQuillDelta(normQuillDelta(type.toDelta()), this)).diff(new Delta(normQuillDelta(quill.getContents().ops)))
          if (implicitChanges.length > 0 && (implicitChanges[0].retain !== type.length || implicitChanges[implicitChanges.length - 1].insert !== '\n')) {
            this.doc.transact(() => {
              // reuse the quillObserver which transforms custom embeds
              this._quillObserver(null, { ops: implicitChanges }, null, 'implicit')
            }, this)
          }
        }
      }
    }
    type.observeDeep(this._typeObserver)
    /**
     * @param {any} _eventType
     * @param {{ ops: DeltaOps }} delta
     * @param {any} _state
     * @param {any} origin
     */
    this._quillObserver = (_eventType, delta, _state, origin) => {
      if (delta && delta.ops) {
        const ops = delta.ops
        // Split ops into two sets: changes related to custom embeds and all other changes. The
        // changes will be applied separately, as the Y.Text delta doesn't understand custom embeds.
        // Also, update negatedUsedFormats.
        const embedChanges = new Delta()
        const changes = new Delta()
        ops.forEach(op => {
          if (op.attributes !== undefined) {
            for (const key in op.attributes) {
              if (this._negatedUsedFormats[key] === undefined) {
                this._negatedUsedFormats[key] = false
              }
            }
          }
          const potentialCustomEmbed = (op.retain != null && typeof op.retain === 'object') ? op.retain : (op.insert != null && typeof op.insert === 'object' ? op.insert : null)
          if (potentialCustomEmbed) {
            const embed = embeds[object.keys(/** @type {Record<string,any>} */ (op.retain ?? op.insert))[0]]
            if (embed != null) {
              embedChanges.push(op)
              if (op.retain != null) {
                changes.retain(1)
              }
              return
            }
            embedChanges.retain(1) // only jump over the embed
          } else if (op.retain != null) {
            embedChanges.retain(op.retain)
          } else if (op.insert != null) {
            embedChanges.retain(/** @type {string} */ (op.insert).length)
          }
          changes.push(op)
        })
        if (origin !== this) {
          doc.transact(() => {
            type.applyDelta(changes.ops)
            let item = type._start
            /**
             * @param {number} n
             */
            const forward = (n) => {
              while (item != null && (n > 0 || !item.countable || item.deleted)) {
                if (!item.deleted && item.countable) {
                  n -= item.length
                }
                item = item.right
              }
            }
            forward(0)
            let index = 0
            embedChanges.forEach(op => {
              if (op.retain != null && op.retain.constructor === Number) {
                forward(op.retain)
              } else if (op.insert != null) {
                const embedName = object.keys(op.insert)[0]
                const embedDef = embeds[embedName]
                const yembed = new Y.XmlElement(embedName)
                type.insertEmbed(index, yembed)
                embedDef.update(yembed, /** @type {Record<string,any>} */ (op.insert)[embedName])
                forward(1)
              } else if (op.retain) {
                const yembedType = /** @type {any} */ (item?.content).type
                if (yembedType instanceof Y.XmlElement) {
                  const embedName = yembedType.nodeName
                  const embedDef = embeds[embedName]
                  if (embedDef != null && /** @type {Record<string,any>} */ (op.retain)[embedName] != null) {
                    embedDef.update(yembedType, /** @type {Record<string,any>} */ (op.retain)[embedName])
                  } else {
                    console.warn(`expected embed type "${embedName}"`)
                  }
                }
                forward(1)
              }
              index += Delta.Op.length(op)
            })
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
    quill.setContents(typeDeltaToQuillDelta(type.toDelta(), this), this)
    // init remote cursors
    if (quillCursors !== null && awareness) {
      awareness.getStates().forEach((aw, clientId) => {
        updateCursor(quillCursors, aw, clientId, doc, type)
      })
      awareness.on('change', this._awarenessChange)
    }
  }

  destroy () {
    this.type.unobserveDeep(this._typeObserver)
    this.quill.off('editor-change', this._quillObserver)
    if (this.awareness) {
      this.awareness.off('change', this._awarenessChange)
    }
  }
}
