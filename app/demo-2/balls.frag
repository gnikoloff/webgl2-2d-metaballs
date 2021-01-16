precision highp float;

in vec2 v_uv;

out vec4 outputColor;

void main () {
  float dist = distance(v_uv, vec2(0.5));
  float c = clamp(0.5 - dist, 0.0, 1.0);
  outputColor = vec4(vec3(1.0), c);
}
