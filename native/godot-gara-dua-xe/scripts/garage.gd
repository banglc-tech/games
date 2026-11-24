extends Node3D
# GARA: phong trung bay xe + bang thiet ke (kieu xe, mau son, banh, canh gio, thong so). Tat ca mo san.

const ACCENT := Color("19d3ff")
const ACCENT2 := Color("ff3d8b")
const PANEL_BG := Color(0.05, 0.07, 0.11, 0.86)

var pivot: Node3D
var car: Node3D
var cam: Camera3D
var yaw := 0.6
var auto_spin := true
var dragging := false
var name_labels := {}
var stat_bars := {}
var paint_buttons: Array[Button] = []
# mau den cua phong (che do GARA_BG dung tong trung tinh, it mau)
var a1 := ACCENT
var a2 := ACCENT2
var strip_e := 2.2
var ring_e := 1.5

func _ready() -> void:
	if OS.has_environment("GARA_BG"):
		a1 = Color(0.80, 0.86, 0.95)
		a2 = Color(0.80, 0.86, 0.95)
		strip_e = 0.9
		ring_e = 0.8
	_build_room()
	if OS.has_environment("GARA_BG"):
		# Chi ve phong trung bay (khong xe, khong giao dien) de lam anh nen cho game khac
		set_process(false)
		await get_tree().create_timer(1.2).timeout
		get_viewport().get_texture().get_image().save_png(OS.get_environment("GARA_BG"))
		get_tree().quit()
		return
	_build_ui()
	_rebuild()
	if OS.has_environment("GARA_SHOT"):
		await get_tree().create_timer(1.6).timeout
		get_viewport().get_texture().get_image().save_png(OS.get_environment("GARA_SHOT"))
		if OS.has_environment("GARA_DRIVE"):
			get_tree().change_scene_to_file("res://scenes/main.tscn")
		else:
			get_tree().quit()

# ---------------- phong trung bay ----------------
func _emissive(c: Color, energy := 2.5) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	return m

func _box(size: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.material_override = mat
	mi.position = pos
	add_child(mi)
	return mi

func _build_room() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.02, 0.025, 0.04)
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.10, 0.14, 0.22)
	sm.sky_horizon_color = Color(0.45, 0.55, 0.7)
	sm.ground_bottom_color = Color(0.02, 0.02, 0.03)
	sm.ground_horizon_color = Color(0.25, 0.3, 0.4)
	sky.sky_material = sm
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.35, 0.42, 0.55)
	env.ambient_light_energy = 0.55
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.35
	env.glow_bloom = 0.15
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var floor_mat := StandardMaterial3D.new()
	floor_mat.albedo_color = Color(0.06, 0.07, 0.09)
	floor_mat.metallic = 0.5
	floor_mat.roughness = 0.28
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(40, 40)
	fl.mesh = pm
	fl.material_override = floor_mat
	add_child(fl)

	# ban xoay + vong den
	var tt_mat := StandardMaterial3D.new()
	tt_mat.albedo_color = Color(0.10, 0.11, 0.14)
	tt_mat.metallic = 0.8
	tt_mat.roughness = 0.2
	var tt := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 2.3
	cyl.bottom_radius = 2.4
	cyl.height = 0.12
	cyl.radial_segments = 48
	tt.mesh = cyl
	tt.material_override = tt_mat
	tt.position.y = 0.06
	add_child(tt)
	var ring := MeshInstance3D.new()
	var tor := TorusMesh.new()
	tor.inner_radius = 2.36
	tor.outer_radius = 2.46
	tor.rings = 64
	ring.mesh = tor
	ring.material_override = _emissive(a1, ring_e)
	ring.position.y = 0.07
	add_child(ring)

	# tuong sau + cac thanh den
	var wall_mat := StandardMaterial3D.new()
	wall_mat.albedo_color = Color(0.07, 0.08, 0.11)
	wall_mat.roughness = 0.6
	_box(Vector3(26, 7, 0.3), Vector3(0, 3.5, -6.5), wall_mat)
	for i in 7:
		var x := -9.0 + i * 3.0
		_box(Vector3(0.12, 5.0, 0.1), Vector3(x, 3.0, -6.3), _emissive(a1 if i % 2 == 0 else a2, strip_e))
	_box(Vector3(20, 0.1, 0.1), Vector3(0, 0.25, -6.3), _emissive(Color.WHITE, 1.6))
	# den tran
	for z in [-1.5, 1.5]:
		_box(Vector3(5.0, 0.06, 0.5), Vector3(0, 4.6, z), _emissive(Color(0.9, 0.95, 1.0), 3.5))

	var key := SpotLight3D.new()
	key.position = Vector3(2.5, 5.0, 3.5)
	key.spot_range = 14.0
	key.spot_angle = 38.0
	key.light_energy = 3.2
	key.shadow_enabled = true
	add_child(key)
	key.look_at(Vector3(0, 0.4, 0))
	var fill := SpotLight3D.new()
	fill.position = Vector3(-3.5, 4.0, 2.0)
	fill.spot_range = 12.0
	fill.spot_angle = 45.0
	fill.light_energy = 1.4
	fill.light_color = Color(0.7, 0.85, 1.0)
	add_child(fill)
	fill.look_at(Vector3(0, 0.4, 0))
	var rim1 := OmniLight3D.new()
	rim1.position = Vector3(-3.0, 1.2, -3.0)
	rim1.light_color = a1
	rim1.light_energy = 3.0 if a1 == ACCENT else 1.2
	rim1.omni_range = 8.0
	add_child(rim1)
	var rim2 := OmniLight3D.new()
	rim2.position = Vector3(3.0, 1.2, -3.0)
	rim2.light_color = a2
	rim2.light_energy = 3.0 if a2 == ACCENT2 else 1.2
	rim2.omni_range = 8.0
	add_child(rim2)

	pivot = Node3D.new()
	pivot.position.y = 0.12
	add_child(pivot)

	cam = Camera3D.new()
	cam.fov = 42.0
	add_child(cam)
	cam.position = Vector3(1.0, 1.7, 6.4)
	cam.look_at(Vector3(1.35, 0.5, 0))

