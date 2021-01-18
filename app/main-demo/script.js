import WebFont from 'webfontloader'
import * as dat from 'dat.gui'

import quadVertexShaderSource from './quad.vert'
import quadFragmentShaderSource from './quad.frag'
import ballsVertexShaderSource from './balls.vert'
import ballsFragmentShaderSource from './balls.frag'
import textVertexShaderSource from './text.vert'
import textFragmentShaderSource from './text.frag'

import './style.css'

const CONFIG = {
  ballsCount: 100,
  ballRadius: 250,
  gravityX: 0.015,
  gravityY: 0.1,
  textQuadWidth: 400,
  startVelocityX: { min: 0, max: 5 },
  startVelocityY: { min: 1, max: 3 },
  labelFontFamily: 'Josefin Sans',
  labelFontWeight: 600,
  labelText: '2021',
  grainBlendFactor: 0.04,
  animateGrain: true,
  palette: {
    backgroundColor: [36, 31, 31],
    thinBorderColor: [0, 0, 0],
    fatBorderColor: [41, 36, 36],
    metaballsColor: [0, 0, 0],
  }
}

const gui = new dat.GUI()
gui.close()

const dpr = devicePixelRatio > 2.5 ? 2.5 : devicePixelRatio
const contentWrapper = document.querySelector('.content')
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl2')
const textQuadVertexArrayObject = gl.createVertexArray()
const quadVertexArrayObject = gl.createVertexArray()
const ballsVertexArrayObject = gl.createVertexArray()
const ballsOffsetsBuffer = gl.createBuffer()

if (!gl) {
  document.body.classList.add('webgl2-not-supported')
}

let textTexture
let textTextureWidth
let textTextureHeight
let disabledDebug = true
let oldTime = 0
let fontLoaded = false
let textQuadWebGLProgram
let quadWebGLProgram
let ballsWebGLProgram
let u_quadTextureUniformLoc
let u_backgroundColor
let u_thinBorderColor
let u_fatBorderColor
let u_metaballsColor
let u_grainBlendFactor
let u_time
let ballsOffsetsArray
let ballsVelocitiesArray
let targetTexture
let framebuffer
let textureInternalFormat
let textureType
let quadVertexBuffer

/* ------- Use correct WebGL texture internal format depending on what the hardware supports ------- */
{
  textureInternalFormat = gl.RGBA
  textureType = gl.UNSIGNED_TYPE
  const rgba32fSupported = gl.getExtension('EXT_color_buffer_float') && gl.getExtension('OES_texture_float_linear')
  if (rgba32fSupported) {
    textureInternalFormat = gl.RGBA32F
    textureType = gl.FLOAT
  } else {
    const rgba16fSupported = gl.getExtension('EXT_color_buffer_half_float') && gl.getExtension('OES_texture_half_float_linear')
    if (rgba16fSupported) {
      textureInternalFormat = gl.RGBA16F
      textureType = gl.HALF_FLOAT
    }
  }
}

{
  const vertexShader = makeWebglShader(gl, {
    shaderType: gl.VERTEX_SHADER,
    shaderSource: `#version 300 es
      ${textVertexShaderSource}
    `
  })
  const fragmentShader = makeWebglShader(gl, {
    shaderType: gl.FRAGMENT_SHADER,
    shaderSource: `#version 300 es
      ${textFragmentShaderSource}
    `
  })
  textQuadWebGLProgram = makeWebglProram(gl, {
    vertexShader,
    fragmentShader
  })
}

/* ------- Create metaballs WebGL program ------- */
{
  const vertexShader = makeWebglShader(gl, {
    shaderType: gl.VERTEX_SHADER,
    shaderSource: `#version 300 es
      ${ballsVertexShaderSource}
    `
  })
  const fragmentShader = makeWebglShader(gl, {
    shaderType: gl.FRAGMENT_SHADER,
    shaderSource: `#version 300 es
      ${ballsFragmentShaderSource}
    `
  })
  ballsWebGLProgram = makeWebglProram(gl, {
    vertexShader,
    fragmentShader,
  })
}

