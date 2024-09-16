import * as t from 'lib0/testing.js'
import * as prng from 'lib0/prng.js'
import * as math from 'lib0/math.js'
// @ts-ignore
import { applyRandomTests } from 'yjs/testHelper'
import Delta from 'quill-delta'
import { createQuillEditor } from './utils.js'
import { normQuillDelta } from '../src/y-quill.js'
import * as Y from 'yjs' // eslint-disable-line

/**
 * @typedef {import('./utils.js').TestData} TestData
 */

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
    const text = charCounter++ + prng.word(gen, 1, 2)
    p.editor.updateContents(new Delta().retain(insertPos).insert(text, attrs))
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
        const len = new Delta(/** @type {any} */ (op.insert).delta).length()
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
      p.editor.updateContents(new Delta().retain(emb.index).retain({ delta: new Delta().retain(insertPos).insert(text, attrs).ops }))
    } else { // option2: delete content
      const insertPos = prng.int32(gen, 0, emb.len)
      const overwrite = math.min(prng.int32(gen, 0, emb.len - insertPos), 2)
      p.editor.updateContents(new Delta().retain(emb.index).retain({ delta: new Delta().retain(insertPos).delete(overwrite).ops }))
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
  }
]

/**
 * @param {{ testObjects: Array<TestData> }} result
 */
const checkResult = result => {
  // all "delta" custom embeds are transformed to Y.XmlElements
  t.assert(result.testObjects[0].type.toDelta().every(/** @param {any} d */ d => {
    return d.insert == null || d.insert.delta == null
  }))
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
export const testRepeatGenerateQuillChanges5 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 5, createQuillEditor))
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
