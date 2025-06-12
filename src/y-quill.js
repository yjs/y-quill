/**
 * @module bindings/quill
 */

import * as Y from 'yjs' // eslint-disable-line
import * as object from 'lib0/object'
import Delta from 'quill-delta'

/**
 * @typedef {import('@y/protocols/awareness').Awareness} Awareness
 */

/**
 * @typedef {Array<import('quill-delta').Op>} DeltaOps
 */

/**
 * Removes the pending '\n's if it has no attributes.
 *
 * @param {Array<any>} delta
 */
export const normQuillDelta = delta => {
  while (delta.length > 0) {
    const d = delta[delta.length - 1]
    const insert = d.insert
    if ((d.attributes == null || object.isEmpty(d.attributes) || (object.size(d.attributes) === 1 && d.attributes.attributionFormat !== undefined)) && insert !== undefined && insert.constructor === String && insert.slice(-1) === '\n') {
      delta = delta.slice()
      let ins = insert.slice(0, -1)
      while (ins.slice(-1) === '\n') {
        ins = ins.slice(0, -1)
      }
      delta[delta.length - 1] = { insert: ins }
      if (ins.length === 0) {
        delta.pop()
        continue
      }
    }
    break
  }
  return delta
}

/**
 * @param {any} quillCursors
 * @param {any} aw
 * @param {number} clientId
 * @param {Y.Doc} doc
 * @param {Y.Text} type
 * @param {Awareness} awareness
 * @param {Y.AbstractAttributionManager} attributionManager
 */