/* ------- Create and assign metaballs WebGL attributes ------- */
{
  const vertexArray = new Float32Array([
    -CONFIG.ballRadius / 2,  CONFIG.ballRadius / 2,
     CONFIG.ballRadius / 2,  CONFIG.ballRadius / 2,
     CONFIG.ballRadius / 2, -CONFIG.ballRadius / 2,
    -CONFIG.ballRadius / 2,  CONFIG.ballRadius / 2,
     CONFIG.ballRadius / 2, -CONFIG.ballRadius / 2,
    -CONFIG.ballRadius / 2, -CONFIG.ballRadius / 2
  ])
  const uvsArray = makeQuadUVs()

  ballsOffsetsArray = new Float32Array(CONFIG.ballsCount * 2)
  ballsVelocitiesArray = new Float32Array(CONFIG.ballsCount * 2)

  for (let i = 0; i < CONFIG.ballsCount; i++) {
    ballsOffsetsArray[i * 2 + 0] = Math.random() * innerWidth
    ballsOffsetsArray[i * 2 + 1] = Math.random() * 100

    ballsVelocitiesArray[i * 2 + 0] = (Math.random() * 2 - 1) * CONFIG.startVelocityX.max + CONFIG.startVelocityX.min
    ballsVelocitiesArray[i * 2 + 1] = Math.random() * CONFIG.startVelocityY.max + CONFIG.startVelocityY.min
  }
  const vertexBuffer = gl.createBuffer()
  const uvsBuffer = gl.createBuffer()

  const a_position = gl.getAttribLocation(ballsWebGLProgram, 'a_position')
  const a_uv = gl.getAttribLocation(ballsWebGLProgram, 'a_uv')
  const a_offsetPosition = gl.getAttribLocation(ballsWebGLProgram, 'a_offsetPosition')

  gl.bindVertexArray(ballsVertexArrayObject)

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_position)
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, uvsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, uvsArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_uv)
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, ballsOffsetsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, ballsOffsetsArray, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(a_offsetPosition)
  gl.vertexAttribPointer(a_offsetPosition, 2, gl.FLOAT, false, 0, 0)
  gl.vertexAttribDivisor(a_offsetPosition, 1)

  gl.bindVertexArray(null)
}

/* ------- Create fullscreen quad WebGL program ------- */
{
  const vertexShader = makeWebglShader(gl, {
    shaderType: gl.VERTEX_SHADER,
    shaderSource: `#version 300 es
      ${quadVertexShaderSource}
    `
  })
  const fragmentShader = makeWebglShader(gl, {
    shaderType: gl.FRAGMENT_SHADER,
    shaderSource: `#version 300 es
      ${quadFragmentShaderSource}
    `
  })
  quadWebGLProgram = makeWebglProram(gl, {
    vertexShader,
    fragmentShader,
  })
}

/* ------- Create and assign fullscreen quad WebGL attributes ------- */
{
  const vertexArray = new Float32Array([
    0, innerHeight / 2,
    innerWidth / 2, innerHeight / 2,
    innerWidth / 2, 0,
    0, innerHeight / 2,
    innerWidth / 2, 0,
    0, 0
  ])
  const uvsArray = makeQuadUVs()

  quadVertexBuffer = gl.createBuffer()
  const uvsBuffer = gl.createBuffer()
  
  const a_position = gl.getAttribLocation(quadWebGLProgram, 'a_position')
  const a_uv = gl.getAttribLocation(quadWebGLProgram, 'a_uv')

  gl.bindVertexArray(quadVertexArrayObject)

  gl.bindBuffer(gl.ARRAY_BUFFER, quadVertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_position)
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, uvsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, uvsArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_uv)
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 0, 0)

  gl.bindVertexArray(null)
}

/* ------- Create WebGL framebuffer to render to ------- */
makeFramebuffer()

