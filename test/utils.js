import Quill from 'quill'
import Delta from 'quill-delta'
import { QuillBinding } from 'y-quill'
import * as Y from 'yjs'

import { tableEmbed } from '../embeds/table-embed.js'
import TableEmbed from 'quill/modules/tableEmbed.js'

const Parchment = Quill.import('parchment')
/**
 * @type {any}
 */
const BlockEmbed = Quill.import('blots/block/embed')
TableEmbed.register()

/**
 * @typedef {Array<DeltaOp>} DeltaOps
 */
/**
 * @typedef {{ insert: string, attributes: object? }|{ retain: number, attributes: object }|{ delete: number }} DeltaOp
 */

/**
 * @typedef {Object} TableDocument
 * @property {Array<{ insert: { id: string }, attributes: any }>} TableDocument.rows
 * @property {Array<{ insert: { id: string }, attributes: any }>} TableDocument.columns
 * @property {{ [key:string]: { content: DeltaOps, attributes: any } }} TableDocument.cells
 */

/**
 * Just for testing. Doesn't render anything anything.
 */
class TableBlot extends BlockEmbed {
  static tagName = 'DIV'
  static blotName = 'table-embed'

  /**
   * @param {any} scroll
   * @param {any} node
   * @param {any} value
   */
  constructor (scroll, node, value) {
    super(scroll, node)
    /**
     * @type {TableDocument}
     */
    this.d = value
  }

  /**
   * @param {any} value
   */
  static create (value) {
    /**
     * @type {HTMLElement}
     */
    return super.create(value)
  }

  delta () {
    return new Delta([{ insert: { 'table-embed': this.d } }])
  }

  /**
   * @return {HTMLElement}
   */
  static value () {
    throw new Error('unexpected case')
  }

  /**
   * @param {HTMLElement} _domNode
   */
  static formats (_domNode) {
    return undefined
  }

  /**
   * @param {DeltaOps} change
   */
  updateContent (change) {
    const start = new Delta([{ insert: { 'table-embed': this.d } }])
    const composed = start.compose(new Delta([{ retain: { 'table-embed': change } }]))
    this.d = /** @type {any} */ (composed).ops[0].insert['table-embed']
  }

  /**
   * @param {string} name
   * @param {string} value
   */
  format (name, value) {
    if (name === 'alt') {
      this.domNode.setAttribute(name, value)
    } else {
      super.format(name, value)
    }
  }
}

class DeltaBlot extends BlockEmbed {
  static tagName = 'DIV'
  static blotName = 'delta'

  /**
   * @param {any} scroll
   * @param {any} node
   * @param {any} value
   */
  constructor (scroll, node, value) {
    super(scroll, node)
    /**
     * @type {Delta}
     */
    this.d = new Delta(value)
  }

  /**
   * @param {any} value
   */
  static create (value) {
    /**
     * @type {HTMLElement}
     */
    return super.create(value)
  }

  delta () {
    return new Delta().insert({ delta: this.d.ops })
  }

  /**
   * @return {HTMLElement}
   */
  static value () {
    throw new Error('unexpected case')
  }

  /**
   * @param {HTMLElement} _domNode
   */
  static formats (_domNode) {
    return undefined
  }

  /**
   * @param {any} change
   */
  updateContent (change) {
    this.d = this.d.compose(new Delta(change))
  }

  /**
   * @param {string} name
   * @param {string} value
   */
  format (name, value) {
    if (name === 'alt') {
      this.domNode.setAttribute(name, value)
    } else {
      super.format(name, value)
    }
  }
}

// Essential formats
/**
 * @type {any}
 */
const Block = Quill.import('blots/block')
/**
 * @type {any}
 */
const Break = Quill.import('blots/break')
/**
 * @type {any}
 */
const Container = Quill.import('blots/container')
/**
 * @type {any}
 */
const Cursor = Quill.import('blots/cursor')
/**
 * @type {any}
 */
const Inline = Quill.import('blots/inline')
/**
 * @type {any}
 */
const Scroll = Quill.import('blots/scroll')
/**
 * @type {any}
 */
const Text = Quill.import('blots/text')
/**
 * @type {any}
 */
const Image = Quill.import('formats/image')

const registry = new Parchment.Registry()
registry.register(
  Scroll,
  Block,
  Break,
  Container,
  Cursor,
  Inline,
  Text,
  Image,
  /** @type {any} */ (TableBlot),
  /** @type {any} */ (DeltaBlot)
)

/**
 * @typedef {object} TestData
 * @property {Quill} TestData.editor
 * @property {QuillBinding} TestData.binding
 * @property {Y.Text} type
 */

Delta.registerEmbed('delta', {
  compose: (a, b) => new Delta(a).compose(new Delta(b)).ops,
  transform: (a, b, priority) =>
    new Delta(a).transform(new Delta(b), priority).ops,
  invert: (a, b) => new Delta(a).invert(new Delta(b)).ops
})

/**
 * @type {{ [k:string]: import('../src/y-quill.js').EmbedDef<any,any> }}
 */
const embeds = {
  'table-embed': tableEmbed,
  delta: {
    /**
     * @param {Y.XmlElement<{ ytext: Y.Text }>} yxml
     * @param {DeltaOp} op
     */
    update: (yxml, op) => {
      if (!yxml.hasAttribute('ytext')) {
        yxml.setAttribute('ytext', new Y.Text())
      }
      const ytext = yxml.getAttribute('ytext')
      ytext?.applyDelta(op)
    },

    /**
     * @param {Y.XmlElement} yxml
     * @param {Array<Y.YEvent<any>>} events
     * @return {DeltaOps}
     */
    eventsToDelta: (yxml, events) => {
      const ytext = yxml.getAttribute('ytext')
      const ytextevent = events.find(event => event.target === ytext)
      if (ytextevent) {
        return /** @type {any} */ (ytextevent.delta)
      }
      return []
    },
    typeToDelta: (yxml) => {
      return yxml.getAttribute('ytext').toDelta()
    }
  }
}

/**
 * @param {any} [y]
 * @return {TestData}
 */
export const createQuillEditor = (y = new Y.Doc()) => {
  const type = y.getText('text')
  const editor = new Quill(document.createElement('div'), { registry })
  const binding = new QuillBinding(type, editor, undefined, { embeds })
  return {
    editor, binding, type
  }
}
