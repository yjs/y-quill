import * as Y from 'yjs'
import * as random from 'lib0/random'
import * as object from 'lib0/object'
import * as error from 'lib0/error'
import * as number from 'lib0/number'

/**
 * @typedef {import('quill-delta').Op} DeltaOp
 */

/**
 * @typedef {Array<DeltaOp>} DeltaOps
 */

/**
 * @typedef {Object} TableDocument
 * @property {Array<{ insert: { id: string }, attributes: any }>} TableDocument.rows
 * @property {Array<{ insert: { id: string }, attributes: any }>} TableDocument.columns
 * @property {{ [key:string]: { content: DeltaOps, attributes: any } }} TableDocument.cells
 */

/**
 * @typedef {Y.XmlElement<{ cells: Y.Map<Y.XmlText>, rows: Y.XmlText, columns: Y.XmlText }>} YTableXmlType
 */

/**
 * @param {Y.Text} ycell
 */
const ycellToDelta = (ycell) => {
  const attributes = ycell.getAttributes()
  /**
   * @type {any}
   */
  const res = {
    content: ycell.toDelta(),
    attributes
  }
  if (object.isEmpty(attributes)) {
    delete res.attributes
  }
  if (res.content.length === 0) {
    delete res.content
  }
  return res
}

/**
 * @type {import('y-quill').EmbedDef<any, any>}
 */