init()
function init () {
  canvas.id = 'metaballs-canvas'
  contentWrapper.appendChild(canvas)
  // Handle resizing
  resize()
  window.addEventListener('resize', () => {
    resize()
    // Recreate framebuffer
    gl.deleteFramebuffer(framebuffer)
    gl.deleteTexture(targetTexture)
    makeFramebuffer()

    // Update vertices of our fullscreen quad to match new viewport
    const vertexArray = new Float32Array([
      0, innerHeight / 2,
      innerWidth / 2, innerHeight / 2,
      innerWidth / 2, 0,
      0, innerHeight / 2,
      innerWidth / 2, 0,
      0, 0
    ])
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW)
  })

  // Handle dat.GUI settings changes
  {
    gui.add(CONFIG, 'gravityY').min(0.05).max(0.5).step(0.05)
    gui.add(CONFIG, 'grainBlendFactor').min(0).max(0.3).onChange(() => {
      gl.useProgram(quadWebGLProgram)
      gl.uniform1f(u_grainBlendFactor, CONFIG.grainBlendFactor)
      gl.useProgram(null)
    })
    gui.add(CONFIG, 'animateGrain')
    gui.add(CONFIG, 'labelText').onChange(renderLabelQuad)
    gui.addColor(CONFIG.palette, 'backgroundColor').onChange(val => {
      gl.useProgram(quadWebGLProgram)
      gl.uniform3f(u_backgroundColor, ...CONFIG.palette.backgroundColor.map(a => a / 255))
      gl.useProgram(null)
    })
    gui.addColor(CONFIG.palette, 'thinBorderColor').onChange(val => {
      gl.useProgram(quadWebGLProgram)
      gl.uniform3f(u_thinBorderColor, ...CONFIG.palette.thinBorderColor.map(a => a / 255))
      gl.useProgram(null)
    })
    gui.addColor(CONFIG.palette, 'fatBorderColor').onChange(val => {
      gl.useProgram(quadWebGLProgram)
      gl.uniform3f(u_fatBorderColor, ...CONFIG.palette.fatBorderColor.map(a => a / 255))
      gl.useProgram(null)
    })
    gui.addColor(CONFIG.palette, 'metaballsColor').onChange(val => {
      gl.useProgram(quadWebGLProgram)
      gl.uniform3f(u_metaballsColor, ...CONFIG.palette.metaballsColor.map(a => a / 255))
      gl.useProgram(null)
    })
  }

  setInterval(() => {
    CONFIG.gravityX *= -1
  }, 3000)
  
  loadFont().then(renderLabelQuad)

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  // Initialize correct uniforms
  let u_resolution
  gl.useProgram(quadWebGLProgram)
  u_quadTextureUniformLoc = gl.getUniformLocation(quadWebGLProgram, 'u_texture')
  gl.uniform1i(u_quadTextureUniformLoc, 0)
  u_backgroundColor = gl.getUniformLocation(quadWebGLProgram, 'u_backgroundColor')
  gl.uniform3f(u_backgroundColor, ...CONFIG.palette.backgroundColor.map(a => a / 255))
  u_thinBorderColor = gl.getUniformLocation(quadWebGLProgram, 'u_thinBorderColor')
  gl.uniform3f(u_thinBorderColor, ...CONFIG.palette.thinBorderColor.map(a => a / 255))
  u_fatBorderColor = gl.getUniformLocation(quadWebGLProgram, 'u_fatBorderColor')
  gl.uniform3f(u_fatBorderColor, ...CONFIG.palette.fatBorderColor.map(a => a / 255))
  u_metaballsColor = gl.getUniformLocation(quadWebGLProgram, 'u_metaballsColor')
  gl.uniform3f(u_metaballsColor, ...CONFIG.palette.metaballsColor.map(a => a / 255))
  u_grainBlendFactor = gl.getUniformLocation(quadWebGLProgram, 'u_grainBlendFactor')
  gl.uniform1f(u_grainBlendFactor, CONFIG.grainBlendFactor)
  u_resolution = gl.getUniformLocation(quadWebGLProgram, 'u_resolution')
  gl.uniform2f(u_resolution, innerWidth, innerHeight)
  u_time = gl.getUniformLocation(quadWebGLProgram, 'u_time')
  gl.uniform1f(u_time, 0)
  gl.useProgram(null)

  gl.useProgram(textQuadWebGLProgram)
  u_resolution = gl.getUniformLocation(textQuadWebGLProgram, 'u_resolution')
  gl.uniform2f(u_resolution, innerWidth, innerHeight)
  const u_textTexture = gl.getUniformLocation(textQuadWebGLProgram, 'u_textTexture')
  gl.uniform1i(u_textTexture, 0)
  gl.useProgram(null)

  // Issue next frame update and render
  requestAnimationFrame(renderFrame)
  
}

function renderLabelQuad () {
  const {
    texture,
    width,
    height,
  } = makeTextTexture()

  textTexture = texture
  textTextureWidth = width
  textTextureHeight = height

  const vertexArray = new Float32Array([
    -width / 2,  height / 2,
     width / 2,  height / 2,
     width / 2, -height / 2,
    -width / 2,  height / 2,
     width / 2, -height / 2,
    -width / 2, -height / 2
  ])
  const uvsArray = makeQuadUVs()

  const a_position = gl.getAttribLocation(textQuadWebGLProgram, 'a_position')
  const a_uv = gl.getAttribLocation(textQuadWebGLProgram, 'a_uv')

  const vertexBuffer = gl.createBuffer()
  const uvsBuffer = gl.createBuffer()

  gl.bindVertexArray(textQuadVertexArrayObject)

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_position)
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, uvsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, uvsArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_uv)
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 0, 0)

  gl.bindVertexArray(null)
  fontLoaded = true
}


