const contentWrapper = document.querySelector('.content')
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl2')

const CONFIG = {
  ballsCount: 100,
  ballRadius: 150
}

let oldTime = 0

const metaballsVertexShader = makeWebglShader(gl, {
  shaderType: gl.VERTEX_SHADER,
  shaderSource: `#version 300 es
    uniform mat4 u_projectionMatrix;
    
    in vec4 a_position;
    in vec4 a_offsetPosition;
    in vec2 a_uv;

    out vec2 v_uv;

    void main () {
      gl_Position = u_projectionMatrix * (a_offsetPosition + a_position);
      v_uv = a_uv;
    }
  `
})
const metaballsFragmentShader = makeWebglShader(gl, {
  shaderType: gl.FRAGMENT_SHADER,
  shaderSource: `#version 300 es
    precision highp float;

    in vec2 v_uv;

    out vec4 outputColor;

    void main () {
      float dist = distance(v_uv, vec2(0.5));
      float c = 0.5 - dist;
      outputColor = vec4(vec3(1.0), c);
    }
  `
})
const metaballsProgram = makeWebglProram(gl, {
  vertexShader: metaballsVertexShader,
  fragmentShader: metaballsFragmentShader,
})

const ballsVertexArray = makeQuadVertices(CONFIG.ballRadius, CONFIG.ballRadius)
const ballsUvsArray = makeQuadUVs()
const ballsOffsetsArray = new Float32Array(CONFIG.ballsCount * 2)
console.log(ballsVertexArray)
for (let i = 0; i < CONFIG.ballsCount; i++) {
  ballsOffsetsArray[i * 2 + 0] = Math.random() * innerWidth
  ballsOffsetsArray[i * 2 + 1] = Math.random() * innerHeight
}

const ballsVertexBuffer = gl.createBuffer()
const ballsUvsBuffer = gl.createBuffer()
const ballsOffsetsBuffer = gl.createBuffer()

const ballsVertexArrayObject = gl.createVertexArray()

{
  const a_positionLocation = gl.getAttribLocation(metaballsProgram, 'a_position')
  const a_uvLocation = gl.getAttribLocation(metaballsProgram, 'a_uv')
  const a_offsetPositionLocation = gl.getAttribLocation(metaballsProgram, 'a_offsetPosition')

  gl.bindVertexArray(ballsVertexArrayObject)

  gl.bindBuffer(gl.ARRAY_BUFFER, ballsVertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, ballsVertexArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_positionLocation)
  gl.vertexAttribPointer(a_positionLocation, 2, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, ballsUvsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, ballsUvsArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_uvLocation)
  gl.vertexAttribPointer(a_uvLocation, 2, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, ballsOffsetsBuffer)
  // TODO: should not be STATIC_DRAW
  gl.bufferData(gl.ARRAY_BUFFER, ballsOffsetsArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_offsetPositionLocation)
  gl.vertexAttribPointer(a_offsetPositionLocation, 2, gl.FLOAT, false, 0, 0)
  gl.vertexAttribDivisor(a_offsetPositionLocation, 2)

  gl.bindVertexArray(null)
}

/* ------- Fullscreen quad ------- */
const fullscreenQuadVertexShader = makeWebglShader(gl, {
  shaderType: gl.VERTEX_SHADER,
  shaderSource: `#version 300 es
    uniform mat4 u_projectionMatrix;

    in vec4 a_position;
    in vec2 a_uv;

    out vec2 v_uv;

    void main () {
      gl_Position = u_projectionMatrix * a_position;
      v_uv = a_uv;
    }
  `
})
const fullscreenQuadFragmentShader = makeWebglShader(gl, {
  shaderType: gl.FRAGMENT_SHADER,
  shaderSource: `#version 300 es
    precision highp float;

    in vec2 v_uv;

    out vec4 outputColor;

    void main () {
      outputColor = vec4(v_uv, 0.0, 0.5);
    }
  `
})
const fullscreenQuadProgram = makeWebglProram(gl, {
  vertexShader: fullscreenQuadVertexShader,
  fragmentShader: fullscreenQuadFragmentShader,
})

const quadVertexArray = makeQuadVertices(innerWidth, innerHeight)
const quadUvsArray = makeQuadUVs()

const quadVertexArrayObject = gl.createVertexArray()

{
  const vertexBuffer = gl.createBuffer()
  const uvsBuffer = gl.createBuffer()
  
  const a_position = gl.getAttribLocation(fullscreenQuadProgram, 'a_position')
  const a_uv = gl.getAttribLocation(fullscreenQuadProgram, 'a_uv')

  gl.bindVertexArray(quadVertexArrayObject)

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, quadVertexArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_position)
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, uvsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, quadUvsArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_uv)
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 0, 0)

  gl.bindVertexArray(null)
}

init()
function init () {
  contentWrapper.appendChild(canvas)
  resize()
  window.addEventListener('resize', resize)

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)


  const projectionMatrix = makeProjection(innerWidth / 2, innerHeight / 2)

  let u_projectionMatrix

  gl.useProgram(metaballsProgram)
  u_projectionMatrix = gl.getUniformLocation(metaballsProgram, 'u_projectionMatrix')
  gl.uniformMatrix4fv(u_projectionMatrix, false, projectionMatrix)
  gl.useProgram(null)

  gl.useProgram(fullscreenQuadProgram)
  u_projectionMatrix = gl.getUniformLocation(fullscreenQuadProgram, 'u_projectionMatrix')
  gl.uniformMatrix4fv(u_projectionMatrix, false, projectionMatrix)
  gl.useProgram(null)

  requestAnimationFrame(renderFrame)
}

function renderFrame (ts) {
  const dt = ts - oldTime
  oldTime = ts
  
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0.1, 0.1, 0.1, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.bindVertexArray(ballsVertexArrayObject)
  gl.useProgram(metaballsProgram)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, CONFIG.ballsCount)
  gl.bindVertexArray(null)

  gl.bindVertexArray(quadVertexArrayObject)
  gl.useProgram(fullscreenQuadProgram)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
  gl.useProgram(null)
  gl.bindVertexArray(null)

  requestAnimationFrame(renderFrame)
}

function resize () {
  canvas.width = innerWidth
  canvas.height = innerHeight
  canvas.style.width = `${innerWidth}`
  canvas.style.height = `${innerHeight}`
}

/* ------- WebGL helpers ------- */
function makeQuadVertices (width, height) {
  return new Float32Array([
    -width / 2,  height / 2,
     width / 2,  height / 2,
     width / 2, -height / 2,
    -width / 2,  height / 2,
     width / 2, -height / 2,
    -width / 2, -height / 2
  ])
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

function makeProjection (width, height) {
  return new Float32Array([
    2 / width, 0, 0, 0,
    0, -2 / height, 0, 0,
    0, 0, 0, 0,
    -1, 1, 0, 1,
  ])
}
