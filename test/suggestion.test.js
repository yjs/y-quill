import Quill from 'quill'
import * as t from 'lib0/testing'
import * as Y from 'yjs'
import { QuillBinding } from '../src/y-quill.js'
import { register as registerSuggestionBlot } from '../src/blots/suggestion.js'
import { registry, embeds } from './utils.js'

registerSuggestionBlot(registry)

/**
 * @param {Y.Doc} [ydoc]
 */
const createQuillEditor = (ydoc = new Y.Doc()) => {
  const suggestionDoc = Y.cloneDoc(ydoc)
  ydoc.on('update', update => {
    Y.applyUpdate(suggestionDoc, update)
  })
  const attributionManager = Y.createAttributionManagerFromDiff(ydoc, suggestionDoc)
  const ytext = ydoc.getText('text')
  const suggestionYText = suggestionDoc.getText('text')
  const editor = new Quill(document.createElement('div'), { registry })
  const binding = new QuillBinding(suggestionYText, editor, undefined, { embeds, attributionManager })
  return {
    editor, binding, suggestionYText, ytext, attributionManager, ydoc, suggestionDoc
  }
}

export const testInsert = () => {
  const { editor, ytext, suggestionYText } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.insert(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
}

export const testDelete = () => {
  const { editor, ytext, suggestionYText } = createQuillEditor()
  ytext.insert(0, 'hello world')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.delete(0, 6)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ', attributes: { attributionDelete: 'unknown' } }, { insert: 'world\n' }])
}

export const testDeleteSuggestedContent = () => {
  const { editor, ytext, suggestionYText } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.insert(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
  suggestionYText.delete(6, 5)
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'hello \n' }])
}

export const testDeleteSuggestedContent2 = () => {
  const { editor, ytext, suggestionYText } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  suggestionYText.insert(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
  editor.deleteText(6, 1)
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'hello ' }, { insert: 'orld', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
}
export const testQuillInsert = () => {
  const { editor, ytext, suggestionYText } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  editor.insertText(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
}

export const testQuillDelete = () => {
  const { editor, ytext, suggestionYText } = createQuillEditor()
  ytext.insert(0, 'hello world')
  t.assert(suggestionYText.toString() === ytext.toString())
  editor.deleteText(0, 6)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ', attributes: { attributionDelete: 'unknown' } }, { insert: 'world\n' }])
}

export const testQuillDeleteSuggestedContent = () => {
  const { editor, ytext, suggestionYText } = createQuillEditor()
  ytext.insert(0, 'hello ')
  t.assert(suggestionYText.toString() === ytext.toString())
  editor.insertText(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
  editor.deleteText(6, 5)
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'hello \n' }])
}

export const testQuillInsertAfterSuggestion = () => {
  const { editor, ytext, suggestionYText } = createQuillEditor()
  ytext.insert(0, 'hello ')
  suggestionYText.delete(0, 6)
  editor.insertText(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello ', attributes: { attributionDelete: 'unknown' } }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
}

export const testQuillDeleteAfterSuggestion = () => {
  const { editor, ytext, suggestionYText } = createQuillEditor()
  ytext.insert(0, ' world')
  suggestionYText.insert(0, 'hello')
  editor.deleteText(6, 5)
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello', attributes: { attributionInsert: 'unknown' } }, { insert: ' ' }, { insert: 'world', attributes: { attributionDelete: 'unknown' } }, { insert: '\n' }])
}

export const testQuillDeleteSuggestedContentAfterSuggestion = () => {
  const { editor, ytext, suggestionYText } = createQuillEditor()
  ytext.insert(0, ' ')
  suggestionYText.insert(0, 'hello')
  editor.insertText(6, 'world')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hello', attributes: { attributionInsert: 'unknown' } }, { insert: ' ' }, { insert: 'world', attributes: { attributionInsert: 'unknown' } }, { insert: '\n' }])
  editor.deleteText(6, 5)
  const editorContent2 = editor.getContents().ops
  t.compare(editorContent2, [{ insert: 'hello', attributes: { attributionInsert: 'unknown' } }, { insert: ' \n' }])
}

export const testAcceptSuggestions = () => {
  const { editor, ytext, suggestionYText, ydoc, suggestionDoc } = createQuillEditor()
  suggestionDoc.on('update', update => { Y.applyUpdate(ydoc, update) })
  editor.insertText(0, 'hi ')
  editor.insertText(3, 'there')
  const editorContent = editor.getContents().ops
  t.compare(editorContent, [{ insert: 'hi there\n' }])
}

