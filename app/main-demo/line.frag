precision highp float;

uniform sampler2D u_textTexture;

in vec2 v_uv;

out vec4 outputColor;

void main () {
  outputColor = texture(u_textTexture, v_uv);
}
