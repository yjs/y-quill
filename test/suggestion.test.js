import Quill from 'quill'
import * as t from 'lib0/testing'
import * as Y from 'yjs'
import { QuillBinding } from '../src/y-quill.js'
import { register as registerSuggestionBlot } from '../src/blots/suggestion.js'
import { registry, embeds } from './utils.js'

registerSuggestionBlot(registry)

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
  const suggestionDoc = Y.cloneDoc(ydoc)
  const remoteYdoc = Y.cloneDoc(ydoc)
  const remoteSuggestionDoc = Y.cloneDoc(ydoc)
  ydoc.on('update', update => {
    Y.applyUpdate(suggestionDoc, update)
  })
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
    t.compare(editor.getContents().ops, remoteEditor.getContents().ops)
  }
  return {
    editor, binding, suggestionYText, ytext, attributionManager, ydoc, suggestionDoc, remoteYdoc, remoteSuggestionYText, remoteEditor, remoteBinding, validate
  }
}

export const testInsert = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.insert(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
  validate()
}

export const testDelete = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello world')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.delete(0, 6)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ', attributes: { attributionDelete: 'unknown' } }, { insert: 'world\n' }])
  validate()
}

export const testDeleteSuggestedContent = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.insert(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
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
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
  editor.deleteText(6, 1)
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'hello ' }, { insert: 'orld', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
  validate()
}
export const testQuillInsert = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  editor.insertText(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
  validate()
}

export const testQuillDelete = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello world')
  t.assert(suggestionYText.toString() === ytext.toString())
  editor.deleteText(0, 6)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ', attributes: { attributionDelete: 'unknown' } }, { insert: 'world\n' }])
  validate()
}

export const testQuillDeleteSuggestedContent = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  editor.insertText(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
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
  t.compare(editorContent, [{ insert: 'hello ', attributes: { attributionDelete: 'unknown' } }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
  validate()
}

export const testQuillDeleteAfterSuggestion = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, ' world')
  suggestionYText.insert(0, 'hello')
  editor.deleteText(6, 5)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello', attributes: { attributionInsert: 'unknown' } }, { insert: ' ' }, { insert: 'world', attributes: { attributionDelete: 'unknown' } }, { insert: '\n' }])
  validate()
}

export const testQuillDeleteSuggestedContentAfterSuggestion = () => {
  const { editor, ytext, suggestionYText, validate } = createQuillEditor()
  ytext.insert(0, ' ')
  suggestionYText.insert(0, 'hello')
  editor.insertText(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello', attributes: { attributionInsert: 'unknown' } }, { insert: ' ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
  editor.deleteText(6, 5)
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'hello', attributes: { attributionInsert: 'unknown' } }, { insert: ' \n' }])
  validate()
}

export const testAcceptInsertSuggestions = () => {
  const { editor, ytext, suggestionYText, ydoc, suggestionDoc, validate } = createQuillEditor()
  suggestionDoc.on('update', update => { Y.applyUpdate(ydoc, update) })
  editor.insertText(0, 'hi ')
  editor.insertText(3, 'there')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hi there\n' }])
  validate()
}

export const testAcceptDeleteSuggestions = () => {
  const { editor, ytext, suggestionYText, ydoc, suggestionDoc, validate } = createQuillEditor()
  ytext.insert(0, 'hello world')
  suggestionDoc.on('update', update => { Y.applyUpdate(ydoc, update) })
  editor.deleteText(0, 6)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'world\n' }])
  t.assert(ytext.toString() === 'world')
  validate()
}

export const testAcceptDeleteSuggestions2 = () => {
  const { editor, ytext, suggestionYText, ydoc, suggestionDoc, validate } = createQuillEditor()
  ytext.insert(0, 'hello world')
  suggestionDoc.on('update', update => { Y.applyUpdate(ydoc, update) })
  suggestionYText.delete(0, 6)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'world\n' }])
  t.assert(ytext.toString() === 'world')
  validate()
}

