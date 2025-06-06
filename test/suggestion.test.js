import Quill from 'quill'
import * as t from 'lib0/testing'
import * as prng from 'lib0/prng'
import * as math from 'lib0/math'
import * as Y from 'yjs'
import { QuillBinding, normQuillDelta } from '../src/y-quill.js'
import { register as registerSuggestionBlots } from '../src/blots/suggestion.js'
import { registry, embeds } from './utils.js'
import Delta from 'quill-delta'

registerSuggestionBlots(registry)

/**
 * @param {Y.Doc} ydoc1
 * @param {Y.Doc} ydoc2
 */
const simpleSync = (ydoc1, ydoc2) => {
  ydoc1.on('update', update => Y.applyUpdate(ydoc2, update))
  ydoc2.on('update', update => Y.applyUpdate(ydoc1, update))
}

/**
 * @param {Y.Doc} [ydoc]
 */
const createQuillEditor = (ydoc = new Y.Doc()) => {
  ydoc.guid = 'ydoc'
  const suggestionDoc = Y.cloneDoc(ydoc, { isSuggestionDoc: true })
  suggestionDoc.guid = 'suggestionDoc'
  const remoteYdoc = Y.cloneDoc(ydoc)
  remoteYdoc.guid = 'remoteDoc'
  const remoteSuggestionDoc = Y.cloneDoc(ydoc, { isSuggestionDoc: true })
  remoteSuggestionDoc.guid = 'remoteSuggestionDoc'
  simpleSync(ydoc, remoteYdoc)
  simpleSync(remoteSuggestionDoc, suggestionDoc)
  const attributionManager = Y.createAttributionManagerFromDiff(ydoc, suggestionDoc)
  const remoteAttributionManager = Y.createAttributionManagerFromDiff(remoteYdoc, remoteSuggestionDoc)
  const ytext = ydoc.getText('text')
  const suggestionYText = suggestionDoc.getText('text')
  const remoteSuggestionYText = remoteSuggestionDoc.getText('text')
  const editor = new Quill(document.createElement('div'), { registry })
  const binding = new QuillBinding(suggestionYText, editor, undefined, { embeds, attributionManager })
  const remoteEditor = new Quill(document.createElement('div'), { registry })
  const remoteBinding = new QuillBinding(remoteSuggestionYText, remoteEditor, undefined, { embeds, attributionManager: remoteAttributionManager })
  const validate = () => {
    console.log({ 
      localtextcontent: suggestionYText.getDelta(attributionManager).toJSON(),
      remoteytextcontent: remoteSuggestionYText.getDelta(remoteAttributionManager).toJSON(),
      localNoS: ytext.getDelta(attributionManager).toJSON(),
      remoteNoS: remoteYdoc.getText('text').getDelta(remoteAttributionManager).toJSON(),
      localEditor: editor.getContents().ops,
      remoteEditor: remoteEditor.getContents().ops
    })
    t.compare(normQuillDelta(editor.getContents().ops), normQuillDelta(remoteEditor.getContents().ops))
  }
  return {
    editor, binding, suggestionYText, ytext, attributionManager, ydoc, suggestionDoc, remoteYdoc, remoteSuggestionYText, remoteEditor, remoteBinding, validate, remoteAttributionManager, remoteSuggestionDoc
  }
}

export const testInsert = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.insert(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown', suggestion: 'change' } }, { insert: '\n' }])
  validate()
}

export const testDelete = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello world')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.delete(0, 6)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ', attributes: { attributionDelete: 'unknown', suggestion: 'delete' } }, { insert: 'world\n' }])
  validate()
}

export const testDeleteSuggestedContent = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.insert(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown', suggestion: 'change' } }, { insert: '\n' }])
  suggestionYText.delete(6, 5)
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'hello \n' }])
  validate()
}

export const testDeleteSuggestedContent2 = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.insert(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown', suggestion: 'change' } }, { insert: '\n' }])
  editor.deleteText(6, 1)
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'hello ' }, { insert: 'orld', attributes: { attributionInsert: 'unknown', suggestion: 'change' } }, { insert: '\n' }])
  validate()
}

