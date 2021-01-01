const CONFIG = {
  ballsCount: 100,
  ballRadius: 150
}

const contentWrapper = document.querySelector('.content')
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl2')

const quadVertexArrayObject = gl.createVertexArray()
const ballsVertexArrayObject = gl.createVertexArray()
const ballsOffsetsBuffer = gl.createBuffer()

let oldTime = 0

let quadWebGLProgram
let ballsWebGLProgram
let ballsOffsetsArray

/* ------- Create metaballs WebGL program ------- */
{
  const vertexShader = makeWebglShader(gl, {
    shaderType: gl.VERTEX_SHADER,
    shaderSource: `#version 300 es
      uniform mat4 u_projectionMatrix;
      
      in vec4 a_position;
      in vec4 a_offsetPosition;
      in vec2 a_uv;

      out vec2 v_uv;

      void main () {
        vec4 correctOffsetedPosition = a_offsetPosition + a_position;
        gl_Position = u_projectionMatrix * correctOffsetedPosition;
        v_uv = a_uv;
      }
    `
  })
  const fragmentShader = makeWebglShader(gl, {
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
  ballsWebGLProgram = makeWebglProram(gl, {
    vertexShader,
    fragmentShader,
  })
}

/* ------- Create and assign metaballs WebGL attributes ------- */
{
  const vertexArray = makeQuadVertices(CONFIG.ballRadius, CONFIG.ballRadius)
  const uvsArray = makeQuadUVs()

  ballsOffsetsArray = new Float32Array(CONFIG.ballsCount * 2)

  for (let i = 0; i < CONFIG.ballsCount; i++) {
    ballsOffsetsArray[i * 2 + 0] = Math.random() * innerWidth
    ballsOffsetsArray[i * 2 + 1] = Math.random() * innerHeight
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
  // TODO: should not be STATIC_DRAW
  gl.bufferData(gl.ARRAY_BUFFER, ballsOffsetsArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_offsetPosition)
  gl.vertexAttribPointer(a_offsetPosition, 2, gl.FLOAT, false, 0, 0)
  gl.vertexAttribDivisor(a_offsetPosition, 2)

  gl.bindVertexArray(null)

}

/* ------- Create fullscreen quad WebGL program ------- */
{
  const vertexShader = makeWebglShader(gl, {
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
  const fragmentShader = makeWebglShader(gl, {
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
  quadWebGLProgram = makeWebglProram(gl, {
    vertexShader,
    fragmentShader,
  })
}

// /* ------- Create and assign fullscreen quad WebGL attributes ------- */
{
  const vertexArray = makeQuadVertices(innerWidth, innerHeight)
  const uvsArray = makeQuadUVs()

  const vertexBuffer = gl.createBuffer()
  const uvsBuffer = gl.createBuffer()
  
  const a_position = gl.getAttribLocation(quadWebGLProgram, 'a_position')
  const a_uv = gl.getAttribLocation(quadWebGLProgram, 'a_uv')

  gl.bindVertexArray(quadVertexArrayObject)

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(a_position)
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, uvsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, uvsArray, gl.STATIC_DRAW)
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


  const projectionMatrix = makeProjectionMatrix(innerWidth / 2, innerHeight / 2)

  let u_projectionMatrix

  gl.useProgram(ballsWebGLProgram)
  u_projectionMatrix = gl.getUniformLocation(ballsWebGLProgram, 'u_projectionMatrix')
  gl.uniformMatrix4fv(u_projectionMatrix, false, projectionMatrix)
  gl.useProgram(null)

  gl.useProgram(quadWebGLProgram)
  u_projectionMatrix = gl.getUniformLocation(quadWebGLProgram, 'u_projectionMatrix')
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
  gl.useProgram(ballsWebGLProgram)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, CONFIG.ballsCount)
  gl.bindVertexArray(null)

  gl.bindVertexArray(quadVertexArrayObject)
  gl.useProgram(quadWebGLProgram)
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

function makeProjectionMatrix (width, height) {
  return new Float32Array([
    2 / width, 0, 0, 0,
    0, -2 / height, 0, 0,
    0, 0, 0, 0,
    -1, 1, 0, 1,
  ])
}
