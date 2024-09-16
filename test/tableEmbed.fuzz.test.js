/**
 * This is the fuzz testing library by quill ported to lib0/testing.
 *
 * https://github.com/slab/quill/blob/b213e1073bac1478649f26e3c0dad50ad0eb2a49/packages/quill/test/fuzz/tableEmbed.spec.ts
 */

import * as t from 'lib0/testing.js'
import * as object from 'lib0/object'
import * as Y from 'yjs'
import * as prng from 'lib0/prng'
import { createQuillEditor } from './utils.js'
import Delta from 'quill-delta'
// @ts-ignore
import { init } from 'yjs/testHelper'
import { normQuillDelta } from 'y-quill'

/**
 * @typedef {Array<import('quill-delta').Op>} DeltaOps
 */

/**
 * @param {prng.PRNG} gen
 */
const getRandomRowColumnId = gen => {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return new Array(8)
    .fill(0)
    .map(() => characters.charAt(prng.int31(gen, 0, characters.length - 1)))
    .join('')
}

/**
 * @param {any} obj
 * @param {prng.PRNG} gen
 * @return {any}
 */
const attachAttributes = (obj, gen) => {
  const getRandomAttributes = () => {
    const attributeCount = prng.oneOf(gen, [1, 4, 8])
    const allowedAttributes = ['align', 'background', 'color', 'font']
    const allowedValues = ['center', 'red', 'left', 'uppercase']
    /**
     * @type {Record<string,any>}
     */
    const attributes = {}
    new Array(attributeCount).fill(0).forEach(() => {
      attributes[prng.oneOf(gen, allowedAttributes)] = prng.oneOf(gen, allowedValues)
    })
    return attributes
  }
  if (prng.bool(gen)) {
    obj.attributes = getRandomAttributes()
  }
  return obj
}

/**
 * @param {prng.PRNG} gen
 */
const getRandomCellContent = (gen) => {
  const opCount = prng.oneOf(gen, [1, 2, 3])
  const delta = new Delta()
  new Array(opCount).fill(0).forEach(() => {
    delta.push(
      attachAttributes({
        insert: new Array(prng.int31(gen, 1, 11))
          .fill(0)
          .map(() => prng.oneOf(gen, ['a', 'b', 'c', 'c', 'e', 'f', 'g']))
          .join('')
      }, gen)
    )
  })
  return delta.ops
}

/**
 * @param {prng.PRNG} gen
 * @param {Delta} base
 */
const getRandomChange = (gen, base) => {
  /**
   * @type {any}
   */
  const table = {}
  const embed = /** @type {Record<string,any>} */ (base.ops[0]?.insert)['table-embed']
  const dimension = {
    rows: new Delta(
      embed.rows || []
    ).length(),
    columns: new Delta(
      embed.columns || []
    ).length()
  };
  /** @type {const} */ (['rows', 'columns']).forEach((field) => {
    const baseLength = dimension[field]
    const action = prng.oneOf(gen, ['insert', 'delete', 'retain'])
    const delta = new Delta()
    switch (action) {
      case 'insert':
        delta.retain(prng.int31(gen, 0, baseLength))
        delta.push(
          attachAttributes({ insert: { id: getRandomRowColumnId(gen) } }, gen)
        )
        dimension[field]++
        break
      case 'delete':
        if (baseLength >= 1) {
          delta.retain(prng.int31(gen, 0, baseLength - 1))
          delta.delete(1)
          dimension[field]--
        }
        break
      case 'retain':
        if (baseLength >= 1) {
          delta.retain(prng.int31(gen, 0, baseLength - 1))
          delta.push(attachAttributes({ retain: 1 }, gen))
        }
        break
      default:
        break
    }
    if (delta.length() > 0) {
      table[field] = delta.ops
    }
  })

  const updateCellCount = prng.oneOf(gen, [0, 1, 2, 3])
  if (dimension.columns > 0 && dimension.rows > 0) {
    new Array(updateCellCount).fill(0).forEach(() => {
      const row = prng.int31(gen, 0, dimension.rows - 1)
      const column = prng.int31(gen, 0, dimension.columns - 1)
      const cellIdentityToModify = `${row + 1}:${column + 1}`
      table.cells = {
        [cellIdentityToModify]: attachAttributes({
          content: getRandomCellContent(gen)
        }, gen)
      }
    })
  }
  return new Delta([attachAttributes({ retain: { 'table-embed': table } }, gen)])
}

/**
 * @param {number} count
 * @param {prng.PRNG} gen
 */
const getRandomRowColumnInsert = (count, gen) => {
  return new Array(count)
    .fill(0)
    .map(() =>
      attachAttributes({ insert: { id: getRandomRowColumnId(gen) } }, gen)
    )
}

