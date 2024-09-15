import * as t from 'lib0/testing.js'
import * as prng from 'lib0/prng.js'
import * as math from 'lib0/math.js'
import * as object from 'lib0/object'
import * as Y from 'yjs'
import { applyRandomTests } from 'yjs/testHelper'
import Delta from 'quill-delta'

import { QuillBinding, normQuillDelta } from '../src/y-quill.js'
import Quill from 'quill'

import { tableEmbed } from '../embeds/table-embed.js'
import TableEmbed from 'quill/modules/tableEmbed.js'

const Parchment = Quill.import('parchment')
const BlockEmbed = Quill.import('blots/block/embed')
TableEmbed.register()

/**
 * @typedef {Array<DeltaOp>} DeltaOps
 */
/**
 * @typedef {{ insert: string, attributes: object? }|{ retain: number, attributes: object }|{ delete: number }} DeltaOp
 */

/**
 * @type {Object} TableDocument
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

  constructor (scroll, node, value) {
    super(scroll, node)
    /**
     * @type {TableDocument}
     */
    this.d = value
  }

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
  static value (_domNode) {
    throw new Error('unexpected case')
  }

  /**
   * @param {HTMLElement} _domNode
   */
  static formats (_domNode) {
    return undefined
  }

  updateContent (change) {
    const start = new Delta([{ insert: { 'table-embed': this.d } }])
    const composed = start.compose(new Delta([{ retain: { 'table-embed': change } }]))
    this.d = composed.ops[0].insert['table-embed']
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
const Block = Quill.import('blots/block')
const Break = Quill.import('blots/break')
const Container = Quill.import('blots/container')
const Cursor = Quill.import('blots/cursor')
const Inline = Quill.import('blots/inline')
const Scroll = Quill.import('blots/scroll')
const Text = Quill.import('blots/text')
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
  TableBlot
)

/**
 * @typedef {object} TestData
 * @property {Quill} TestData.editor
 * @property {QuillBinding} TestData.binding
 * @property {Y.Text} type
 */

/**
 * @type {{ [k:string]: import('../src/y-quill.js').EmbedDef }}
 */
const embeds = {
  'table-embed': tableEmbed
}

/**
 * @param {any} [y]
 * @return {TestData}
 */
const createQuillEditor = (y = new Y.Doc()) => {
  const type = y.getText('text')
  const editor = new Quill(document.createElement('div'), { registry })
  const binding = new QuillBinding(type, editor, undefined, { embeds })
  return {
    editor, binding, type
  }
}

export const testBasic = () => {
  const ydoc = new Y.Doc()
  const { editor, type } = createQuillEditor(ydoc)
  const { editor: editor2, type: type2 } = createQuillEditor(ydoc)

  editor.updateContents([{
    insert: {
      'table-embed': {
        rows: [
          { insert: { id: '11111111' }, attributes: { height: 20 } }
        ],
        columns: [
          { insert: { id: '22222222' } },
          { insert: { id: '33333333' }, attributes: { width: 30 } },
          { insert: { id: '44444444' } }
        ],
        cells: {
          '1:2': {
            content: [{ insert: 'Hello' }],
            attributes: { align: 'center' }
          }
        }
      }
    }
  }])
  console.log('contents: ', editor.getContents().ops[0])
  t.compare(object.size(editor.getContents().ops[0].insert['table-embed'].cells), 1)
  t.compare(editor.getContents().ops, editor2.getContents().ops)
  console.log('editor.contents', editor.getContents().ops)
  console.log('type.toJSON()', type.toDelta())
  t.compare(type.toDelta(), type2.toDelta())
}
