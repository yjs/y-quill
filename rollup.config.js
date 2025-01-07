import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default [{
  input: './src/y-quill.js',
  output: [{
    name: 'yQuill',
    file: 'dist/y-quill.cjs',
    format: 'cjs',
    sourcemap: true
  }],
  external: id => /^lib0\//.test(id)
}, {
  input: './embeds/table-embed.js',
  output: [{
    name: 'tableEmbed',
    file: 'dist/embeds/table-embed.cjs',
    format: 'cjs',
    sourcemap: true
  }],
  external: id => /^lib0\//.test(id)
}, {
  input: './demo/quill-demo.js',
  output: [{
    name: 'quillDemo',
    file: 'dist/quill-demo.js',
    format: 'iife',
    sourcemap: true
  }],
  plugins: [
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
    nodeResolve({
      mainFields: ['module', 'browser', 'main']
    }),
    commonjs()
  ]
}]
