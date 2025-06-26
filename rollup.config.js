import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

const customResolve = {
  resolveId (importee) {
    switch (importee) {
      case 'yjs': return `${process.cwd()}/node_modules/yjs/src/index.js`
      case '@y/quill': return `${process.cwd()}/src/y-quill.js`
    }
  }
}

export default [{
  input: './src/y-quill.js',
  output: [{
    name: 'yQuill',
    file: 'dist/y-quill.cjs',
    format: 'cjs',
    sourcemap: true
  }],
  external: id => /^(lib0|quill|quill-delta|yjs)\//.test(id)
}, {
  input: './src/embeds/table-embed.js',
  output: [{
    name: 'tableEmbed',
    file: 'dist/embeds/table-embed.cjs',
    format: 'cjs',
    sourcemap: true
  }],
  external: id => /^(lib0|quill|quill-delta|yjs)\//.test(id)
}, {
  input: './demo/quill-demo.js',
  output: [{
    name: 'quillDemo',
    file: 'dist/quill-demo.js',
    format: 'iife',
    sourcemap: true
  }],
  plugins: [
    customResolve,
    nodeResolve({
      mainFields: ['module', 'browser', 'main']
    }),
    commonjs()
  ]
}, {
  input: './test/index.js',
  output: {
    name: 'test',
    file: 'dist/test.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
      customResolve,
    nodeResolve({
      mainFields: ['module', 'browser', 'main']
    }),
    commonjs()
  ]
}]
