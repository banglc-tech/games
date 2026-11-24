shader_type spatial;
// Son xe: doi mau cac vung co mau (than xe), giu nguyen vung xam/den/trang (kinh, can, gam).
uniform sampler2D tex : source_color;
uniform vec3 paint : source_color = vec3(0.9, 0.1, 0.1);
uniform float gloss = 0.75;

vec3 rgb2hsv(vec3 c) {
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
void fragment() {
	vec3 c = texture(tex, UV).rgb;
	vec3 h = rgb2hsv(c);
	vec3 p = rgb2hsv(paint);
	float m = smoothstep(0.28, 0.42, h.y);
	vec3 n = hsv2rgb(vec3(p.x, p.y, clamp(p.z * (0.55 + 0.55 * h.z), 0.0, 1.0)));
	ALBEDO = mix(c, n, m);
	METALLIC = mix(0.0, 0.6 * gloss, m);
	ROUGHNESS = mix(0.7, 1.0 - 0.75 * gloss, m);
}