func _rebuild() -> void:
	if car != null:
		pivot.remove_child(car)
		car.queue_free()
	car = GameConfig.build_model()
	pivot.add_child(car)
	GameConfig.save()
	_refresh_ui()

func _process(delta: float) -> void:
	if auto_spin and not dragging:
		yaw += delta * 0.35
	pivot.rotation.y = yaw

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventScreenTouch or e is InputEventMouseButton:
		dragging = e.pressed
		if e.pressed:
			auto_spin = false
	elif e is InputEventScreenDrag:
		yaw += e.relative.x * 0.008
	elif e is InputEventMouseMotion and dragging:
		yaw += e.relative.x * 0.008

# ---------------- giao dien ----------------
func _style(bg: Color, radius := 14, border := Color(0, 0, 0, 0), bw := 0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	s.border_color = border
	s.set_border_width_all(bw)
	s.content_margin_left = 14
	s.content_margin_right = 14
	s.content_margin_top = 5
	s.content_margin_bottom = 5
	return s

func _btn(text: String, cb: Callable, accent := false, min_size := Vector2(54, 44)) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = min_size
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 22)
	var base := ACCENT if accent else Color(0.16, 0.19, 0.26)
	b.add_theme_stylebox_override("normal", _style(base))
	b.add_theme_stylebox_override("hover", _style(base.lightened(0.12)))
	b.add_theme_stylebox_override("pressed", _style(base.darkened(0.2)))
	var fc := Color(0.03, 0.05, 0.08) if accent else Color(0.92, 0.95, 1.0)
	b.add_theme_color_override("font_color", fc)
	b.add_theme_color_override("font_hover_color", fc)
	b.add_theme_color_override("font_pressed_color", fc)
	b.pressed.connect(cb)
	return b

func _label(text: String, size := 20, col := Color(0.62, 0.72, 0.85)) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	return l

func _selector(box: VBoxContainer, title: String, key: String, count: int) -> void:
	box.add_child(_label(title, 15))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.add_child(_btn("<", _step.bind(key, -1, count, true)))
	var l := _label("", 23, Color.WHITE)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.clip_text = true
	row.add_child(l)
	name_labels[key] = l
	row.add_child(_btn(">", _step.bind(key, 1, count, true)))
	box.add_child(row)

func _stat(box: VBoxContainer, title: String, key: String) -> void:
	var n: int = GameConfig.LEVELS.size()
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var l := _label(title, 19, Color(0.85, 0.9, 1.0))
	l.custom_minimum_size.x = 118
	row.add_child(l)
	row.add_child(_btn("-", _step.bind(key, -1, n, false), false, Vector2(48, 38)))
	var bars := HBoxContainer.new()
	bars.add_theme_constant_override("separation", 5)
	bars.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bars.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var arr: Array[Panel] = []
	for i in n:
		var p := Panel.new()
		p.custom_minimum_size = Vector2(0, 18)
		p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bars.add_child(p)
		arr.append(p)
	stat_bars[key] = arr
	row.add_child(bars)
	row.add_child(_btn("+", _step.bind(key, 1, n, false), false, Vector2(48, 38)))
	box.add_child(row)

