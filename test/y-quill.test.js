
import * as t from 'lib0/testing.js'
import * as prng from 'lib0/prng.js'
import * as math from 'lib0/math.js'
import * as Y from 'yjs'
import { applyRandomTests } from 'yjs/tests/testHelper.js'

import { QuillBinding, normQuillDelta } from '../src/y-quill.js'
import Quill from 'quill'

/**
 * @typedef {object} TestData
 * @property {any} TestData.editor
 * @property {QuillBinding} TestData.binding
 * @property {Y.Text} type
 */

/**
 * @param {any} [y]
 * @return {TestData}
 */
const createQuillEditor = (y = new Y.Doc()) => {
  const type = y.getText('text')
  const editor = new Quill(document.createElement('div'))
  const binding = new QuillBinding(type, editor)
  return {
    editor, binding, type
  }
}

export const testBasicInsert = () => {
  const { editor, type } = createQuillEditor()
  type.insert(0, 'text')
  t.assert(editor.getText() === 'text\n')
  editor.insertText(0, 'text')
  t.assert(editor.getText() === 'texttext\n')
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