export const testDeleteSuggestedDelete = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello world')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.delete(6, 5)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionDelete: 'unknown', suggestion: 'delete' } }, { insert: '\n' }])
  // nothing should change
  editor.deleteText(7, 1)
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionDelete: 'unknown', suggestion: 'delete' } }, { insert: '\n' }])
  validate()
}

export const testQuillInsert = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  editor.insertText(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown', suggestion: 'change' } }, { insert: '\n' }])
  validate()
}

export const testQuillDelete = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello world')
  t.assert(suggestionYText.toString() === ytext.toString())
  editor.deleteText(0, 6)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ', attributes: { attributionDelete: 'unknown', suggestion: 'delete' } }, { insert: 'world\n' }])
  validate()
}

export const testQuillDeleteSuggestedContent = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  editor.insertText(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown', suggestion: 'change' } }, { insert: '\n' }])
  editor.deleteText(6, 5)
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'hello \n' }])
  validate()
}

export const testQuillInsertAfterSuggestion = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello ')
  suggestionYText.delete(0, 6)
  editor.insertText(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ', attributes: { attributionDelete: 'unknown', suggestion: 'delete' } }, { insert: 'world', attributes: { attributionInsert: 'unknown', suggestion: 'change' } }, { insert: '\n' }])
  validate()
}

export const testQuillDeleteAfterSuggestion = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, ' world')
  suggestionYText.insert(0, 'hello')
  editor.deleteText(6, 5)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello', attributes: { attributionInsert: 'unknown', suggestion: 'change' } }, { insert: ' ' }, { insert: 'world', attributes: { attributionDelete: 'unknown', suggestion: 'delete' } }, { insert: '\n' }])
  validate()
}

export const testQuillDeleteSuggestedContentAfterSuggestion = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, ' ')
  suggestionYText.insert(0, 'hello')
  editor.insertText(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello', attributes: { attributionInsert: 'unknown', suggestion: 'change' } }, { insert: ' ' }, { insert: 'world', attributes: { attributionInsert: 'unknown', suggestion: 'change' } }, { insert: '\n' }])
  editor.deleteText(6, 5)
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'hello', attributes: { attributionInsert: 'unknown', suggestion: 'change' } }, { insert: ' \n' }])
  validate()
}

export const testAcceptInsertSuggestions = () => {
  const { editor, ytext, suggestionYText, attributionManager: am, validate } = createQuillEditor()
  am.suggestionMode = false
  editor.insertText(0, 'hi ')
  editor.insertText(3, 'there')
  const editorContent = editor.getContents().ops
  console.log({ ytext, suggestionYText, c: suggestionYText.getDelta(am) })
  t.compare(editorContent, [{ insert: 'hi there\n' }])
  validate()
}

export const testAcceptDeleteSuggestions = () => {
  const { editor, ytext, attributionManager: am, validate } = createQuillEditor()
  ytext.insert(0, 'hello world')
  am.suggestionMode = false
  editor.deleteText(0, 6)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'world\n' }])
  t.assert(ytext.toString() === 'world')
  validate()
}

export const testAcceptDeleteSuggestions2 = () => {
  const { editor, ytext, suggestionYText, attributionManager: am, validate } = createQuillEditor()
  ytext.insert(0, 'hello world')
  am.suggestionMode = false
  suggestionYText.delete(0, 6)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'world\n' }])
  t.assert(ytext.toString() === 'world')
  validate()
}

export const testQuillInsertNewlineAtEnd = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello')
  editor.insertText(5, '\n')
  suggestionYText.insert(7, '\n')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello\n\n\n' }])
  validate()
}

export const testQuillFormatOfSuggestion = () => {
  const { editor, ytext, suggestionYText, validate, attributionManager } = createQuillEditor()
  attributionManager.suggestionMode = true
  editor.insertText(0, 'hi')
  editor.updateContents([{ retain: 2, attributes: { bold: true } }])
  t.compare(editor.getContents().ops[0], { insert: 'hi', attributes: { bold: true, suggestion: 'change', attributionInsert: 'unknown', attributionFormat: 'unknown' } })
  validate()
}

