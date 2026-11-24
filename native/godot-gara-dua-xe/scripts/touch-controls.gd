extends CanvasLayer
# Lop nut tren man hinh khi dang lai: nut GARA (moi may) + nut cam ung trai/phai, ga/lui (may cam ung).
# Chi hien trong canh dua (main.tscn); o gara thi an.

const SIZE := 190
const MARGIN := 40

var holder: Control
var built_for := Vector2.ZERO

func _ready() -> void:
	layer = 10
	holder = Control.new()
	holder.set_anchors_preset(Control.PRESET_FULL_RECT)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(holder)
	if OS.has_environment("MAIN_SHOT"):
		_auto_shot()

func _auto_shot() -> void:
	await get_tree().create_timer(6.0).timeout
	Input.action_press("forward")
	await get_tree().create_timer(2.2).timeout
	get_viewport().get_texture().get_image().save_png(OS.get_environment("MAIN_SHOT"))
	get_tree().quit()

func _process(_delta: float) -> void:
	var sc := get_tree().current_scene
	var driving := sc != null and sc.scene_file_path.ends_with("main.tscn")
	holder.visible = driving
	if not driving:
		return
	var vp := get_viewport().get_visible_rect().size
	if vp != built_for:
		_build(vp)

func _to_garage() -> void:
	get_tree().change_scene_to_file("res://scenes/garage.tscn")

func _build(vp: Vector2) -> void:
	built_for = vp
	for c in holder.get_children():
		c.queue_free()
	var g := Button.new()
	g.text = "GARA"
	g.focus_mode = Control.FOCUS_NONE
	g.position = Vector2(MARGIN, 24)
	g.custom_minimum_size = Vector2(170, 64)
	g.add_theme_font_size_override("font_size", 28)
	g.pressed.connect(_to_garage)
	holder.add_child(g)
	if not DisplayServer.is_touchscreen_available() and not OS.has_feature("mobile"):
		return
	var y := vp.y - SIZE - MARGIN
	_button("left", "<", Vector2(MARGIN, y))
	_button("right", ">", Vector2(MARGIN * 2 + SIZE, y))
	_button("forward", "GA", Vector2(vp.x - SIZE - MARGIN, y))
	_button("back", "LUI", Vector2(vp.x - SIZE * 2 - MARGIN * 2, y))

func _button(action: String, text: String, pos: Vector2) -> void:
	var b := TouchScreenButton.new()
	b.texture_normal = _circle(Color(1, 1, 1, 0.28))
	b.texture_pressed = _circle(Color(1, 1, 1, 0.6))
	b.action = action
	b.position = pos
	b.passby_press = true
	holder.add_child(b)
	var l := Label.new()
	l.text = text
	l.size = Vector2(SIZE, SIZE)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", 56)
	l.add_theme_color_override("font_color", Color(0.1, 0.1, 0.15, 0.9))
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(l)

func _circle(c: Color) -> ImageTexture:
	var img := Image.create(SIZE, SIZE, false, Image.FORMAT_RGBA8)
	var r := SIZE / 2.0
	for yy in SIZE:
		for xx in SIZE:
			if Vector2(xx + 0.5 - r, yy + 0.5 - r).length() <= r - 2:
				img.set_pixel(xx, yy, c)
	return ImageTexture.create_from_image(img)
