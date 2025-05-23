import Quill from 'quill'
import { Attributor, Scope } from 'parchment'

const AttributionType = new Attributor('attributionDelete', 'data-attribution-delete', {
  scope: Scope.INLINE
})
const AttributionInsert = new Attributor('attributionInsert', 'data-attribution-insert', {
  scope: Scope.INLINE
})
const AttributionFormat = new Attributor('attributionFormat', 'data-attribution-format', {
  scope: Scope.INLINE
})

/**
 * @param {import('parchment').Registry | typeof Quill} registry
 */
export const register = (registry = Quill) => {
  registry.register(AttributionType)
  registry.register(AttributionInsert)
  registry.register(AttributionFormat)
}
