import './style.css'

const CONFIG = {
  ballsCount: 500,
  ballRadius: isMobileBrowser() ? 50 : 100,
  gravity: 0.1,
  startVelocityX: { min: 0, max: 0.1 },
  startVelocityY: { min: 1, max: 3 },
}

const contentWrapper = document.querySelector('.content')
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl2')
const mousePos = { x: 0, y: 0 }
const dpr = devicePixelRatio > 2.5 ? 2.5 : devicePixelRatio

if (!gl) {
  document.body.classList.add('webgl2-not-supported')
}

const quadVertexArrayObject = gl.createVertexArray()
const ballsVertexArrayObject = gl.createVertexArray()

const ballsOffsetsBuffer = gl.createBuffer()

let oldTime = 0

let canvasbbox
let isDebug = false

// WebGL Programs
let quadWebGLProgram
let ballsWebGLProgram

let quadTextureUniformLoc
let quadVertexBuffer

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
        float c = clamp(0.5 - dist, 0.0, 1.0);
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
  gl.vertexAttribDivisor(a_offsetPosition, 1)

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

        float cutoffThreshold = 0.14;

        float cutoff = step(cutoffThreshold, inputColor.isDebug);
        float threshold = 0.005;

        outputColor = mix(
          vec4(0.78, 0.78, 0.78, 1),
          vec4(0, 0, 1, 1),
          cutoff
        );

        cutoffThreshold += 0.05;

        cutoff = step(cutoffThreshold, inputColor.isDebug);
        outputColor = mix(
          outputColor,
          vec4(0.94, 0.29, 0.235, 1),
          cutoff
        );

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

/* ------- Create WebGL texture to render to ------- */
let textureInternalFormat = gl.RGBA32F
if (!gl.getExtension('EXT_color_buffer_float')) {
  gl.getExtension('EXT_color_buffer_half_float')
  textureInternalFormat = gl.RGBA16F
}
if (!gl.getExtension('OES_texture_float_linear')) {
  gl.getExtension('OES_texture_half_float_linear')
}

const targetTexture = gl.createTexture()
gl.bindTexture(gl.TEXTURE_2D, targetTexture)
gl.texImage2D(gl.TEXTURE_2D, 0, textureInternalFormat, innerWidth * dpr, innerHeight * dpr, 0, gl.RGBA, gl.FLOAT, null)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
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

  setTimeout(() => {
    canvasbbox = canvas.getBoundingClientRect()
  }, 0)

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  // gl.blendEquation(gl.FUNC_SUBTRACT)

  let projectionMatrix = makeProjectionMatrix(innerWidth / 2, innerHeight / 2)

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

  
  
  gl.useProgram(null)

  requestAnimationFrame(renderFrame)

  canvas.addEventListener('mousemove', e => {
    if (e.pageX) {
      mousePos.x = e.pageX - canvasbbox.left
    } else {
      mousePos.x = e.changedTouches[0].pageX - canvasbbox.left
    }
    if (e.pageY) {
      mousePos.y = e.pageY - canvasbbox.top
    } else {
      mousePos.y = e.changedTouches[0].pageY - canvasbbox.top
    }
  })

  canvas.addEventListener('click', () => {
    isDebug = !isDebug
  })
  
}

function renderFrame (ts) {
  const dt = ts - oldTime
  oldTime = ts

  for (let i = 0; i < CONFIG.ballsCount; i++) {
    ballsVelocitiesArray[i * 2 + 1] += CONFIG.gravity
    ballsOffsetsArray[i * 2 + 0] += ballsVelocitiesArray[i * 2 + 0]
    ballsOffsetsArray[i * 2 + 1] += ballsVelocitiesArray[i * 2 + 1]


    if (ballsOffsetsArray[i * 2 + 0] < 0) {
      ballsOffsetsArray[i * 2 + 0] = 0
      ballsVelocitiesArray[i * 2 + 0] *= -1
    }
    if (ballsOffsetsArray[i * 2 + 0] > innerWidth) {
      ballsOffsetsArray[i * 2 + 0] = innerWidth
      ballsVelocitiesArray[i * 2 + 0] *= -1
    }

    if (ballsOffsetsArray[i * 2 + 1] - CONFIG.ballRadius > innerHeight) {
      // ballsOffsetsArray[i * 2 + 1] = -CONFIG.ballRadius
      ballsVelocitiesArray[i * 2 + 0] = (Math.random() * 2 - 1) * 5
      ballsVelocitiesArray[i * 2 + 1] = (Math.random() * 2 - 1) * 6

      
      // ballsVelocitiesArray[i * 2 + 1] = Math.random() * CONFIG.startVelocityY.max + CONFIG.startVelocityY.min

      ballsOffsetsArray[i * 2 + 0] = mousePos.x
      ballsOffsetsArray[i * 2 + 1] = mousePos.y
    }
  }

  // checkLine()

  gl.bindBuffer(gl.ARRAY_BUFFER, ballsOffsetsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, ballsOffsetsArray, gl.DYNAMIC_DRAW)
  
  if (isDebug) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  }

  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0.1, 0.1, 0.1, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.bindVertexArray(ballsVertexArrayObject)
  gl.useProgram(ballsWebGLProgram)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, CONFIG.ballsCount)
  gl.bindVertexArray(null)

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  gl.viewport(0, 0, canvas.width, canvas.height)

  if (isDebug) {
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
  canvasbbox = canvas.getBoundingClientRect()
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  canvas.style.width = `${innerWidth}px`
  canvas.style.height = `${innerHeight}px`
  
  projectionMatrix = makeProjectionMatrix(innerWidth / 2, innerHeight / 2)

  gl.useProgram(ballsWebGLProgram)
  u_projectionMatrix = gl.getUniformLocation(ballsWebGLProgram, 'u_projectionMatrix')
  gl.uniformMatrix4fv(u_projectionMatrix, false, projectionMatrix)
  gl.useProgram(null)

  gl.useProgram(quadWebGLProgram)
  u_projectionMatrix = gl.getUniformLocation(quadWebGLProgram, 'u_projectionMatrix')
  gl.uniformMatrix4fv(u_projectionMatrix, false, projectionMatrix)
  gl.useProgram(null)
  
  gl.useProgram(null)

  // const vertexArray = new Float32Array([
  //   0, innerHeight / 2,
  //   innerWidth / 2, innerHeight / 2,
  //   innerWidth / 2, 0,
  //   0, innerHeight / 2,
  //   innerWidth / 2, 0,
  //   0, 0
  // ])
  // gl.bindBuffer(gl.ARRAY_BUFFER, quadVertexBuffer)
  // gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW)

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


/* ------- Generic helpers ------- */
function isMobileBrowser () {
  return (function (isDebug) {
    if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(isDebug) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|isDebug wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|isDebug|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)isDebug|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[isDebug-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(isDebug|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-isDebug|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(isDebug.substr(0, 4))) {
      return true
    }
    return false
  })(navigator.userAgent || navigator.vendor || window.opera)
}

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
