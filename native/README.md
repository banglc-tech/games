# Game chạy trên máy (không phải web)

Hai thư mục này là mã nguồn game build ra file cài cho PC / Android, không chạy trên GitHub Pages.

## `supertuxkart-gara/` — Gara cho SuperTuxKart 1.5

Bộ vá thêm màn hình **Gara** vào [SuperTuxKart](https://supertuxkart.net) 1.5 (giấy phép GPL v3, giống game gốc):

- Nút "Gara" trong menu chính, phòng trưng bày tối, xe 3D xoay trên bàn xoay.
- Chọn xe, 12 ô màu sơn, đuôi xe gắn thêm (4 kiểu, chỉnh cỡ và độ cao), ba thông số Tốc độ / Động cơ / Độ lái.
- Thông số và đuôi xe áp cho xe của người chơi khi chơi một máy (khi chơi mạng thì dùng mặc định).

| File | Vai trò |
|---|---|
| `apply.py` | Vá vào mã nguồn: `python3 apply.py <thư mục stk-code>` (tag `1.5`), chạy lại nhiều lần được |
| `garage_screen.cpp/.hpp`, `garage.stkgui` | Màn hình gara và bố cục |
| `garage_characteristic.hpp` | Hệ số tốc độ, công suất, độ lái của xe người chơi |
| `garage_spoiler.hpp` | Tên mô hình và vị trí đuôi xe |
| `glb2spm.py` | Chuyển mô hình GLB sang định dạng SPM của game (không cần Blender), tạo `models/` |
| `gen-assets.sh` | Vẽ bộ nút `garage/*.png` bằng ImageMagick |
| `garage_bg.png` | Ảnh nền phòng trưng bày (render từ dự án Godot bên cạnh, biến môi trường `GARA_BG`) |
| `android-build.sh` | Build bản Android arm64 trong Docker (đang hoàn thiện) |
| `t.sh` | Chạy thử trên màn hình ảo (Xvfb) và chụp ảnh |
| `anh/` | Ảnh chụp gara |

Build bản PC (Linux/WSL): clone `supertuxkart/stk-code` tag `1.5`, chép dữ liệu game (karts, tracks…) vào `data/`,
chạy `apply.py`, rồi `cmake .. -DCHECK_ASSETS=off -DNO_SHADERC=on && make`.

Trạng thái: bản PC đã build và thử gara bằng ảnh chụp; chưa thử đuôi xe và thông số trong lúc đua; bản Android chưa build xong.

## `godot-gara-dua-xe/` — Game đua xe nhỏ bằng Godot 4.6

Dựa trên [Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) (MIT), thêm:

- Gara (`scripts/garage.gd`): 16 kiểu xe từ Kenney Car Kit (CC0), 11 màu sơn, kiểu và cỡ bánh, cánh gió, ba thông số.
- Nút cảm ứng khi lái (`scripts/touch-controls.gd`), cấu hình xe lưu ở `user://gara.cfg` (`scripts/game-config.gd`).

Mở bằng Godot 4.6, xuất Android bằng preset "Android" (cần tự khai keystore trong Godot).
