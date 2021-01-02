import './style.css'

const CONFIG = {
  ballsCount: 100,
  ballRadius: 250,
  gravity: 0.05,
  startVelocityX: { min: 0, max: 0.1 },
  startVelocityY: { min: 0, max: 0.1 },
}

const contentWrapper = document.querySelector('.content')
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl2')

const dpr = Math.max(devicePixelRatio || 1, 3)

if (!gl) {
  showWebGL2NotSupported()
}

const quadVertexArrayObject = gl.createVertexArray()
const ballsVertexArrayObject = gl.createVertexArray()
const ballsOffsetsBuffer = gl.createBuffer()

let oldTime = 0

let quadWebGLProgram
let quadTextureUniformLoc
let ballsWebGLProgram
let ballsOffsetsArray
// Not for rendering, just storing the balls velocities
let ballsVelocitiesArray

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
    ballsOffsetsArray[i * 2 + 1] = Math.random() * innerHeight

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

      uniform sampler2D u_texture;

      in vec2 v_uv;

      out vec4 outputColor;

      void main () {
        vec4 inputColor = texture(u_texture, v_uv);

        float cutoff = 0.52;
        float threshold = 0.015;
        cutoff = step(cutoff, inputColor.a);

        vec4 baseColor = vec4(0.0, 1.0, 0.0, 1.0);
        vec4 metaballsColor = vec4(1.0, 0.0, 0.0, 1.0);

        outputColor = mix(baseColor, metaballsColor, cutoff);

        // outputColor = mix(inputColor, mix(baseColor, metaballsColor, cutoff), 0.3);

        // outputColor = inputColor;
      }
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
    0,innerHeight / 2,
    innerWidth / 2, 0,
    0, 0
  ])
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

/* ------- Create WebGL texture to render to ------- */
const targetTextureWidth = innerWidth * dpr
const targetTextureHeight = innerHeight * dpr
const targetTexture = gl.createTexture()
gl.bindTexture(gl.TEXTURE_2D, targetTexture)
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, targetTextureWidth, targetTextureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
gl.bindTexture(gl.TEXTURE_2D, null)

/* ------- Create WebGL framebuffer to render to ------- */
const framebuffer = gl.createFramebuffer()
gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0)
gl.bindFramebuffer(gl.FRAMEBUFFER, null)

init()
function init () {
  contentWrapper.appendChild(canvas)
  resize()
  window.addEventListener('resize', resize)

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  // gl.blendEquation(gl.FUNC_SUBTRACT)

  const projectionMatrix = makeProjectionMatrix(innerWidth / 2, innerHeight / 2)

  let u_projectionMatrix

  gl.useProgram(ballsWebGLProgram)
  u_projectionMatrix = gl.getUniformLocation(ballsWebGLProgram, 'u_projectionMatrix')
  gl.uniformMatrix4fv(u_projectionMatrix, false, projectionMatrix)
  gl.useProgram(null)

  gl.useProgram(quadWebGLProgram)
  quadTextureUniformLoc = gl.getUniformLocation(quadWebGLProgram, 'u_texture')
  gl.uniform1i(quadTextureUniformLoc, 0)

  u_projectionMatrix = gl.getUniformLocation(quadWebGLProgram, 'u_projectionMatrix')
  gl.uniformMatrix4fv(u_projectionMatrix, false, projectionMatrix)
  gl.useProgram(null)

  requestAnimationFrame(renderFrame)
  
}

let a = true
document.addEventListener('click', () => {
  a = !a
})

function renderFrame (ts) {
  const dt = ts - oldTime
  oldTime = ts

  for (let i = 0; i < CONFIG.ballsCount; i++) {
    ballsVelocitiesArray[i * 2 + 1] += CONFIG.gravity
    ballsOffsetsArray[i * 2 + 0] += ballsVelocitiesArray[i * 2 + 0]
    ballsOffsetsArray[i * 2 + 1] += ballsVelocitiesArray[i * 2 + 1]


    if (ballsOffsetsArray[i * 2 + 0] < CONFIG.ballRadius / 2) {
      ballsOffsetsArray[i * 2 + 0] = CONFIG.ballRadius / 2
      ballsVelocitiesArray[i * 2 + 0] *= -1
    }
    if (ballsOffsetsArray[i * 2 + 0] > innerWidth - CONFIG.ballRadius / 2) {
      ballsOffsetsArray[i * 2 + 0] = innerWidth - CONFIG.ballRadius / 2
      ballsVelocitiesArray[i * 2 + 0] *= -1
    }

    if (ballsOffsetsArray[i * 2 + 1] - CONFIG.ballRadius > innerHeight) {
      ballsOffsetsArray[i * 2 + 1] = -CONFIG.ballRadius
      ballsVelocitiesArray[i * 2 + 1] = 5 + Math.random() * 3
    }
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, ballsOffsetsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, ballsOffsetsArray, gl.DYNAMIC_DRAW)
  
  gl.viewport(0, 0, canvas.width, canvas.height)

  if (a) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  }

  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0.1, 0.1, 0.1, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.bindVertexArray(ballsVertexArrayObject)
  gl.useProgram(ballsWebGLProgram)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, CONFIG.ballsCount)
  gl.bindVertexArray(null)

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  if (a) {
    gl.bindVertexArray(quadVertexArrayObject)
    gl.useProgram(quadWebGLProgram)
    gl.bindTexture(gl.TEXTURE_2D, targetTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.useProgram(null)
    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  requestAnimationFrame(renderFrame)
}

function resize () {
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  canvas.style.width = `${innerWidth}px`
  canvas.style.height = `${innerHeight}px`
}

/* ------- WebGL helpers ------- */
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

function showWebGL2NotSupported () {
  const errorMessageWrapper = document.createElement('div')
  if (isIOS()) {
    const iOSVersion = getIOSVersion().major
    if (iOSVersion === 13) {
      errorMessageWrapper.innerHTML = `
        <p>Please update your device to iOS / iPadOS 14 so you can see this demo.</p>
      `
    } else if (iOSVersion === 14) {
      errorMessageWrapper.innerHTML = `
        <p>In order to see WebGL2 content, you need to enable it from your device settings.</p>
        <p>Settings > Safari > Advanced > Experimental Features > WebGL2.0</p>
      `
    }
  } else {
    errorMessageWrapper.innerHTML = `
      <h1>Your browser does not support WebGL2</h1>
      <p>Please try one of these alternative browsers:</p>
      <ul>
        <li>Microsoft Edge (version 79+)</li>
        <li>Mozilla Firefox (version 51+)</li>
        <li>Google Chrome (version 56+)</li>
        <li>Opera (version 43+)</li>
      </ul>
    `
  }
  errorMessageWrapper.classList.add('webgl2-error')
  contentWrapper.appendChild(errorMessageWrapper)
}

/* ------- Generic helpers ------- */
function isIOS () {
  return (/AppleWebKit/.test(navigator.userAgent) && /Mobile\/\w+/.test(navigator.userAgent)) || isIPadOS()
}

function isIPadOS () {
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !window.MSStream
}

function getIOSVersion () {
  const found = navigator.userAgent.match(/(iPhone|iPad); (CPU iPhone|CPU) OS (\d+)_(\d+)(_(\d+))?\s+/)
  if (!found || found.length < 4) {
    return {
      major: 0,
      minor: 0
    }
  }
  return {
    major: parseInt(found[3], 10),
    minor: parseInt(found[4], 10)
  }
}
