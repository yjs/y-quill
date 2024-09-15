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

export const testComposeAddARow = () => {
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
  editor.updateContents([{
    retain: { 'table-embed': { rows: [{ insert: { id: '55555555' } }] } }
  }])
  const editorDelta = normQuillDelta(editor.getContents().ops)
  console.log(editorDelta)
  t.compare(editorDelta, [{
    insert: {
      'table-embed': {
        rows: [
          { insert: { id: '55555555' } },
          { insert: { id: '11111111' }, attributes: { height: 20 } }
        ],
        columns: [
          { insert: { id: '22222222' } },
          { insert: { id: '33333333' }, attributes: { width: 30 } },
          { insert: { id: '44444444' } }
        ],
        cells: {
          '2:2': {
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

export const testAddsTwoRows = () => {
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
  editor.updateContents([{
    retain: {
      'table-embed': {
        rows: [
          { insert: { id: '55555555' } },
          { insert: { id: '66666666' } }
        ]
      }
    }
  }])
  const editorDelta = normQuillDelta(editor.getContents().ops)
  console.log(editorDelta)
  t.compare(editorDelta, [{
    insert: {
      'table-embed': {
        rows: [
          { insert: { id: '55555555' } },
          { insert: { id: '66666666' } },
          { insert: { id: '11111111' }, attributes: { height: 20 } }
        ],
        columns: [
          { insert: { id: '22222222' } },
          { insert: { id: '33333333' }, attributes: { width: 30 } },
          { insert: { id: '44444444' } }
        ],
        cells: {
          '3:2': {
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

export const testAddsARowAndChangesCellContent = () => {
  const ydoc = new Y.Doc()
  const { editor, type } = createQuillEditor(ydoc)
  const { editor: editor2, type: type2 } = createQuillEditor(ydoc)
  editor.updateContents([{
    insert: {
      'table-embed': {
        rows: [
          { insert: { id: '11111111' } },
          { insert: { id: '22222222' }, attributes: { height: 20 } }
        ],
        columns: [
          { insert: { id: '33333333' } },
          { insert: { id: '44444444' }, attributes: { width: 30 } },
          { insert: { id: '55555555' } }
        ],
        cells: {
          '2:2': { content: [{ insert: 'Hello' }] },
          '2:3': { content: [{ insert: 'World' }] }
        }
      }
    }
  }])
  editor.updateContents([{
    retain: {
      'table-embed': {
        rows: [{ insert: { id: '66666666' } }],
        cells: {
          '3:2': { attributes: { align: 'right' } },
          '3:3': { content: [{ insert: 'Hello ' }] }
        }
      }
    }
  }])
  const editorDelta = normQuillDelta(editor.getContents().ops)
  console.log(editorDelta)
  t.compare(editorDelta, [{
    insert: {
      'table-embed': {
        rows: [
          { insert: { id: '66666666' } },
          { insert: { id: '11111111' } },
          { insert: { id: '22222222' }, attributes: { height: 20 } }
        ],
        columns: [
          { insert: { id: '33333333' } },
          { insert: { id: '44444444' }, attributes: { width: 30 } },
          { insert: { id: '55555555' } }
        ],
        cells: {
          '3:2': {
            content: [{ insert: 'Hello' }],
            attributes: { align: 'right' }
          },
          '3:3': { content: [{ insert: 'Hello World' }] }
        }
      }
    }
  }])
  console.log('contents: ', editor.getContents().ops[0])
  t.compare(editor.getContents().ops, editor2.getContents().ops)
  console.log('editor.contents', editor.getContents().ops)
  console.log('type.toJSON()', type.toDelta())
  t.compare(type.toDelta(), type2.toDelta())
}

export const testDeletesAColumn = () => {
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
  editor.updateContents([{
    retain: {
      'table-embed': {
        columns: [{ retain: 1 }, { delete: 1 }]
      }
    }
  }])
  const editorDelta = normQuillDelta(editor.getContents().ops)
  console.log(editorDelta)
  t.compare(editorDelta, [{
    insert: {
      'table-embed': {
        rows: [
          { insert: { id: '11111111' }, attributes: { height: 20 } }
        ],
        columns: [
          { insert: { id: '22222222' } },
          { insert: { id: '44444444' } }
        ]
      }
    }
  }])
  console.log('contents: ', editor.getContents().ops[0])
  t.compare(editor.getContents().ops, editor2.getContents().ops)
  console.log('editor.contents', editor.getContents().ops)
  console.log('type.toJSON()', type.toDelta())
  t.compare(type.toDelta(), type2.toDelta())
}

export const testRemoveACellAttribute = () => {
  const ydoc = new Y.Doc()
  const { editor, type } = createQuillEditor(ydoc)
  const { editor: editor2, type: type2 } = createQuillEditor(ydoc)
  editor.updateContents([{
    insert: {
      'table-embed': {
        rows: [
          { insert: { id: '111' } }
        ],
        columns: [
          { insert: { id: '222' } }
        ],
        cells: { '1:1': { attributes: { align: 'center' } } }
      }
    }
  }])
  editor.updateContents([
    {
      retain: {
        'table-embed': {
          cells: { '1:1': { attributes: { align: null } } }
        }
      }
    }
  ])
  const editorDelta = normQuillDelta(editor.getContents().ops)
  console.log(editorDelta)
  t.compare(editorDelta, [{
    insert: {
      'table-embed': {
        rows: [
          { insert: { id: '111' } }
        ],
        columns: [
          { insert: { id: '222' } }
        ]
      }
    }
  }])
  console.log('contents: ', editor.getContents().ops[0])
  t.compare(editor.getContents().ops, editor2.getContents().ops)
  console.log('editor.contents', editor.getContents().ops)
  console.log('type.toJSON()', type.toDelta())
  t.compare(type.toDelta(), type2.toDelta())
}

let charCounter = 0

const marksChoices = [
  undefined,
  { bold: true },
  { italic: true },
  { italic: true, color: '#888' }
]

/**
 * @type Array<function(any,prng.PRNG,TestData):void>
 */
const qChanges = [
  /**
   * @param {Y.Doc} _y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (_y, gen, p) => { // insert text
    const insertPos = prng.int32(gen, 0, p.editor.getText().length)
    const attrs = prng.oneOf(gen, marksChoices)
    const text = charCounter++ + prng.word(gen)
    p.editor.insertText(insertPos, text, attrs)
  },
  /**
   * @param {Y.Doc} _y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (_y, gen, p) => { // insert embed
    const insertPos = prng.int32(gen, 0, p.editor.getText().length)
    p.editor.insertEmbed(insertPos, 'image', 'https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png')
  },
  /**
   * @param {Y.Doc} _y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (_y, gen, p) => { // insert custom embed
    const insertPos = prng.int32(gen, 0, p.editor.getText().length)
    p.editor.insertEmbed(insertPos, 'delta', [{ insert: 'some content' }])
  },
  /**
   * @param {Y.Doc} _y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (_y, gen, p) => { // update custom embed
    /**
     * @type {Array<{ len: number, index: number }>}
     */
    const customEmbeds = []
    let index = 0
    p.editor.getContents().forEach(op => {
      if (op.insert != null && typeof op.insert === 'object' && op.insert.delta != null) {
        const len = new Delta(op.insert.delta).length()
        customEmbeds.push({ len, index })
      }
      index += Delta.Op.length(op)
    })
    if (customEmbeds.length === 0) return
    const emb = prng.oneOf(gen, customEmbeds)
    if (prng.bool(gen)) { // option1: insert content
      const insertPos = prng.int32(gen, 0, emb.len)
      const attrs = prng.oneOf(gen, marksChoices)
      const text = charCounter++ + prng.word(gen)
      p.editor.updateContents([{ retain: emb.index }, { delta: [{ retain: insertPos }, { insert: text, attributes: attrs }] }])
    } else { // option2: delete content
      const insertPos = prng.int32(gen, 0, emb.len)
      const overwrite = math.min(prng.int32(gen, 0, emb.len - insertPos), 2)
      p.editor.updateContents([{ retain: emb.index }, { delta: [{ retain: insertPos }, { delete: overwrite }] }])
    }
  },
  /**
   * @param {Y.Doc} _y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (_y, gen, p) => { // delete text
    const contentLen = p.editor.getText().length
    const insertPos = prng.int32(gen, 0, contentLen)
    const overwrite = math.min(prng.int32(gen, 0, contentLen - insertPos), 2)
    p.editor.deleteText(insertPos, overwrite)
  },
  /**
   * @param {Y.Doc} _y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (_y, gen, p) => { // format text
    const contentLen = p.editor.getText().length
    const insertPos = prng.int32(gen, 0, contentLen)
    const overwrite = math.min(prng.int32(gen, 0, contentLen - insertPos), 2)
    const format = prng.oneOf(gen, marksChoices)
    p.editor.format(insertPos, overwrite, format)
  },
  /**
   * @param {Y.Doc} _y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (_y, gen, p) => { // insert codeblock
    const insertPos = prng.int32(gen, 0, p.editor.getText().length)
    const text = charCounter++ + prng.word(gen)
    const ops = []
    if (insertPos > 0) {
      ops.push({ retain: insertPos })
    }
    ops.push({ insert: text }, { insert: '\n', format: { 'code-block': true } })
    p.editor.updateContents(ops)
  }
]

/**
 * @param {any} result
 */
const checkResult = result => {
  for (let i = 1; i < result.testObjects.length; i++) {
    const p1 = normQuillDelta(result.testObjects[i - 1].editor.getContents().ops)
    const p2 = normQuillDelta(result.testObjects[i].editor.getContents().ops)
    t.compare(p1, p2)
  }
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges1 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 1, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges2 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 2, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges3 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 3, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges30 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 30, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges40 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 40, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges70 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 70, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges100 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 100, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges300 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 300, createQuillEditor))
}
