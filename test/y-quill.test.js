import * as t from 'lib0/testing.js'
import * as prng from 'lib0/prng.js'
import * as math from 'lib0/math.js'
import * as Y from 'yjs'
import { applyRandomTests } from 'yjs/testHelper'
import Delta from 'quill-delta'
import * as object from 'lib0/object'

import { QuillBinding, normQuillDelta } from '../src/y-quill.js'
import Quill from 'quill'

/**
 * @typedef {object} TestData
 * @property {any} TestData.editor
 * @property {QuillBinding} TestData.binding
 * @property {Y.Text} type
 */

/**
 * @typedef {{ update: { [v:string]: any } }} KvOp
 */

const embeds = {
  kv: {
    /**
     * @param {Y.XmlElement} yxml
     * @param {KvOp} op
     */
    update: (yxml, op) => {
      if (op.update !== undefined) {
        for (const key in op.update) {
          yxml.setAttribute(key, op.update[key])
        }
      }
    },
    /**
     * @param {Y.XmlElement} yxml
     * @param {Y.YXmlEvent} event
     * @return {KvOp}
     */
    eventToDelta: (yxml, event) => {
      /**
       * @type {KvOp}
       */
      const op = {
        update: {}
      }
      object.forEach(event.changes.keys, (v, k) => {
        if (v.action === 'add' || v.action === 'update') {
          op.update[k] = yxml.getAttribute(k)
        }
      })
      return op
    }
  },
  delta: {
    /**
     * @param {Y.XmlElement} yxml
     * @param {Array<import('quill').DeltaOperation>} op
     */
    update: (yxml, op) => {
      if (!yxml.hasAttribute('ytext')) {
        yxml.setAttribute('ytext', new Y.Text())
      }
      const ytext = yxml.getAttribute('ytext')
      ytext.apply(op)
    },
    /**
     * @param {Y.XmlElement} _yxml
     * @param {Y.YXmlEvent} event
     * @return {Array<import('quill').DeltaOperation>}
     */
    eventToDelta: (_yxml, event) => {
      return event.delta
    }
  }
}

Delta.registerEmbed('delta', {
  compose: (a, b) => new Delta(a).compose(new Delta(b)).ops,
  transform: (a, b, priority) =>
    new Delta(a).transform(new Delta(b), priority).ops,
  invert: (a, b) => new Delta(a).invert(new Delta(b)).ops
})

/**
 * @param {any} [y]
 * @return {TestData}
 */
const createQuillEditor = (y = new Y.Doc()) => {
  const type = y.getText('text')
  const editor = new Quill(document.createElement('div'))
  const binding = new QuillBinding(type, editor, undefined, { embeds })
  return {
    editor, binding, type
  }
}

export const testCustomEmbedBasic = () => {
  const { editor, type } = createQuillEditor()
  type.insert(0, 'text')
  t.assert(editor.getText() === 'text\n')
  editor.insertText(0, 'text')
  t.assert(editor.getText() === 'texttext\n')
}

export const testBasicInsert = () => {
  const { editor, type } = createQuillEditor()
  type.insert(0, 'text')
  t.assert(editor.getText() === 'text\n')
  editor.insertText(0, 'text')
  t.assert(editor.getText() === 'texttext\n')
}

/**
 * @param {t.TestCase} tc
 */
export const testConcurrentOverlappingFormatting = tc => {
  const { editor, type } = createQuillEditor()
  const { editor: editor2, type: type2 } = createQuillEditor()
  type.insert(0, 'abcdef')
  Y.applyUpdate(type2.doc, Y.encodeStateAsUpdate(type.doc))
  editor.updateContents([{ retain: 3, attributes: { bold: true } }])
  editor2.updateContents([{ retain: 2 }, { retain: 2, attributes: { bold: true } }])
  // sync
  Y.applyUpdate(type.doc, Y.encodeStateAsUpdate(type2.doc))
  Y.applyUpdate(type2.doc, Y.encodeStateAsUpdate(type.doc))
  console.log(editor.getContents().ops)
  console.log(editor2.getContents().ops)
  t.compare(editor.getContents().ops, editor2.getContents().ops)
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
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (y, gen, p) => { // insert text
    const insertPos = prng.int32(gen, 0, p.editor.getText().length)
    const attrs = prng.oneOf(gen, marksChoices)
    const text = charCounter++ + prng.word(gen)
    p.editor.insertText(insertPos, text, attrs)
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (y, gen, p) => { // insert embed
    const insertPos = prng.int32(gen, 0, p.editor.getText().length)
    p.editor.insertEmbed(insertPos, 'image', 'https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png')
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (y, gen, p) => { // delete text
    const contentLen = p.editor.getText().length
    const insertPos = prng.int32(gen, 0, contentLen)
    const overwrite = math.min(prng.int32(gen, 0, contentLen - insertPos), 2)
    p.editor.deleteText(insertPos, overwrite)
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (y, gen, p) => { // format text
    const contentLen = p.editor.getText().length
    const insertPos = prng.int32(gen, 0, contentLen)
    const overwrite = math.min(prng.int32(gen, 0, contentLen - insertPos), 2)
    const format = prng.oneOf(gen, marksChoices)
    p.editor.format(insertPos, overwrite, format)
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (y, gen, p) => { // insert codeblock
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