const updateCursor = (quillCursors, aw, clientId, doc, type, awareness, attributionManager) => {
  try {
    if (aw && aw.cursor && clientId !== awareness.clientID) {
      const user = aw.user || {}
      const color = user.color || '#ffa500'
      const name = user.name || `User: ${clientId}`
      quillCursors.createCursor(clientId.toString(), name, color)
      const anchor = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(aw.cursor.anchor), doc, true, attributionManager)
      const head = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(aw.cursor.head), doc, true, attributionManager)
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
 * @property {(a:YType,b:EmbedDelta,binding:import('y-quill').QuillBinding)=>YType} EmbedDef.update
 * @property {(src:YType,events:Array<Y.YXmlEvent>)=>EmbedDelta} EmbedDef.eventsToDelta
 * @property {(src:YType)=>EmbedDelta} EmbedDef.typeToDelta
 */

/**
 * @template {any} EmbedDelta
 * @template {Y.XmlElement} YType
 * @typedef {Object} QuillBindingOpts
 * @property {{ [k:string]: EmbedDef<EmbedDelta,YType> }} [QuillBindingOpts.embeds]
 * @property {Y.DiffAttributionManager|Y.noAttributionsManager} [QuillBindingOpts.attributionManager]
 * @property {(attributions:any)=>Object<string,any>} [QuillBindingOpts.attributionToAttributes]
 */

/**
 * @param {Object<string,any>|null} attribution
 */
const defaultAttributionToAttributes = (attribution) => {
  const attributionFormat = attribution?.attributes ? (Array.from(new Set(Object.values(attribution.attributes).flat())).join(',') || 'unknown') : null
  const attributionInsert = attribution?.insert ? (attribution.insert.join(',') || 'unknown') : null
  const attributionDelete = attribution?.delete ? (attribution.delete.join(',') || 'unknown') : null
  const suggestion = attribution ? ((attribution.insert && 'insert') || (attribution.delete && 'delete') || null) : null
  if (attributionInsert == null && attributionDelete == null && (attribution == null || attributionFormat != null)) {
    return {
      attributionFormat
    }
  }
  return {
    attributionFormat,
    attributionInsert,
    attributionDelete,
    suggestion
  }
}

/**
 * @param {{ insert: string|Object }} op
 */
const getDeltaInsertOpLength = op =>
  op.insert.constructor === String ? op.insert.length : 1

/**
 * @param {{ attributes?: Object<string,any> }} op
 */
const isSuggestionOp = op =>
  op.attributes?.suggestion != null || op.attributes?.attributionFormat != null

/**
 * Inspect the quill editor state and extend the range to include as much of the suggestions as
 * possible. Example: if range=[3,3] and ops=[{ insert: 'abcde', attributes: { suggestion: 'insert' } }], then
 * the range will be extended to [0,5] (start and end index)
 *
 * @param {QuillBinding} binding
 * @param {number} start
 * @param {number} end
 */
export const extendtoSuggestionRange = (binding, start, end) => {
  const delta = binding.quill.getContents().ops
  let startDeltaIndex = 0
  let endDeltaIndex = 0
  let remainingLen = start
  for (; startDeltaIndex < delta.length; startDeltaIndex++) {
    const opLen = getDeltaInsertOpLength(delta[startDeltaIndex])
    if (remainingLen <= opLen) {
      // break early (this is slightly different for endDeltaIndex)
      break
    }
    remainingLen -= opLen
  }
  if (isSuggestionOp(delta[startDeltaIndex])) {
    start -= remainingLen
    startDeltaIndex--
  }
  while (startDeltaIndex >= 0 && isSuggestionOp(delta[startDeltaIndex])) {
    start -= getDeltaInsertOpLength(delta[startDeltaIndex--])
  }
  // now do the same for end
  remainingLen = end
  for (; endDeltaIndex < delta.length; endDeltaIndex++) {
    const opLen = getDeltaInsertOpLength(delta[endDeltaIndex])
    if (remainingLen < opLen) {
      // break after jumping over one last delta (this is slightly different for startDeltaIndex)
      break
    }
    remainingLen -= opLen
  }
  if (endDeltaIndex < delta.length && isSuggestionOp(delta[endDeltaIndex])) {
    end += getDeltaInsertOpLength(delta[endDeltaIndex]) - remainingLen
    endDeltaIndex++
  }
  while (endDeltaIndex < delta.length && isSuggestionOp(delta[endDeltaIndex])) {
    end += getDeltaInsertOpLength(delta[endDeltaIndex++])
  }
  return { start, end }
}

/**
 * Only meant to be used by acceptSuggesiton & rejectSuggestion.
 *
 * Get relative ids for accepting / rejecting changes.
 *
 * @param {QuillBinding} binding
 * @param {number} start
 * @param {number} end
 * @return {{ startId: Y.ID, endId: Y.ID }}
 */
export const indexRangeToRelRange = (binding, start, end) => {
  const startId = /** @type {Y.ID} */ (Y.createRelativePositionFromTypeIndex(binding.type, start, 0, binding.attributionManager).item || binding.type._start?.id)
  /**
   * @type {Y.ID?}
   */
  let endId = null
  if (start !== end) {
    endId = Y.createRelativePositionFromTypeIndex(binding.type, end, 0, binding.attributionManager).item
    if (endId == null) {
      endId = Y.createRelativePositionFromTypeIndex(binding.type, end, -1, binding.attributionManager).item
    }
  }
  return { startId, endId: endId || startId }
}

export class QuillBinding {
  /**
   * @param {Y.Text} type
   * @param {any} quill
   * @param {Awareness} [awareness]
   * @param {QuillBindingOpts<any,any>} opts
   */
  constructor (type, quill, awareness, { embeds = {}, attributionManager = Y.noAttributionsManager, attributionToAttributes = defaultAttributionToAttributes } = {}) {
    const doc = /** @type {Y.Doc} */ (type.doc)
    this.type = type
    this.doc = doc
    this.quill = quill
    this.embeds = embeds
    this.attributionManager = attributionManager
    const quillCursors = quill.getModule('cursors') || null
    this.quillCursors = quillCursors
    this._attributionToAttributes = attributionToAttributes
    this._attributionAttributeNames = Object.keys(attributionToAttributes({ insert: [], delete: [], attributes: { bold: [] } }))
    /**
     * @param {any} d
     * @param {boolean} explicitAttributions
     * @return {Array<any>}
     */
    this._deltaToQuillDelta = (d, explicitAttributions = true) => {
      const res = d.toJSON().map(/** @param {any} op */ op => {
        if (op.insert != null && op.insert instanceof Y.XmlElement) {
          const embedName = op.insert.nodeName
          const embedDef = this.embeds[embedName]
          if (embedDef != null) {
            op.insert = { [embedName]: embedDef.typeToDelta(op.insert) }
          }
        }
        op.attributes = object.assign({}, op.attributes, this._attributionToAttributes(op.attribution))
        delete op.attribution
        // if ((op.insert != null && explicitAttributions) || op.attribution != null) {
        //   op.attributes = object.assign(op.attributes ?? {}, this._attributionToAttributes(op.attribution))
        //   delete op.attribution
        // }
        return op
      })
      // console.log('generated delta', res, 'from ychange: ', d.toJSON())
      return res
    }
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
        updateCursor(quillCursors, states.get(id), id, doc, type, /** @type {Awareness} */ (awareness), this.attributionManager)
      })
      updated.forEach(id => {
        updateCursor(quillCursors, states.get(id), id, doc, type, /** @type {Awareness} */ (awareness), this.attributionManager)
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
      if (tr.origin === this && this.attributionManager !== Y.noAttributionsManager) {
        const changes = Y.mergeIdSets([tr.insertSet, tr.deleteSet])
        const delta = type.getDelta(this.attributionManager, { itemsToRender: changes, retainInserts: true })
        quill.updateContents(this._deltaToQuillDelta(delta).filter(d => d.delete == null), this)
      }
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

        const event = /** @type {Y.YTextEvent<any> | undefined} */ ((tr.changedParentTypes.get(/** @type {any} */ (type)) || []).find(event => event.target === type))
        /**
         * quill seems to favor having deletions at the beginning. This function moves deletes to
         * the left if possible.
         * @param {Delta} delta
         */
        const normalizeDelta = delta => {
          // @todo this could be part of lib0/delta (automated when constructing a delta)
          for (let i = 0; i < delta.ops.length; i++) {
            const op = delta.ops[i]
            if (op.delete != null) {
              let j = i
              // move deletion to the left
              for (; j > 0 && delta.ops[j - 1].insert != null; j--) {
                delta.ops[j] = delta.ops[j - 1]
                delta.ops[j - 1] = op
              }
            }
          }
        }
        if (event != null) {
          const eventDelta = /** @type {any} */ (this._deltaToQuillDelta(event.getDelta(this.attributionManager)))
          // console.log('ytext observer called ', { delta: eventDelta })
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
        normalizeDelta(delta)
        /**
         * @type {Delta}
         */
        const appliedDelta = quill.updateContents(delta, this)
        normalizeDelta(appliedDelta)
        const equals = appliedDelta.ops.length === delta.ops.length && appliedDelta.ops.every((op, i) => {
          const otherOp = delta.ops[i]
          if (op.insert != null) return op.insert === otherOp.insert || (typeof op.insert === 'object' && typeof op.insert === typeof otherOp.insert)
          if (op.retain != null) return op.retain === otherOp.retain || (typeof op.retain === 'object' && typeof op.retain === typeof otherOp.retain)
          return op.delete === otherOp.delete
        })
        if (!equals && tr.origin !== 'implicit') {
          /**
           * @todo outsource this
           * @todo idea: if there are implicit changes with attributions, rerender the editor
           *
           * @param {Array<any>} ops
           */
          const removeAttributions = (ops) => {
            ops.forEach(op => {
              if (op.attributes != null && this._attributionAttributeNames.some(n => op.attributes[n] != null)) {
                op.attributes = object.assign({}, op.attributes)
                for (const name of this._attributionAttributeNames) {
                  delete op.attributes[name]
                }
              }
            })
            return ops
          }
          // diff the documents if we find implicit changes from quill
          const { ops: implicitChanges } = new Delta(normQuillDelta(removeAttributions(this._deltaToQuillDelta(type.getDelta(this.attributionManager), false)))).diff(new Delta(normQuillDelta(removeAttributions(quill.getContents().ops))))
          if (implicitChanges.length > 0 && (implicitChanges[0].retain !== type.length || implicitChanges[implicitChanges.length - 1].insert !== '\n' || implicitChanges[implicitChanges.length - 1].attributes != null)) {
            // console.warn('try to apply implicit changes', implicitChanges)
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
      // console.log('quill observer called ', { delta })
      if (delta && delta.ops) {
        const ops = delta.ops
        // Split ops into two sets: changes related to custom embeds and all other changes. The
        // changes will be applied separately, as the Y.Text delta doesn't understand custom embeds.
        // Also, update negatedUsedFormats.
        const embedChanges = new Delta()
        const changes = new Delta()
        ops.forEach(op => {
          if (op.attributes !== undefined) {
            for (const name of this._attributionAttributeNames) {
              delete op.attributes[name]
            }
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
          doc.transact(tr => {
            type.applyDelta(changes.ops, this.attributionManager)
            const attributedDeletes = tr.meta.get('attributedDeletes')
            if (attributedDeletes) {
              quill.updateContents(this._deltaToQuillDelta(type.getDelta(this.attributionManager, { itemsToRender: attributedDeletes, retainInserts: true, retainDeletes: false })), this)
            }
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
                embedDef.update(yembed, /** @type {Record<string,any>} */ (op.insert)[embedName], this)
                forward(1)
              } else if (op.retain) {
                const yembedType = /** @type {any} */ (item?.content).type
                if (yembedType instanceof Y.XmlElement) {
                  const embedName = yembedType.nodeName
                  const embedDef = embeds[embedName]
                  if (embedDef != null && /** @type {Record<string,any>} */ (op.retain)[embedName] != null) {
                    embedDef.update(yembedType, /** @type {Record<string,any>} */ (op.retain)[embedName], this)
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
          const anchor = Y.createRelativePositionFromTypeIndex(type, sel.index, 0, this.attributionManager)
          const head = Y.createRelativePositionFromTypeIndex(type, sel.index + sel.length, 0, this.attributionManager)
          if (!aw || !aw.cursor || !Y.compareRelativePositions(anchor, aw.cursor.anchor) || !Y.compareRelativePositions(head, aw.cursor.head)) {
            awareness.setLocalStateField('cursor', {
              anchor,
              head
            })
          }
        }
        // update all remote cursor locations
        awareness.getStates().forEach((aw, clientId) => {
          updateCursor(quillCursors, aw, clientId, doc, type, awareness, attributionManager)
        })
      }
    }
    quill.on('editor-change', this._quillObserver)
    // This indirectly initializes _negatedUsedFormats.
    // Make sure that this call this after the _quillObserver is set.
    quill.setContents(this._deltaToQuillDelta(type.getDelta(this.attributionManager)), this)
    // init remote cursors
    if (quillCursors !== null && awareness) {
      awareness.getStates().forEach((aw, clientId) => {
        updateCursor(quillCursors, aw, clientId, doc, type, awareness, attributionManager)
      })
      awareness.on('change', this._awarenessChange)
    }
    this._onAttrChange = this.attributionManager.on('change', (changes) => {
      quill.updateContents(this._deltaToQuillDelta(type.getDelta(this.attributionManager, { itemsToRender: changes, retainInserts: true, retainDeletes: true })), this)
    })
  }

  /**
   * @param {number} start
   * @param {number} end
   */
  acceptChangesAt (start, end = start) {
    const extendedRange = extendtoSuggestionRange(this, start, end)
    // console.log('extended range from ', { start, end }, ' to ', extendedRange)
    const { startId, endId } = indexRangeToRelRange(this, extendedRange.start, extendedRange.end)
    if (this.attributionManager instanceof Y.DiffAttributionManager && startId != null && endId != null) {
      this.attributionManager.acceptChanges(startId, endId)
    }
  }

  /**
   * @param {number} start
   * @param {number} end
   */
  rejectChangesAt (start, end = start) {
    const extendedRange = extendtoSuggestionRange(this, start, end)
    // console.log('extended range from ', { start, end }, ' to ', extendedRange)
    const { startId, endId } = indexRangeToRelRange(this, extendedRange.start, extendedRange.end)
    if (this.attributionManager instanceof Y.DiffAttributionManager && startId != null && endId != null) {
      this.attributionManager.rejectChanges(startId, endId)
    }
  }

  /**
   * @param {Y.AbstractAttributionManager} am
   */
  setAttributionManager (am) {
    this.attributionManager.off('change', this._onAttrChange)
    // unrender current attributions
    const currentAttributions = this._deltaToQuillDelta(this.type.getDelta(this.attributionManager, { retainInserts: true, retainDeletes: true }))
    const unrenderDelta = currentAttributions.map(d => d.attribution != null ? { delete: typeof d.insert === 'string' ? d.insert.length : 1 } : d)
    this.attributionManager = am
    this.attributionManager.on('change', this._onAttrChange)
    // render new attributions
    const newAttributions = this._deltaToQuillDelta(this.type.getDelta(am, { retainInserts: true, retainDeletes: true }))
    // compose changes and apply
    const changes = new Delta(unrenderDelta).compose(new Delta(newAttributions))
    this.quill.updateContents(changes, this)
  }

  destroy () {
    this.type.unobserveDeep(this._typeObserver)
    this.quill.off('editor-change', this._quillObserver)
    this.attributionManager.off('change', this._onAttrChange)
    if (this.awareness) {
      this.awareness.off('change', this._awarenessChange)
    }
  }
}