func _step(key: String, d: int, count: int, wrap: bool) -> void:
	var v: int = GameConfig.get(key) + d
	v = posmod(v, count) if wrap else clampi(v, 0, count - 1)
	GameConfig.set(key, v)
	_rebuild()

func _set_paint(i: int) -> void:
	GameConfig.paint = i
	_rebuild()

func _random() -> void:
	GameConfig.car = randi() % GameConfig.CARS.size()
	GameConfig.paint = 1 + randi() % (GameConfig.PAINTS.size() - 1)
	GameConfig.wheel = randi() % GameConfig.WHEELS.size()
	GameConfig.wheel_size = randi() % GameConfig.WHEEL_SIZES.size()
	GameConfig.spoiler = randi() % GameConfig.SPOILERS.size()
	_rebuild()

func _drive() -> void:
	GameConfig.save()
	get_tree().change_scene_to_file("res://scenes/main.tscn")

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	var title := VBoxContainer.new()
	title.position = Vector2(36, 26)
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	title.add_child(_label("GARA", 54, Color.WHITE))
	title.add_child(_label("Thiết kế xe đua của bạn  -  kéo để xoay xe", 19, ACCENT))
	layer.add_child(title)

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _style(PANEL_BG, 22, Color(ACCENT, 0.35), 2))
	panel.anchor_left = 1.0
	panel.anchor_right = 1.0
	panel.anchor_top = 0.0
	panel.anchor_bottom = 1.0
	panel.offset_left = -500
	panel.offset_right = -18
	panel.offset_top = 14
	panel.offset_bottom = -14
	layer.add_child(panel)

	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	panel.add_child(scroll)
	var box := VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 3)
	scroll.add_child(box)

	_selector(box, "KIỂU XE", "car", GameConfig.CARS.size())

	box.add_child(_label("MÀU SƠN", 15))
	var grid := GridContainer.new()
	grid.columns = 6
	grid.add_theme_constant_override("h_separation", 7)
	grid.add_theme_constant_override("v_separation", 7)
	for i in GameConfig.PAINTS.size():
		var b := Button.new()
		b.custom_minimum_size = Vector2(0, 34)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.focus_mode = Control.FOCUS_NONE
		if GameConfig.PAINTS[i][1] == null:
			b.text = "Gốc"
			b.add_theme_font_size_override("font_size", 17)
		b.pressed.connect(_set_paint.bind(i))
		grid.add_child(b)
		paint_buttons.append(b)
	box.add_child(grid)

	_selector(box, "KIỂU BÁNH", "wheel", GameConfig.WHEELS.size())
	_selector(box, "CỠ BÁNH", "wheel_size", GameConfig.WHEEL_SIZES.size())
	_selector(box, "CÁNH GIÓ", "spoiler", GameConfig.SPOILERS.size())

	box.add_child(_label("THÔNG SỐ", 15))
	_stat(box, "Tốc độ", "speed")
	_stat(box, "Tăng tốc", "accel")
	_stat(box, "Độ lái", "steer")

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.add_child(_btn("Ngẫu nhiên", _random, false, Vector2(150, 56)))
	var go := _btn("LÁI THỬ  >", _drive, true, Vector2(0, 56))
	go.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	go.add_theme_font_size_override("font_size", 30)
	row.add_child(go)
	box.add_child(row)

func _refresh_ui() -> void:
	name_labels["car"].text = GameConfig.CARS[GameConfig.car][1]
	name_labels["wheel"].text = GameConfig.WHEELS[GameConfig.wheel][0]
	name_labels["wheel_size"].text = GameConfig.WHEEL_SIZES[GameConfig.wheel_size][0]
	name_labels["spoiler"].text = GameConfig.SPOILERS[GameConfig.spoiler][0]
	for key in stat_bars:
		var lv: int = GameConfig.get(key)
		var arr: Array = stat_bars[key]
		for i in arr.size():
			arr[i].add_theme_stylebox_override("panel", _style(ACCENT if i <= lv else Color(0.2, 0.24, 0.32), 5))
	for i in paint_buttons.size():
		var c = GameConfig.PAINTS[i][1]
		var bg: Color = c if c != null else Color(0.16, 0.19, 0.26)
		var sel := i == GameConfig.paint
		var st := _style(bg, 10, Color.WHITE if sel else Color(1, 1, 1, 0.12), 4 if sel else 1)
		for s in ["normal", "hover", "pressed"]:
			paint_buttons[i].add_theme_stylebox_override(s, st)