export const testQuillSuggestedFormatting = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello world!')
  editor.updateContents([{ retain: 6 }, { retain: 5, attributes: { bold: true } }])
  suggestionYText.format(0, 3, { italic: true })
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hel', attributes: { italic: true, attributionFormat: 'unknown', suggestion: 'change' } }, { insert: 'lo ' }, { insert: 'world', attributes: { bold: true, attributionFormat: 'unknown', suggestion: 'change' } }, { insert: '!\n' }])
  editor.updateContents([{ retain: 0 }, { insert: 'XXX', attributes: { bold: true } }])
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'XXX', attributes: { bold: true, attributionInsert: 'unknown', attributionFormat: 'unknown', suggestion: 'change' } }, { insert: 'hel', attributes: { italic: true, attributionFormat: 'unknown', suggestion: 'change' } }, { insert: 'lo ' }, { insert: 'world', attributes: { bold: true, attributionFormat: 'unknown', suggestion: 'change' } }, { insert: '!\n' }])
  validate()
}

export const testPuzzle1 = () => {
  const { editor, ytext, suggestionYText, attributionManager: am, validate } = createQuillEditor()
  ytext.insert(0, '12345')
  editor.updateContents([{ retain: 2 }, { insert: 'X' }, { delete: 2 }])
  am.suggestionMode = false
  editor.updateContents([{ retain: 3 }, { delete: 1 }])
  editor.updateContents([{ retain: 2 }, { delete: 1 }])
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: '12' }, { insert: '4', attributes: { attributionDelete: 'unknown', suggestion: 'delete' } }, { insert: '5\n' }])
  t.compare(suggestionYText.getDelta(am).toJSON(), [{ insert: '12' }, { insert: '4', attribution: { delete: [] } }, { insert: '5' }] )
  validate()
}

/**
 * @typedef {Object} TestData
 * @property {string} Testdata.name
 * @property {Y.Doc} Testdata.ydoc
 * @property {Quill} TestData.editor
 * @property {Y.DiffAttributionManager} TestData.am
 */

let charCounter = 0

const marksChoices = [
  undefined,
  { bold: true },
  { italic: true },
  { italic: true, color: '#888' }
]


/**
 * @type Array<function(Y.Doc,prng.PRNG,TestData):void>
 */
const qChanges = [
  /**
   * @param {Y.Doc} _y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (_y, gen, p) => { // insert text
    const insertPos = prng.int32(gen, 0, p.editor.getText().length)
    const text = charCounter++ + prng.word(gen)
    p.am.suggestionMode = prng.bool(gen)
    t.info(`Insert "${text}" at pos ${insertPos}. suggestionMode: ${p.am.suggestionMode} (${p.name})`)
    p.editor.updateContents([{ retain: insertPos }, { insert: text }])
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
    p.am.suggestionMode = prng.bool(gen)
    t.info(`Delete ${overwrite} chars at pos ${insertPos}. suggestionMode: ${p.am.suggestionMode} (${p.name})`)
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
    p.am.suggestionMode = prng.bool(gen)
    t.info(`Format ${overwrite} chars ${JSON.stringify(format)} at pos ${insertPos}. suggestionMode: ${p.am.suggestionMode} (${p.name})`)
    p.editor.updateContents(new Delta().retain(insertPos).retain(overwrite, format))
  }
]

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateSuggestions = tc => {
  const iterations = 40
  t.info('number of iterations: ' + iterations)
  const data = createQuillEditor()
  /**
   * @type {Array<TestData>}
   */
  const users = [{
    // local user
    name: 'local',
    ydoc: data.suggestionDoc,
    am: data.attributionManager,
    editor: data.editor
  }, {
    // remote user
    name: 'remote',
    ydoc: data.remoteSuggestionDoc,
    am: data.remoteAttributionManager,
    editor: data.remoteEditor
  }]
  qChanges[0](users[0].ydoc, tc.prng, users[0])
  for (let i = 0; i < iterations; i++) {
    const user = prng.oneOf(tc.prng, users)
    const qchange = prng.oneOf(tc.prng, qChanges)
    qchange(user.ydoc, tc.prng, user)
    // data.validate()
  }
  data.validate()
}

