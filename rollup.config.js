import css from 'rollup-plugin-css-only'

export default {
  input: 'app/script.js',
  output: {
    file: 'dist/bundle.js',
    format: 'iife'
  },
  plugins: [
    css({ output: 'bundle.css' })
  ]
}