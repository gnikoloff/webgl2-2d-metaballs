precision highp float;

uniform sampler2D u_texture;

in vec2 v_uv;

out vec4 outputColor;

void main () {
  vec4 inputColor = texture(u_texture, v_uv);

  float cutoffThreshold = 0.14;

  float cutoff = step(cutoffThreshold, inputColor.a);
  float threshold = 0.005;

  outputColor = mix(
    vec4(0.169,0.227,0.404, 1),
    vec4(1.,0.608,0.443, 1),
    cutoff
  );

  cutoffThreshold += 0.05;

  cutoff = step(cutoffThreshold, inputColor.a);
  outputColor = mix(
    outputColor,
    vec4(0.91,0.282,0.333, 1),
    cutoff
  );
}