function renderFrame (ts) {
  const dt = ts - oldTime
  oldTime = ts

  for (let i = 0; i < CONFIG.ballsCount; i++) {
    ballsVelocitiesArray[i * 2 + 0] += CONFIG.gravityX
    ballsVelocitiesArray[i * 2 + 1] += CONFIG.gravityY
    ballsOffsetsArray[i * 2 + 0] += ballsVelocitiesArray[i * 2 + 0] * (dt * 0.075)
    
    const radius = CONFIG.ballRadius / 5
    
    const centerBoxTop = innerHeight / 2 - textTextureHeight / 2
    const centerBoxRight = innerWidth / 2 + textTextureWidth / 2
    const centerBoxBottom = innerHeight / 2 + textTextureHeight / 2
    const centerBoxLeft = innerWidth / 2 - textTextureWidth / 2

    const quadx = ballsOffsetsArray[i * 2 + 0]
    const quady = ballsOffsetsArray[i * 2 + 1]

    const quadvx = ballsVelocitiesArray[i * 2 + 0]
    const quadvy = ballsVelocitiesArray[i * 2 + 1]

    // Handle text box collisions
    if (
      quadx + radius + quadvx > centerBoxLeft &&
      quadx - radius + quadvx < centerBoxRight &&
      quady + radius > centerBoxTop &&
      quady - radius < centerBoxBottom
    ) {
      ballsVelocitiesArray[i * 2 + 0] *= -1
    }
    if (
      quadx + radius > centerBoxLeft &&
      quadx - radius < centerBoxRight &&
      quady + radius + quadvy > centerBoxTop &&
      quady - radius + quadvy < centerBoxBottom
    ) {
      ballsOffsetsArray[i * 2 + 1] = centerBoxTop - radius - quadvy
      ballsVelocitiesArray[i * 2 + 1] *= -0.2
    } else {
      ballsOffsetsArray[i * 2 + 1] += ballsVelocitiesArray[i * 2 + 1] * (dt * 0.06)
    }

    // Bounce off left & right viewport edge
    if (ballsOffsetsArray[i * 2 + 0] < 0) {
      ballsOffsetsArray[i * 2 + 0] = 0
      ballsVelocitiesArray[i * 2 + 0] *= -0.75
    }
    if (ballsOffsetsArray[i * 2 + 0] > innerWidth) {
      ballsOffsetsArray[i * 2 + 0] = innerWidth
      ballsVelocitiesArray[i * 2 + 0] *= -0.75
    }

    // Regenerate balls when they fall below bottom viewport edge
    if (ballsOffsetsArray[i * 2 + 1] - CONFIG.ballRadius > innerHeight) {
      ballsOffsetsArray[i * 2 + 1] = -CONFIG.ballRadius
      ballsVelocitiesArray[i * 2 + 1] = 5 + Math.random() * 3
    }

  }

  // Pass updated positions to our balls
  gl.bindBuffer(gl.ARRAY_BUFFER, ballsOffsetsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, ballsOffsetsArray, gl.DYNAMIC_DRAW)
  
  if (disabledDebug) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  }

  // Set correct canvas viewport and color
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  // Render balls
  gl.bindVertexArray(ballsVertexArrayObject)
  gl.useProgram(ballsWebGLProgram)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, CONFIG.ballsCount)
  gl.bindVertexArray(null)

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, canvas.width, canvas.height)

  // Render fullscreen postprocessing quad
  if (disabledDebug) {
    gl.bindVertexArray(quadVertexArrayObject)
    gl.useProgram(quadWebGLProgram)
    gl.bindTexture(gl.TEXTURE_2D, targetTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.uniform1f(u_time, CONFIG.animateGrain ? ts * 0.1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.useProgram(null)
    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  // Render text quad
  if (fontLoaded) {
    gl.useProgram(textQuadWebGLProgram)
    gl.bindVertexArray(textQuadVertexArrayObject)
    gl.bindTexture(gl.TEXTURE_2D, textTexture)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindVertexArray(null)
    gl.useProgram(null)
  }

  requestAnimationFrame(renderFrame)
}

function resize () {
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  canvas.style.width = `${innerWidth}px`
  canvas.style.height = `${innerHeight}px`

  const projectionMatrix = makeProjectionMatrix(innerWidth / 2, innerHeight / 2)

  // Update and pass correct projectionMatrix
  let u_projectionMatrix
  gl.useProgram(ballsWebGLProgram)
  u_projectionMatrix = gl.getUniformLocation(ballsWebGLProgram, 'u_projectionMatrix')
  gl.uniformMatrix4fv(u_projectionMatrix, false, projectionMatrix)
  gl.useProgram(null)

  gl.useProgram(quadWebGLProgram)
  u_projectionMatrix = gl.getUniformLocation(quadWebGLProgram, 'u_projectionMatrix')
  gl.uniformMatrix4fv(u_projectionMatrix, false, projectionMatrix)
  gl.useProgram(null)

  gl.useProgram(textQuadWebGLProgram)
  u_projectionMatrix = gl.getUniformLocation(textQuadWebGLProgram, 'u_projectionMatrix')
  gl.uniformMatrix4fv(u_projectionMatrix, false, projectionMatrix)
  const u_resolution = gl.getUniformLocation(textQuadWebGLProgram, 'u_resolution')
  gl.uniform2f(u_resolution, innerWidth, innerHeight)
  gl.useProgram(null)
  
}

function loadFont ({
  fontFamily = CONFIG.labelFontFamily,
  fontWeight = CONFIG.labelFontWeight,
  text = CONFIG.labelText,
} = {}) {
  return new Promise((resolve, reject) => {
    WebFont.load({
      google: {
        families: [`${fontFamily}:${fontWeight}`],
        // text: 'abcde',
      },
      fontactive: () => resolve(),
      fontinactive: (err) => {
        console.error('could not load font:', err)
        reject()
      }
    })
  })
}

/* ------- WebGL helpers ------- */
function makeFramebuffer () {
  targetTexture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, targetTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, textureInternalFormat, innerWidth * dpr, innerHeight * dpr, 0, gl.RGBA, textureType, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)

  framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
}

function makeTextTexture ({
  text = CONFIG.labelText.toUpperCase()
} = {}) {

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = CONFIG.textQuadWidth

  const referenceFontSize = 42

  ctx.font = `${CONFIG.labelFontWeight} ${referenceFontSize}px ${CONFIG.labelFontFamily}`
  let textMetrics = ctx.measureText(text)

  const widthDelta = CONFIG.textQuadWidth / (Math.abs(textMetrics.actualBoundingBoxLeft) + Math.abs(textMetrics.actualBoundingBoxRight))
  const realFontSize = referenceFontSize * widthDelta

  ctx.font = `${CONFIG.labelFontWeight} ${realFontSize}px ${CONFIG.labelFontFamily}`

  textMetrics = ctx.measureText(text)
  
  const textHasJ = text.includes('J')

  let paddingYScale = 0.2

  if (textHasJ) {
    paddingYScale = 0.4
  }

  const height = (textMetrics.actualBoundingBoxAscent - textMetrics.actualBoundingBoxDescent) * (1 + paddingYScale)

  canvas.height = height

  ctx.fillStyle = 'white'
  ctx.font = `${CONFIG.labelFontWeight} ${realFontSize}px ${CONFIG.labelFontFamily}`
  
  let accX = 0
  text.split('').forEach((char, i) => {
    let offsetY = 0
    let paddingYScale = 0.2
    if (char === 'J') {
      paddingYScale = 0.4
    } else {
      if (textHasJ) {
        offsetY += canvas.height * (paddingYScale / 4)
      }
    }
    ctx.fillText(char, accX, canvas.height - canvas.height * (paddingYScale / 2) + offsetY)
    accX += ctx.measureText(char).width
  })

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)

  return {
    texture,
    width: canvas.width,
    height: canvas.height,
  }
}

function makeQuadUVs () {
  return new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1])
}

function makeWebglShader (gl, { shaderType, shaderSource }) {
  const shader = gl.createShader(shaderType)
  gl.shaderSource(shader, shaderSource)
  gl.compileShader(shader)
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (success) {
    return shader
  }
  console.error(`
    Error in ${shaderType === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader:
    ${gl.getShaderInfoLog(shader)}
  `)
  gl.deleteShader(shader)
}

function makeWebglProram (gl, { vertexShader, fragmentShader }) {
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  const success = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (success) {
    return program
  }
  console.error(gl.getProgramInfoLog(program))
  gl.deleteProgram(program)
}

function makeProjectionMatrix (width, height) {
  return new Float32Array([
    2 / width, 0, 0, 0,
    0, -2 / height, 0, 0,
    0, 0, 0, 0,
    -1, 1, 0, 1,
  ])
}
