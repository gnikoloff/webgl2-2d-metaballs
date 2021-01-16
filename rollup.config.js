import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import css from 'rollup-plugin-css-only'
import copy from 'rollup-plugin-copy'
import glslify from 'rollup-plugin-glslify'

const sharedPlugins = [
  resolve(),
  commonjs(),
  copy({
    targets: [
      { src: 'index.html', dest: 'dist' },
      { src: 'index-2.html', dest: 'dist' },
      { src: 'css', dest: 'dist' },
      { src: 'favicon.ico', dest: 'dist' }
    ]
  }),
  css({ output: 'bundle.css' }),
  glslify()
]

export default [
  {
    input: 'app/main-demo/script.js',
    output: { file: 'dist/main-demo/bundle.js' },
    plugins: sharedPlugins, 
  },
  {
    input: 'app/demo-2/script.js',
    output: { file: 'dist/demo-2/bundle.js' },
    plugins: sharedPlugins, 
  }
]

