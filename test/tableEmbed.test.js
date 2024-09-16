import * as t from 'lib0/testing.js'
import * as object from 'lib0/object'
import * as Y from 'yjs'
import { normQuillDelta } from 'y-quill'

import { createQuillEditor } from './utils.js'

/**
 * @typedef {import('./utils.js').TestData} TestData
 */

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
  t.compare(object.size(/** @type {any} */ (editor).getContents().ops[0].insert['table-embed'].cells), 1)
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
  t.compare(object.size(/** @type {any} */ (editor).getContents().ops[0].insert['table-embed'].cells), 1)
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
  t.compare(object.size(/** @type {any} */ (editor).getContents().ops[0].insert['table-embed'].cells), 1)
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

export const testMoveColumn = () => {
  const ydoc = new Y.Doc()
  const { editor, type } = createQuillEditor(ydoc)
  const { editor: editor2, type: type2 } = createQuillEditor(ydoc)
  editor.updateContents([{
    insert: {
      'table-embed': {
        rows: [
          { insert: { id: 'a' } }
        ],
        columns: [
          { insert: { id: 'b' } },
          { insert: { id: 'c' } },
          { insert: { id: 'd' } }
        ],
        cells: {
          '1:1': {
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
        columns: [{ delete: 1 }, { retain: 1 }, { insert: { id: 'b' } }]
      }
    }
  }])
  const editorDelta = normQuillDelta(editor.getContents().ops)
  console.log(editorDelta)
  t.compare(editorDelta, [{
    insert: {
      'table-embed': {
        rows: [
          { insert: { id: 'a' } }
        ],
        columns: [
          { insert: { id: 'c' } },
          { insert: { id: 'b' } },
          { insert: { id: 'd' } }
        ]
        // Unfortunately, quill implicitly deletes cells when a column is moved
        // cells: {
        //   '1:2': {
        //     content: [{ insert: 'Hello' }],
        //     attributes: { align: 'center' }
        //   }
        // }
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
