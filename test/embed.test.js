import * as t from 'lib0/testing.js'
import * as prng from 'lib0/prng.js'
import * as math from 'lib0/math.js'
import * as Y from 'yjs'
import { applyRandomTests } from 'yjs/testHelper'
import Delta from 'quill-delta'

import { QuillBinding, normQuillDelta } from '../src/y-quill.js'
import Quill from 'quill'

const Parchment = Quill.import('parchment')
const BlockEmbed = Quill.import('blots/block/embed')

class DeltaBlot extends BlockEmbed {
  static tagName = 'DIV'
  static blotName = 'delta'

  constructor (scroll, node, value) {
    super(scroll, node)
    /**
     * @type {Delta}
     */
    this.d = new Delta(value)
  }

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
  static value (_domNode) {
    throw new Error('unexpected case')
  }

  /**
   * @param {HTMLElement} domNode
   */
  static formats (domNode) {
    return undefined
  }

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
  DeltaBlot
)

/**
 * @typedef {object} TestData
 * @property {Quill} TestData.editor
 * @property {QuillBinding} TestData.binding
 * @property {Y.Text} type
 */

/**
 * @typedef {{ update: { [v:string]: any } }} KvOp
 */

/**
 * @type {{ [k:string]: import('../src/y-quill.js').EmbedDef }}
 */
const embeds = {
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
      ytext.applyDelta(op)
    },

    /**
     * @param {Y.XmlElement} yxml
     * @param {Array<Y.YEvent>} events
     * @return {Array<import('quill').DeltaOperation>}
     */
    eventsToDelta: (yxml, events) => {
      const ytext = yxml.getAttribute('ytext')
      const ytextevent = events.find(event => event.target === ytext)
      if (ytextevent) {
        return ytextevent.delta
      }
      return {}
    },
    typeToDelta: (yxml) => {
      return yxml.getAttribute('ytext').toDelta()
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
  const editor = new Quill(document.createElement('div'), { registry })
  const binding = new QuillBinding(type, editor, undefined, { embeds })
  return {
    editor, binding, type
  }
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
    const text = charCounter++ + prng.word(gen, 1, 2)
    p.editor.insertText(insertPos, text, attrs)
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