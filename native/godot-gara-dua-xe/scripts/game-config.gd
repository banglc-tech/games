extends Node
# Cau hinh xe cua gara (luu vao user://gara.cfg) + ham lap rap mo hinh xe dung chung cho gara va luc lai.

const SAVE := "user://gara.cfg"
const CARS := [
	["race", "Xe đua"], ["race-future", "Xe đua tương lai"], ["sedan-sports", "Sedan thể thao"],
	["hatchback-sports", "Hatchback thể thao"], ["sedan", "Sedan"], ["suv", "SUV"], ["suv-luxury", "SUV hạng sang"],
	["police", "Xe cảnh sát"], ["taxi", "Taxi"], ["truck", "Bán tải"], ["van", "Xe van"], ["firetruck", "Xe cứu hoả"],
	["ambulance", "Xe cứu thương"], ["tractor", "Máy kéo"], ["delivery", "Xe giao hàng"], ["garbage-truck", "Xe chở rác"],
]
const PAINTS := [
	["Nguyên bản", null], ["Đỏ", Color("e53935")], ["Cam", Color("fb8c00")], ["Vàng", Color("fdd835")],
	["Xanh lá", Color("43a047")], ["Xanh ngọc", Color("00acc1")], ["Xanh dương", Color("1e63e9")], ["Tím", Color("8e24aa")],
	["Hồng", Color("ec407a")], ["Trắng", Color("f2f2f2")], ["Bạc", Color("9aa3ad")], ["Đen", Color("202226")],
]
const WHEELS := [["Nguyên bản", ""], ["Thường", "wheel-default"], ["Đen", "wheel-dark"], ["Đua", "wheel-racing"], ["Tải", "wheel-truck"]]
const WHEEL_SIZES := [["Nhỏ", 1.0], ["Vừa", 1.2], ["To", 1.45]]
const SPOILERS := [["Không", ""], ["Kiểu A", "debris-spoiler-a"], ["Kiểu B", "debris-spoiler-b"]]
const LEVELS := [0.75, 1.0, 1.25, 1.5]
const WHEEL_NAMES := ["wheel-front-left", "wheel-front-right", "wheel-back-left", "wheel-back-right"]
const KEYS := ["car", "paint", "wheel", "wheel_size", "spoiler", "speed", "accel", "steer"]

var car := 0
var paint := 0
var wheel := 0
var wheel_size := 0
var spoiler := 0
var speed := 1
var accel := 1
var steer := 1

var _shader: Shader = preload("res://scripts/car_paint.gdshader")

func _ready() -> void:
	var f := ConfigFile.new()
	if f.load(SAVE) == OK:
		for k in KEYS:
			set(k, int(f.get_value("xe", k, get(k))))
	car = clampi(car, 0, CARS.size() - 1)
	paint = clampi(paint, 0, PAINTS.size() - 1)
	wheel = clampi(wheel, 0, WHEELS.size() - 1)
	wheel_size = clampi(wheel_size, 0, WHEEL_SIZES.size() - 1)
	spoiler = clampi(spoiler, 0, SPOILERS.size() - 1)
	speed = clampi(speed, 0, LEVELS.size() - 1)
	accel = clampi(accel, 0, LEVELS.size() - 1)
	steer = clampi(steer, 0, LEVELS.size() - 1)

func save() -> void:
	var f := ConfigFile.new()
	for k in KEYS:
		f.set_value("xe", k, get(k))
	f.save(SAVE)

func level(i: int) -> float:
	return LEVELS[clampi(i, 0, LEVELS.size() - 1)]

func _first_mesh(path: String) -> Mesh:
	var n: Node = load(path).instantiate()
	var found: Mesh = null
	for c in n.find_children("*", "MeshInstance3D", true, false):
		found = (c as MeshInstance3D).mesh
		break
	n.free()
	return found

func _paint_mesh(mi: MeshInstance3D, col: Color) -> void:
	for i in mi.mesh.get_surface_count():
		var src := mi.mesh.surface_get_material(i) as BaseMaterial3D
		if src == null or src.albedo_texture == null:
			continue
		var m := ShaderMaterial.new()
		m.shader = _shader
		m.set_shader_parameter("tex", src.albedo_texture)
		m.set_shader_parameter("paint", col)
		mi.set_surface_override_material(i, m)

# Diem cao nhat cua than xe o phia duoi xe (de dat canh gio)
func _rear_top(body: MeshInstance3D) -> Vector3:
	var ab := body.mesh.get_aabb()
	var rear := ab.position.z
	var top := ab.position.y
	for s in body.mesh.get_surface_count():
		var verts: PackedVector3Array = body.mesh.surface_get_arrays(s)[Mesh.ARRAY_VERTEX]
		for v in verts:
			if v.z < rear + 0.3 and v.y > top:
				top = v.y
	return Vector3(0, top, rear)

# Lap mo hinh xe theo cau hinh hien tai. Tra ve Node3D co cac nut con: body, wheel-front-left ... (giong mo hinh goc).
func build_model() -> Node3D:
	var root: Node3D = load("res://models/cars/%s.glb" % CARS[car][0]).instantiate()
	var body := root.get_node_or_null("body") as MeshInstance3D
	var col = PAINTS[paint][1]

	if body != null and SPOILERS[spoiler][1] != "":
		var sm := _first_mesh("res://models/cars/%s.glb" % SPOILERS[spoiler][1])
		if sm != null:
			var sp := MeshInstance3D.new()
			sp.name = "canh-gio"
			sp.mesh = sm
			var sa := sm.get_aabb()
			var rt := _rear_top(body)
			sp.position = Vector3(0, rt.y - sa.position.y - 0.02, rt.z - sa.position.z + 0.04)
			body.add_child(sp)

	if body != null and col != null:
		_paint_mesh(body, col)
		for c in body.find_children("*", "MeshInstance3D", true, false):
			_paint_mesh(c, col)

	var wmesh: Mesh = null
	if WHEELS[wheel][1] != "":
		wmesh = _first_mesh("res://models/cars/%s.glb" % WHEELS[wheel][1])
	var ws: float = WHEEL_SIZES[wheel_size][1]
	var lift := 0.0
	for wn in WHEEL_NAMES:
		var w := root.get_node_or_null(wn) as MeshInstance3D
		if w == null:
			continue
		var old := w.mesh.get_aabb().size
		var sc := Vector3.ONE
		if wmesh != null:
			var ns := wmesh.get_aabb().size
			w.mesh = wmesh
			sc = Vector3(old.x / ns.x, old.y / ns.y, old.z / ns.z)
			if wn.ends_with("right"):
				sc.x = -sc.x
		w.scale = sc * Vector3(1.0 + (ws - 1.0) * 0.5, ws, ws)
		lift = maxf(lift, old.y * 0.5 * (ws - 1.0))
	if lift > 0.0:
		for c in root.get_children():
			if c is Node3D:
				c.position.y += lift
	return root
