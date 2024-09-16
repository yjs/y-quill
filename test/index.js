import * as quill from './y-quill.test.js'
import * as tableEmbed from './tableEmbed.test.js'
import * as tableEmbedFuzz from './tableEmbed.fuzz.test.js'
import * as embed from './embed.test.js'

import { runTests } from 'lib0/testing.js'
import { isBrowser, isNode } from 'lib0/environment.js'
import * as log from 'lib0/logging.js'

if (isBrowser) {
  log.createVConsole(document.body)
}
runTests({
  quill,
  embed,
  tableEmbed,
  tableEmbedFuzz
}).then(success => {
  /* istanbul ignore next */
  if (isNode) {
    process.exit(success ? 0 : 1)
  }
})
