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