/**
 * @param {prng.PRNG} gen
 */
const getRandomBase = (gen) => {
  const rowCount = prng.oneOf(gen, [1, 2, 3])
  const columnCount = prng.oneOf(gen, [1, 2])
  const cellCount = prng.oneOf(gen, [0, 1, 2, 3, 4, 5])
  const table = {}
  if (rowCount) table.rows = getRandomRowColumnInsert(rowCount, gen)
  if (columnCount) table.columns = getRandomRowColumnInsert(columnCount, gen)
  if (cellCount) {
    /**
     * @type {Record<string,any>}
     */
    const cells = {}
    new Array(cellCount).fill(0).forEach(() => {
      const row = prng.int31(gen, 0, rowCount - 1)
      const column = prng.int31(gen, 0, columnCount - 1)
      const identity = `${row + 1}:${column + 1}`
      const cell = attachAttributes({}, gen)
      if (prng.bool(gen)) {
        cell.content = getRandomCellContent(gen)
      }
      if (Object.keys(cell).length) {
        cells[identity] = cell
      }
    })
    if (Object.keys(cells).length) table.cells = cells
  }
  return new Delta([{ insert: { 'table-embed': table } }])
}

/**
 * This is the fuzz testing library by quill ported to lib0/testing.
 *
 * @param {t.TestCase} tc
 */
export const testRepeatTableEmbedFuzz = (tc) => {
  const base = getRandomBase(tc.prng)
  const change = getRandomChange(tc.prng, base)
  const res1 = base.compose(change).compose(change.invert(base))
  t.compare(base.ops, res1.ops)
  const anotherChange = getRandomChange(tc.prng, base)
  t.compare(change.compose(change.transform(anotherChange, true)).ops, anotherChange.compose(anotherChange.transform(change)).ops)
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
  t.compare(object.size(/** @type {any} */ (editor).getContents().ops[0].insert['table-embed'].cells), 1)
  t.compare(editor.getContents().ops, editor2.getContents().ops)
  console.log('editor.contents', editor.getContents().ops)
  console.log('type.toJSON()', type.toDelta())
  t.compare(type.toDelta(), type2.toDelta())
}

/**
 * @typedef {object} TestData
 * @property {import('quill').default} TestData.editor
 * @property {import('y-quill').QuillBinding} TestData.binding
 * @property {Y.Text} type
 */

/**
 * @type Array<function(any,prng.PRNG,TestData):void>
 */
const qChanges = [
  /**
   * @param {Y.Doc} _y
   * @param {prng.PRNG} gen
   * @param {TestData} p
   */
  (_y, gen, p) => {
    const content = p.editor.getContents().ops
    const baseEmbed = content[0]
    if (baseEmbed == null || baseEmbed.insert == null || /** @type {any} */ (baseEmbed).insert['table-embed'] == null) {
      const base = getRandomBase(gen)
      p.editor.updateContents(base)
    }
    const base = p.editor.getContents()
    const change = getRandomChange(gen, base)
    p.editor.updateContents(change)
  }
]

/**
 * @template T
 * @param {t.TestCase} tc
 * @param {Array<function(Y.Doc,prng.PRNG,T):void>} mods
 * @param {number} iterations
 * @param {(ydoc:Y.Doc)=>T} [initTestObject]
 */
const applyRandomTests = (tc, mods, iterations, initTestObject) => {
  const gen = tc.prng
  const result = init(tc, { users: 5 }, initTestObject)
  const { testConnector, users } = result
  for (let i = 0; i < iterations; i++) {
    if (prng.int32(gen, 0, 100) <= 2) {
      // 2% chance to disconnect/reconnect a random user
      if (prng.bool(gen)) {
        testConnector.disconnectRandom()
      } else {
        testConnector.reconnectRandom()
      }
    } else if (prng.int32(gen, 0, 100) <= 1) {
      // 1% chance to flush all
      testConnector.flushAllMessages()
    } else if (prng.int32(gen, 0, 100) <= 50) {
      // 50% chance to flush a random message
      testConnector.flushRandomMessage()
    }
    const user = prng.int32(gen, 0, users.length - 1)
    const test = prng.oneOf(gen, mods)
    test(users[user], gen, result.testObjects[user])
    users.forEach(/** @param {any} u */ u => u.connect())
    while (users[0].tc.flushAllMessages()) {} // eslint-disable-line
  }
  return result
}

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
export const testRepeatGenerateTableEmbedChanges1 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 1, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTableEmbedChanges2 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 2, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTableEmbedChanges3 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 3, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTableEmbedChanges10 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 10, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTableEmbedChanges100 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 100, createQuillEditor))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTableEmbedChanges300 = tc => {
  checkResult(applyRandomTests(tc, qChanges, 300, createQuillEditor))
}
