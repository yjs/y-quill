# y-quill

> [Quill Editor](https://quilljs.com/) binding for [Yjs](https://github.com/y-js/yjs) - [Demo](https://demos.yjs.dev/quill/quill.html)

This binding maps a Y.Text to a Quill instance. It optionally supports shared cursors via
the [quill-cursors](https://github.com/reedsy/quill-cursors) module.

## Example

```js
import { QuillBinding } from 'y-quill'
import Quill from 'quill'
import QuillCursors from 'quill-cursors'

..

Quill.register('modules/cursors', QuillCursors)

const type = ydoc.getText('quill')

var editor = new Quill('#editor-container', {
  modules: {
    cursors: true,
    toolbar: [
      [{ header: [1, 2, false] }],
      ['bold', 'italic', 'underline'],
      ['image', 'code-block']
    ]
  },
  placeholder: 'Start collaborating...',
  theme: 'snow' // or 'bubble'
})

// Optionally specify an Awareness instance, if supported by the Provider
const binding = new QuillBinding(type, editor, provider.awareness)

/*
// Define user name and user name
// Check the quill-cursors package on how to change the way cursors are rendered
provider.awareness.setLocalStateField('user', {
  name: 'Typing Jimmy',
  color: 'blue'
})
*/

```

Also look [here](https://github.com/y-js/yjs-demos/tree/master/quill) for a working example.

## Custom Embeds

The Delta format supports "custom embeds", a feature for embedding custom
data using custom data models. This feature is currently not well documented, but
it enables us to create good data models for tables and other complex widgets
(like drawing widgets) that can't be well represented using text+formatting.

y-quill supports custom embeds. However, you need teach y-quill how to translate
the custom deltas to Yjs transformations and how to translate Yjs
transformations to custom deltas. 

This package already ships with a couple of custom deltas that might be useful. 

**Notes:**
- You need to register a "Blot" to render those embeds! This TableEmbed Blot might be
  available in a third-party package or you can build it yourself.
- The Quill project currently doesn't talk a lot about this feature. This might
  mean that it is unstable, or subject to future changes. y-quill will try to
  keep track of the changes.

#### Custom Delta: table-embed

```javascript
import { tableEmbed } from 'y-quill/embeds/table-embed'
import TableEmbed from 'quill/modules/tableEmbed.js'
TableEmbed.register()

const embeds = {
  'table-embed': tableEmbed
}

const binding = new QuillBinding(type, editor, provider.awareness, { embeds })
```

### How to build custom deltas

The QuillBinding accepts a `embeds` option that is used as a lookup table for
transforming custom embed operations to Yjs operations and back.

Here is an example for building a `delta` embed that simply nests another delta
in a custom embed:

```javascript
import Delta from 'quill-delta'

// Register a custom `delta` embed in `quill-embed` module.
Delta.registerEmbed('delta', {
  compose: (a, b) => new Delta(a).compose(new Delta(b)).ops,
  transform: (a, b, priority) =>
    new Delta(a).transform(new Delta(b), priority).ops,
  invert: (a, b) => new Delta(a).invert(new Delta(b)).ops
})


/**
 * This object is used to translate between quill-deltas and Yjs
 * transformations.
 */
const embeds = {
  /**
   * The `delta` embed might be useful to render another editor (e.g. quill, or
   * a code editor like codemirror) inside of a quill instance.
   */
  delta: {
    /**
     * A custom embed is always represented as a Y.XmlElement, because it is a
     * very versatile shared type and the only one that can be "named" (
     * `yxml.nodeName` will be the name of the custom embed). You must represent
     * your data using a Y.XmlElement. However, you may embed other Yjs types
       inside the Y.XmlElement.
     * 
     * The `update` function is called whenever the quill editor changes the
     * custom embed (i.e. `[ retain: { delta: op} ]`, where `op` is the second
     * parameter of `update`).
     *
     * The `update` function is also called when the embed is created so we may
     * initialize some content here if needed.
     *
     * @param {Y.XmlElement<{ ytext: Y.Text }>} yxml
     * @param {DeltaOp} op
     */
    update: (yxml, op) => {
      if (!yxml.hasAttribute('ytext')) {
        // The "delta" will be represented as a Y.Text, which we will maintain
        // on the "ytext" property
        yxml.setAttribute('ytext', new Y.Text())
      }
      const ytext = yxml.getAttribute('ytext')
      ytext?.applyDelta(op)
    },

    /**
     * Translate Yjs events to a delta embed event.
     * In this case, Y.Text (the child of yxml) already emits a quill-compatible
     * delta event that we can simply return.
     *
     * @param {Y.XmlElement} yxml
     * @param {Array<Y.YEvent<any>>} events
     * @return {DeltaOps}
     */
    eventsToDelta: (yxml, events) => {
      const ytext = yxml.getAttribute('ytext')
      const ytextevent = events.find(event => event.target === ytext)
      if (ytextevent) {
        return /** @type {any} */ (ytextevent.delta)
      }
      return []
    },

    /**
     * Translate the Y.XmlElement to a custom embed delta.
     * In this case, we can simply return the delta representation of the
     * Y.Text.
     */
    typeToDelta: (yxml) => {
      return yxml.getAttribute('ytext').toDelta()
    }
  }
}

const binding = new QuillBinding(type, editor, provider.awareness, { embeds })
```

## License

[The MIT License](./LICENSE) © Kevin Jahns