export const tableEmbed = {
/**
   * @param {YTableXmlType} yxmlTable
   * @param {TableDocument} op
   * @param {import('y-quill').QuillBinding} _binding
   */
  update: (yxmlTable, op, _binding) => {
    if (!yxmlTable.hasAttribute('cells')) {
      yxmlTable.setAttribute('cells', new Y.Map())
      yxmlTable.setAttribute('rows', new Y.XmlText())
      yxmlTable.setAttribute('columns', new Y.XmlText())
    }
    const ycells = /** @type {Y.Map<Y.XmlText>} */ (yxmlTable.getAttribute('cells'))
    const yrows = /** @type {Y.XmlText} */ (yxmlTable.getAttribute('rows'))
    const ycolumns = /** @type {Y.XmlText} */ (yxmlTable.getAttribute('columns'))
    /**
     * @type {Array<string>}
     */
    const rowIndexMap = []
    /**
     * @type {Array<string>}
     */
    const colIndexMap = []
    /**
     * @param {DeltaOps} changes
     * @param {Y.Text} yline
     * @param {Array<string>} mapping
     */
    const applyLineChange = (changes, yline, mapping) => {
      changes = changes.map(change => {
        if (change.insert != null && /** @type {any} */ (change).insert.id == null) {
          return { insert: object.assign({ id: random.uuidv4() }, change.insert), attributes: change.attributes || {} }
        }
        return change
      })
      yline.applyDelta(changes)
      yline.toDelta().forEach(/** @param {{ insert: { id: string }} }  d */ d => {
        if (d.insert == null || d.insert.id == null) error.unexpectedCase()
        mapping.push(d.insert.id)
      })
    }
    applyLineChange(op.rows || [], yrows, rowIndexMap)
    applyLineChange(op.columns || [], ycolumns, colIndexMap)

    /**
     * @param {Y.XmlText} _yline
     * @param {number} index
     * @param {Array<string>} mapping
     * @param {'rows'|'columns'} lineName
     * @return {string}
     */
    const ensureLineId = (_yline, index, mapping, lineName) => {
      const id = mapping[index]
      if (id != null) return id
      throw new Error(`Cell doesn't belong to a ${lineName}. Must insert ${lineName} with id.`)
    }

    object.forEach(op.cells || {}, (cellChange, cellid) => {
      const [rownum, colnum] = cellid.split(':').map(n => number.parseInt(n) - 1)
      const rowid = ensureLineId(yrows, rownum, rowIndexMap, 'rows')
      const colid = ensureLineId(ycolumns, colnum, colIndexMap, 'columns')
      const ycellid = `${rowid}:${colid}`
      const ycell = ycells.get(ycellid) || ycells.set(ycellid, new Y.XmlText())
      object.forEach(cellChange.attributes || {}, (attrChange, attrKey) => {
        if (attrChange === null) {
          ycell.removeAttribute(attrKey)
        } else {
          ycell.setAttribute(attrKey, attrChange)
        }
      })
      if (cellChange.content != null) {
        ycell.applyDelta(cellChange.content)
      }
    })
  },
  /**
   * @param {YTableXmlType} yxml
   * @param {Array<Y.YEvent<any>>} events
   */
  eventsToDelta: (yxml, events) => {
    const ycells = /** @type {Y.Map<Y.XmlText>} */ (yxml.getAttribute('cells'))
    const yrows = /** @type {Y.XmlText} */ (yxml.getAttribute('rows'))
    const ycolumns = /** @type {Y.XmlText} */ (yxml.getAttribute('columns'))
    const ycellsEvent = events.find(event => event.target === ycells)
    const ycellEvents = /** @type {Array<Y.YXmlEvent>} */ (events.filter(event => event.target?.parent === ycells))
    const yrowsEvent = /** @type {Y.YXmlEvent} */ (events.find(event => event.target === yrows))
    const ycolsEvent = /** @type {Y.YXmlEvent} */ (events.find(event => event.target === ycolumns))

    /**
     * @param {Y.YXmlEvent|undefined} ylineEvent
     */
    const ylineEventToDelta = (ylineEvent) => {
      return ylineEvent != null ? ylineEvent.delta : []
    }

    /**
     * @type {{ [k:string]: { content: any, attributes?: any } | null }}
     */
    const cells = {}

    /**
     * @param {Y.XmlText} yline
     * @return {Map<string, number>}
     */
    const createMapping = (yline) => {
      const mapping = new Map()
      let index = 0
      yline.toDelta().forEach(/** @type {(d:any,index:number) => void} */ (d) => {
        const existingIndex = mapping.get(d.insert.id)
        if (existingIndex != null) {
          yline.delete(index, 1)
        }
        mapping.set(d.insert.id, index + 1)
        index++
      })
      return mapping
    }
    const rowMap = createMapping(yrows)
    const colMap = createMapping(ycolumns)
    /**
     * @param {string} id
     */
    const cellIdToIndex = (id) => {
      const [rowid, colid] = id.split(':')
      const rowIndex = rowMap.get(rowid)
      const colIndex = colMap.get(colid)
      if (rowIndex != null && colIndex != null) {
        return `${rowIndex}:${colIndex}`
      } else {
        ycells.delete(id)
        return 'undefined'
      }
    }
    ycellsEvent?.changes.keys.forEach((changeType, key) => {
      if (changeType.action !== 'delete') {
        const ycell = /** @type {Y.XmlText} */ (ycells.get(key))
        cells[cellIdToIndex(key)] = ycellToDelta(ycell)
      }
    })
    ycellEvents?.forEach(ycellEvent => {
      const cellId = /** @type {string} */ (/** @type {Y.Item} */ (ycellEvent.target._item).parentSub)
      const cellIndex = cellIdToIndex(cellId)
      /**
       * @type {Object<string,null|string>}
       */
      const attrChanges = {}
      ycellEvent.keys.forEach((change, key) => {
        attrChanges[key] = change.action === 'delete' ? null : /** @type {Y.XmlText} */ (ycellEvent.target).getAttribute(key)
      })
      cells[cellIndex] = {
        content: ycellEvent.delta,
        attributes: attrChanges
      }
    })
    const rows = ylineEventToDelta(yrowsEvent)
    const columns = ylineEventToDelta(ycolsEvent)
    delete cells.undefined
    /**
     * @type {any}
     */
    const res = {
      rows, columns, cells
    }
    if (object.isEmpty(cells)) delete res.cells
    if (res.rows.length === 0) delete res.rows
    if (res.columns.length === 0) delete res.columns
    return res
  },
  typeToDelta: (yxml) => {
    /**
     * @type {Y.Map<Y.XmlText>}
     */
    const ycells = yxml.getAttribute('cells')
    /**
     * @type {Y.XmlText}
     */
    const yrows = yxml.getAttribute('rows')
    /**
     * @type {Y.XmlText}
     */
    const ycolumns = yxml.getAttribute('columns')
    /**
     * @type {Map<string,number>}
     */
    const rowMap = new Map()
    /**
     * @type {Map<string,number>}
     */
    const colMap = new Map()
    /**
     * @param {Y.Text} ylist
     * @param {Map<string,number>} idMapping
     */
    const yToLine = (ylist, idMapping) => {
      let index = 0
      return /** @type {DeltaOps} */ (ylist.toDelta()).map((rowOrColumn) => {
        if (typeof rowOrColumn.insert === 'string' || rowOrColumn.insert?.id == null) {
          return null
        }
        const id = /** @type {string} */ (rowOrColumn.insert.id)
        const existingIndex = idMapping.get(id)
        if (existingIndex != null) {
          // index already exists. Delete this one.
          ylist.delete(index, 1)
          return null
        }
        idMapping.set(id, index + 1)
        /**
       * @type {any}
       */
        const res = {
          insert: { id }
        }
        if (rowOrColumn.attributes != null) {
          res.attributes = rowOrColumn.attributes
        }
        index++
        return res
      }).filter(x => x != null)
    }
    const rows = yToLine(yrows, rowMap)
    const columns = yToLine(ycolumns, colMap)
    /**
     * @type {Record<string,any>}
     */
    const cells = {}
    /**
     * @type Array<string>
     */
    const cellsToDelete = []
    ycells.forEach((cell, key) => {
      const [rowid, colid] = key.split(':')
      const rownum = rowMap.get(rowid)
      const colnum = colMap.get(colid)
      if (rownum != null && colnum != null) {
        cells[`${rownum}:${colnum}`] = ycellToDelta(cell)
      } else {
        cellsToDelete.push(key)
      }
    })
    if (cellsToDelete.length > 0) {
      /** @type {Y.Doc} */ (ycells.doc).transact(() => {
        cellsToDelete.forEach(k => {
          ycells.delete(k)
        })
      })
    }
    /**
     * @type {any}
     */
    const res = {
      rows, columns, cells
    }
    if (object.isEmpty(cells)) delete res.cells
    if (columns.length === 0) delete res.columns
    if (rows.length === 0) delete res.rows
    return res
  }
}
