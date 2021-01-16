uniform mat4 u_projectionMatrix;
uniform vec2 u_scale;

in vec4 a_position;
in vec2 a_uv;

out vec2 v_uv;

void main () {
  gl_Position = u_projectionMatrix * a_position;
  v_uv = a_uv;
}
