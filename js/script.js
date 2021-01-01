const contentWrapper = document.querySelector('.content')
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl2')

const CONFIG = {
  ballRadius: 50
}

let oldTime = 0

const metaballsVertexShader = makeWebglShader(gl, {
  shaderType: gl.VERTEX_SHADER,
  shaderSource: `#version 300 es
    uniform mat4 u_projectionMatrix;
    
    in vec4 a_position;

    void main () {
      gl_Position = u_projectionMatrix * a_position;
    }
  `
})
const metaballsFragmentShader = makeWebglShader(gl, {
  shaderType: gl.FRAGMENT_SHADER,
  shaderSource: `#version 300 es
    precision highp float;

    out vec4 outputColor;

    void main () {
      outputColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  `
})
const metaballsProgram = makeWebglProram(gl, {
  vertexShader: metaballsVertexShader,
  fragmentShader: metaballsFragmentShader,
})

const ballsVertexArray = new Float32Array([
  -CONFIG.ballRadius / 2,  CONFIG.ballRadius / 2,
   CONFIG.ballRadius / 2,  CONFIG.ballRadius / 2,
   CONFIG.ballRadius / 2, -CONFIG.ballRadius / 2,
  -CONFIG.ballRadius / 2,  CONFIG.ballRadius / 2,
   CONFIG.ballRadius / 2, -CONFIG.ballRadius / 2,
  -CONFIG.ballRadius / 2, -CONFIG.ballRadius / 2]
)

const a_positionLocation = gl.getAttribLocation(metaballsProgram, 'a_position')

const ballsVertexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, ballsVertexBuffer)
gl.bufferData(gl.ARRAY_BUFFER, ballsVertexArray, gl.STATIC_DRAW)
gl.enableVertexAttribArray(a_positionLocation)
gl.vertexAttribPointer(a_positionLocation, 2, gl.FLOAT, false, 0, 0)

init()
function init () {
  contentWrapper.appendChild(canvas)
  resize()
  window.addEventListener('resize', resize)

  gl.useProgram(metaballsProgram)
  const u_projectionMatrix = gl.getUniformLocation(metaballsProgram, 'u_projectionMatrix')
  const projectionMatrix = makeProjection(innerWidth / 2, innerHeight / 2)
  console.log(projectionMatrix)
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

  gl.useProgram(metaballsProgram)
  gl.drawArrays(gl.TRIANGLES, 0, 6)

  requestAnimationFrame(renderFrame)
}

function resize () {
  canvas.width = innerWidth
  canvas.height = innerHeight
  canvas.style.width = `${innerWidth}`
  canvas.style.height = `${innerHeight}`
}

/* ------- WebGL helpers ------- */
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
