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

y-quill supports custom embeds, a spec by `slab/quill` / `slab/delta` to support
custom, nested transformations. However, you need teach y-quill how to translate
the custom deltas to Yjs transformations and how to translate Yjs
transformations to custom deltas. This package already ships with a couple of
custom deltas that might be useful. 

### @Todo
- [ ] fuzz test
- [ ] random prng tests
- [ ] fill out readme
- [ ] reduce code duplication by introducing a utility package (at least for the
      Custom Embeds)
- [ ] remove todos
- [ ] notify them

#### Custom Delta: delta

@todo!

#### Custom Delta: table-embed

@todo!

### How to build custom deltas

@todo!

## License

[The MIT License](./LICENSE) © Kevin Jahns
