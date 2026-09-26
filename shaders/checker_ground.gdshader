shader_type spatial;
// Big checkerboard on the ground, in world space, so you can SEE how fast
// you're going. Placeholder until the city arrives in Phase 3.

uniform vec3 color_a : source_color = vec3(0.36, 0.62, 0.32);
uniform vec3 color_b : source_color = vec3(0.30, 0.54, 0.27);
uniform float cell = 4.0;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 c = floor(world_pos.xz / cell);
	float k = mod(c.x + c.y, 2.0);
	ALBEDO = mix(color_a, color_b, k);
	ROUGHNESS = 0.9;
}
