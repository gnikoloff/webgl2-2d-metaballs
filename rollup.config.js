import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import css from 'rollup-plugin-css-only'
import copy from 'rollup-plugin-copy'
import glslify from 'rollup-plugin-glslify'

export default {
  input: 'app/script.js',
  output: {
    file: 'dist/bundle.js',
    format: 'iife'
  },
  plugins: [
    resolve(),
    commonjs(),
    copy({
      targets: [
        { src: 'index.html', dest: 'dist' },
        { src: 'css', dest: 'dist' },
        { src: 'favicon.ico', dest: 'dist' }
      ]
    }),
    css({ output: 'bundle.css' }),
    glslify()
  ]
}