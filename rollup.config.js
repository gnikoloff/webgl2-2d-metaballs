import css from 'rollup-plugin-css-only'
import copy from 'rollup-plugin-copy'


export default {
  input: 'app/script.js',
  output: {
    file: 'dist/bundle.js',
    format: 'iife'
  },
  plugins: [
    copy({
      targets: [
        { src: 'index.html', dest: 'dist' },
        { src: 'css', dest: 'dist' },
        { src: 'favicon.ico', dest: 'dist' }
      ]
    }),
    css({ output: 'bundle.css' })
  ]
}