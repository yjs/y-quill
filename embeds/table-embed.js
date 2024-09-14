import * as Y from 'yjs'
import * as random from 'lib0/random'
import * as object from 'lib0/object'
import * as error from 'lib0/error'
import * as number from 'lib0/number'

/**
 * @typedef {Array<DeltaOp>} DeltaOps
 */

/**
 * @typedef {{ insert: string, attributes: object? }|{ retain: number, attributes: object }|{ delete: number }} DeltaOp
 */

/**
 * @type {Object} TableDocument
 * @property {Array<{ insert: { id: string }, attributes: any }>} TableDocument.rows
 * @property {Array<{ insert: { id: string }, attributes: any }>} TableDocument.columns
 * @property {{ [key:string]: { content: DeltaOps, attributes: any } }} TableDocument.cells
 */

/**
 * @type {{ [k:string]: import('../src/y-quill.js').EmbedDef }}
 */
export const tableEmbed = {
/**
   * @param {Y.XmlElement} yxml
   * @param {TableDocument} op
   */
  update: (yxml, op) => {
    if (!yxml.hasAttribute('cells')) {
      yxml.setAttribute('cells', new Y.Map())
      yxml.setAttribute('rows', new Y.XmlText())
      yxml.setAttribute('columns', new Y.XmlText())
    }
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
     * @type {Array<string>}
     */
    const rowIndexMap = []
    /**
     * @type {Array<string>}
     */
    const colIndexMap = []

    /**
     * @param {Array<{ insert: { id: string }, attributes: any }|{ retain: number, attributes: any }|{ delete: number }>} changes
     * @param {Y.Text} yline
     * @param {Array<string>} mapping
     */
    const applyLineChange = (changes, yline, mapping) => {
      changes = changes.map(change => {
        if (change.insert != null && change.insert.id == null) {
          return { insert: object.assign({ id: random.uuidv4() }, change.insert), attributes: change.attributes || {} }
        }
        return change
      })
      yline.applyDelta(changes)
      yline.toDelta().forEach(d => {
        if (d.insert == null || d.insert.id == null) error.unexpectedCase()
        mapping.push(d.insert.id)
      })
    }
    applyLineChange(op.rows || [], yrows, rowIndexMap)
    applyLineChange(op.columns || [], ycolumns, colIndexMap)

    object.forEach(op.cells || {}, (cellChange, cellid) => {
      const [rownum, colnum] = cellid.split(':').map(n => number.parseInt(n) - 1)
      const rowid = rowIndexMap[rownum]
      const colid = colIndexMap[colnum]
      if (rowid != null && colid != null) {
        const ycellid = `${rowid}:${colid}`
        const ycell = ycells.get(ycellid) || ycells.set(ycellid, new Y.Text())
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
      } else {
        // can't find index, the user probably inserted an invalid delta
        error.unexpectedCase()
      }
    })
  },
  /**
   * @param {Y.XmlElement} yxml
   * @param {Array<Y.YEvent>} events
   * @return {Array<import('quill').DeltaOperation>}
   */
  eventsToDelta: (yxml, events) => {
    // @todo important! make sure to cleanup duplicate row/col ids here!
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
    const ycellsEvent = events.find(event => event.target === ycells)
    /**
     * @type {Array<Y.YXmlEvent>}
     */
    const ycellEvents = events.filter(event => event.target?.parent === ycells)
    const yrowsEvent = events.find(event => event.target === yrows)
    const ycolsEvent = events.find(event => event.target === ycolumns)

    /**
     * @param {Y.YXmlEvent || null} ylineEvent
     */
    const ylineEventToDelta = (ylineEvent) => {
      return ylineEvent != null ? ylineEvent.delta : []
    }

    /**
     * @type {{ [k:string]: { content: any, attributes: any } }}
     */
    const cells = {}

    if (ycellsEvent) {
      /**
       * @param {Y.XmlText} yline
       * @return {Map<string, number>}
       */
      const createMapping = (yline) => {
        const mapping = new Map()
        yline.toDelta().forEach((d, index) => {
          mapping.set(d.insert.id, index + 1)
        })
        return mapping
      }
      const rowMap = createMapping(yrows)
      const colMap = createMapping(ycolumns)
      const cellIdToIndex = (id) => {
        const [rowid, colid] = id.split(':')
        const rowIndex = rowMap.get(rowid)
        const colIndex = colMap.get(colid)
        if (rowIndex != null && colIndex != null) {
          return `${rowIndex}:${colIndex}`
        } else {
          ycells.delete(id)
        }
      }
      ycellsEvent.changes.keys.forEach((changeType, key) => {
        if (changeType.action === 'delete') {
          cells[cellIdToIndex(key)] = null
        } else {
          const ycell = ycells.get(key)
          cells[cellIdToIndex(key)] = {
            content: ycell.toDelta(),
            attributes: ycell.getAttributes()
          }
        }
      })
      ycellEvents.forEach(ycellEvent => {
        const cellId = ycellEvent.target._item.parentSub
        const cellIndex = cellIdToIndex(cellId)
        /**
         * @type {Object<string,null|string>}
         */
        const attrChanges = {}
        ycellEvent.keys.forEach((change, key) => {
          attrChanges[key] = change.action === 'delete' ? null : ycellEvent.target.getAttribute(key)
        })
        cells[cellIndex] = {
          content: ycellEvent.delta,
          attributes: attrChanges
        }
      })
    }

    const rows = ylineEventToDelta(yrowsEvent)
    const columns = ylineEventToDelta(ycolsEvent)
    return {
      rows, columns, cells
    }
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
    const yToLine = (ylist, mapping) => ylist.toDelta().map((rowOrColumn, index) => {
      // @todo cleanup dpulicate ids here. Also, use Y.map for row.insert!
      const id = rowOrColumn.insert.id
      mapping.set(id, index + 1)
      const res = {
        insert: { id }
      }
      if (rowOrColumn.attributes != null) {
        res.attributes = rowOrColumn.attributes
      }
      return res
    })
    const rows = yToLine(yrows, rowMap)
    const columns = yToLine(ycolumns, colMap)
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
        cells[`${rownum}:${colnum}`] = {
          content: cell.toDelta(),
          attributes: cell.getAttributes()
        }
      } else {
        cellsToDelete.push(key)
      }
    })
    if (cellsToDelete.length > 0) {
      ycells.doc.transact(() => {
        cellsToDelete.forEach(k => {
          ycells.delete(k)
        })
      })
    }
    return {
      rows, columns, cells
    }
  }
}
