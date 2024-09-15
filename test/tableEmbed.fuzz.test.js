import * as t from 'lib0/testing.js'
import * as object from 'lib0/object'
import * as Y from 'yjs'
import * as prng from 'lib0/prng'
import { createQuillEditor } from './utils.js'

import Delta from 'quill-delta'
import TableEmbed from '../../src/modules/tableEmbed.js'
import { beforeAll, describe, expect, test } from 'vitest'

/**
 * @typedef {Array<import('quill-delta').Op>} Delta
 */

/**
 * @param {t.TestCase} t
 */
const getRandomRowColumnId = t => {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return new Array(8)
    .fill(0)
    .map(() => characters.charAt(prng.int31(t.prng, 0, characters.length - 1)))
    .join('')
}

/**
 * @param {any} obj
 * @param {t.TestCase} t
 * @return {any}
 */
const attachAttributes = (obj, t) => {
  /**
   * @param {t.TestCase} t
   */
  const getRandomAttributes = (t) => {
    const attributeCount = prng.oneOf(t.prng, [1, 4, 8])
    const allowedAttributes = ['align', 'background', 'color', 'font']
    const allowedValues = ['center', 'red', 'left', 'uppercase']
    const attributes = {}
    new Array(attributeCount).fill(0).forEach(() => {
      attributes[prng.oneOf(t.prng, allowedAttributes)] = prng.oneOf(t.prng, allowedValues)
    })
    return attributes
  }
  if (prng.bool(t.prng)) {
    // @ts-expect-error
    obj.attributes = getRandomAttributes(t)
  }
  // @ts-expect-error
  return obj
}

/**
 * @param {t.TestCase} t
 */
const getRandomCellContent = () => {
  const opCount = prng.oneOf(t.prng, [1, 2, 3])
  const delta = new Delta()
  new Array(opCount).fill(0).forEach(() => {
    delta.push(
      attachAttributes({
        insert: new Array(prng.int31(t.prng, 1, 11))
          .fill(0)
          .map(() => prng.oneOf(t.prng, ['a', 'b', 'c', 'c', 'e', 'f', 'g']))
          .join('')
      }, t)
    )
  })
  return delta.ops
}

/**
 * @param {Delta} base
 */
const getRandomChange = base => {
  const table = {}
  const dimension = {
    rows: new Delta(
      base.ops[0].insert['table-embed'].rows || []
    ).length(),
    columns: new Delta(
      base.ops[0].insert['table-embed'].columns || []
    ).length()
  };
  ['rows', 'columns'].forEach((field) => {
    const baseLength = dimension[field]
    const action = prng.oneOf(t.prng, ['insert', 'delete', 'retain'])
    const delta = new Delta()
    switch (action) {
      case 'insert':
        delta.retain(prng.int31(t.prng, 0, baseLength + 1))
        delta.push(
          attachAttributes({ insert: { id: getRandomRowColumnId(t) } }, t)
        )
        break
      case 'delete':
        if (baseLength >= 1) {
          delta.retain(prng.int31(t.prng, 0, baseLength))
          delta.delete(1)
        }
        break
      case 'retain':
        if (baseLength >= 1) {
          delta.retain(prng.int31(t.prng, 0, baseLength))
          delta.push(attachAttributes({ retain: 1 }, t))
        }
        break
      default:
        break
    }
    if (delta.length() > 0) {
      table[field] = delta.ops
    }
  })

  const updateCellCount = prng.oneOf(t.prng, [0, 1, 2, 3])
  new Array(updateCellCount).fill(0).forEach(() => {
    const row = prng.int31(t.prng, 0, dimension.rows)
    const column = prng.int31(t.prng, 0, dimension.columns)
    const cellIdentityToModify = `${row + 1}:${column + 1}`
    table.cells = {
      [cellIdentityToModify]: attachAttributes({
        content: getRandomCellContent(t)
      }, t)
    }
  })
  return new Delta([attachAttributes({ retain: { 'table-embed': table } }, t)])
}

/**
 * @param {number} count
 * @param {t.TestCase} t
 */
const getRandomRowColumnInsert = (count, t) => {
  return new Array(count)
    .fill(0)
    .map(() =>
      attachAttributes({ insert: { id: getRandomRowColumnId(t) } }, t)
    )
}

/**
 * @param {t.TestCase} t
 */
const getRandomBase = (t) => {
  const rowCount = prng.oneOf(t.prng, [0, 1, 2, 3])
  const columnCount = prng.oneOf(t.prng, [0, 1, 2])
  const cellCount = prng.oneOf(t.prng, [0, 1, 2, 3, 4, 5])

  const table = {}
  if (rowCount) table.rows = getRandomRowColumnInsert(rowCount, t)
  if (columnCount) table.columns = getRandomRowColumnInsert(columnCount, t)
  if (cellCount) {
    const cells = {}
    new Array(cellCount).fill(0).forEach(() => {
      const row = prng.int31(t.prng, 0, rowCount)
      const column = prng.int31(t.prng, 0, columnCount)
      const identity = `${row + 1}:${column + 1}`
      const cell = attachAttributes({}, t)
      if (prng.bool(t.prng)) {
        cell.content = getRandomCellContent()
      }
      if (Object.keys(cell).length) {
        cells[identity] = cell
      }
    })
    if (Object.keys(cells).length) table.cells = cells
  }
  return new Delta([{ insert: { 'table-embed': table } }])
}

const runTestCase = () => {
  const base = getRandomBase()
  const change = getRandomChange(base)
  expect(base).toEqual(base.compose(change).compose(change.invert(base)))

  const anotherChange = getRandomChange(base)
  expect(change.compose(change.transform(anotherChange, true))).toEqual(
    anotherChange.compose(anotherChange.transform(change))
  )
}

describe('tableEmbed', () => {
  beforeAll(() => {
    TableEmbed.register()
  })

  test('delta', () => {
    for (let i = 0; i < 20; i += 1) {
      for (let j = 0; j < 1000; j += 1) {
        runTestCase()
      }
    }
  })
})

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
