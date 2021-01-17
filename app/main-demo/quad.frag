precision highp float;

#pragma glslify: grain = require(glsl-film-grain) 

uniform sampler2D u_texture;
uniform vec3 u_backgroundColor;
uniform vec3 u_thinBorderColor;
uniform vec3 u_fatBorderColor;
uniform vec3 u_metaballsColor;
uniform vec2 u_resolution;
uniform float u_grainBlendFactor;
uniform float u_time;

in vec2 v_uv;

out vec4 outputColor;

void main () {
  vec4 inputColor = texture(u_texture, v_uv);

  float cutoffThreshold = 0.14;

  float cutoff = step(cutoffThreshold, inputColor.a);
  float threshold = 0.005;

  outputColor = mix(
    vec4(u_backgroundColor, 1),
    vec4(u_thinBorderColor, 1),
    cutoff
  );

  cutoffThreshold += 0.0025;

  cutoff = step(cutoffThreshold, inputColor.a);
  outputColor = mix(
    outputColor,
    vec4(u_fatBorderColor, 1.0),
    cutoff
  );

  cutoffThreshold += 0.05;

  cutoff = step(cutoffThreshold, inputColor.a);
  outputColor = mix(
    outputColor,
    vec4(u_metaballsColor, 1.0),
    cutoff
  );

  float g = grain(v_uv, u_resolution.xy / 2.0 + u_time * 0.5);
  vec4 grainColor = vec4(g);

  outputColor = mix(outputColor, grainColor, u_grainBlendFactor);

  // outputColor = mix(inputColor, mix(baseColor, metaballsColor, cutoff), 0.3);

  // outputColor = inputColor;
}
