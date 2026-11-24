#!/usr/bin/env python3
"""Chuyen mo hinh tinh sang dinh dang SPM (SuperTuxKart) - khong can Blender.

  python glb2spm.py                       -> tao bo canh gio cho gara vao ./models/

Dinh dang theo bo xuat chinh thuc io_scene_spm/export_spm.py (stk-blender):
  "SP", byte (version<<3 | 2 = SPMN), byte co (bit0 = co normal), 6 float bbox,
  u16 so vat lieu, moi vat lieu 2 chuoi (ten texture 1, 2), u16 so khu (1), u16 so mesh buffer,
  moi buffer: u32 so dinh, u32 so chi so, u16 vat lieu, cac dinh (pos 3 float, normal 2_10_10_10, uv 2 half),
  chi so u8 neu <= 255 dinh, nguoc lai u16.
Toa do: glTF tay phai (+Z la dau xe) -> STK tay trai: lat truc X va dao chieu tam giac.
"""
import json, math, os, shutil, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CARKIT = os.path.join(HERE, '..', '..', 'assets', 'car-kit', 'Models', 'GLB format')


def pack_normal(n):
    r = 0
    for i, v in enumerate(n[:3]):
        v = min(1.0, max(-1.0, v))
        part = int(v * 511.0 + 0.5) if v > 0.0 else int(v * 512.0 - 0.5)
        r |= (part & 1023) << (10 * i)
    return struct.pack('<I', r)


def write_spm(path, buffers):
    """buffers: [(texture_name, vertices[(pos, normal, uv)], indices)]"""
    allp = [v[0] for b in buffers for v in b[1]]
    mn = [min(p[i] for p in allp) for i in range(3)]
    mx = [max(p[i] for p in allp) for i in range(3)]
    out = bytearray()
    out += struct.pack('<H', 20563)                 # "SP"
    out += struct.pack('<B', (1 << 3) | 2)          # version 1, SPMN
    out += struct.pack('<B', 1)                     # co normal
    out += struct.pack('<6f', *mn, *mx)
    out += struct.pack('<H', len(buffers))
    for tex, _, _ in buffers:
        e = tex.encode()
        out += struct.pack('<B', len(e)) + e
        out += struct.pack('<B', 0)                 # khong co texture thu hai
    out += struct.pack('<H', 1)                     # 1 khu
    out += struct.pack('<H', len(buffers))
    for mat, (tex, verts, idx) in enumerate(buffers):
        assert 0 < len(verts) < 65536 and len(idx) % 3 == 0
        out += struct.pack('<IIH', len(verts), len(idx), mat)
        for pos, nor, uv in verts:
            out += struct.pack('<3f', *pos)
            out += pack_normal(nor)
            out += struct.pack('<2e', uv[0], uv[1])
        fmt = '<%d%s' % (len(idx), 'H' if len(verts) > 255 else 'B')
        out += struct.pack(fmt, *idx)
    open(path, 'wb').write(out)
    return len(allp), mn, mx


# ---------------- doc GLB ----------------
def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def node_matrix(n):
    if 'matrix' in n:
        m = n['matrix']
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    t = n.get('translation', [0, 0, 0]); q = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = q
    r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[r[i][0] * s[0], r[i][1] * s[1], r[i][2] * s[2], t[i]] for i in range(3)] + [[0, 0, 0, 1]]


def read_glb(path):
    d = open(path, 'rb').read()
    assert d[:4] == b'glTF'
    jl = struct.unpack_from('<I', d, 12)[0]
    js = json.loads(d[20:20 + jl])
    bl = struct.unpack_from('<I', d, 20 + jl)[0]
    binc = d[28 + jl:28 + jl + bl]

    def acc(i):
        a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
        n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        f = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}[a['componentType']]
        sz = struct.calcsize(f) * n
        st = bv.get('byteStride', sz)
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        res = [struct.unpack_from('<%d%s' % (n, f), binc, off + k * st) for k in range(a['count'])]
        return res if n > 1 else [x[0] for x in res]

    verts, idx = [], []

    def walk(ni, parent):
        n = js['nodes'][ni]
        m = mat_mul(parent, node_matrix(n))
        if 'mesh' in n:
            for p in js['meshes'][n['mesh']]['primitives']:
                pos = acc(p['attributes']['POSITION'])
                nor = acc(p['attributes']['NORMAL'])
                uv = acc(p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else [(0.0, 0.0)] * len(pos)
                ind = acc(p['indices']) if 'indices' in p else list(range(len(pos)))
                base = len(verts)
                for a, b, c in zip(pos, nor, uv):
                    wp = [m[i][0] * a[0] + m[i][1] * a[1] + m[i][2] * a[2] + m[i][3] for i in range(3)]
                    wn = [m[i][0] * b[0] + m[i][1] * b[1] + m[i][2] * b[2] for i in range(3)]
                    ln = math.sqrt(sum(x * x for x in wn)) or 1.0
                    # lat truc X (tay phai -> tay trai)
                    verts.append(((-wp[0], wp[1], wp[2]), (-wn[0] / ln, wn[1] / ln, wn[2] / ln), (c[0], c[1])))
                for k in range(0, len(ind), 3):
                    idx.extend([base + ind[k], base + ind[k + 2], base + ind[k + 1]])   # dao chieu
        for c in n.get('children', []):
            walk(c, m)

    ident = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
    for r in js['scenes'][js.get('scene', 0)]['nodes']:
        walk(r, ident)
    return verts, idx


def recenter(verts):
    """Dua mo hinh ve: giua theo X, day o y=0, giua theo Z."""
    mn = [min(v[0][i] for v in verts) for i in range(3)]
    mx = [max(v[0][i] for v in verts) for i in range(3)]
    off = ((mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2)
    return [((p[0] - off[0], p[1] - off[1], p[2] - off[2]), n, uv) for p, n, uv in verts]


# ---------------- mo hinh tu ve: hop chu nhat ----------------
def box(verts, idx, cx, cy, cz, sx, sy, sz, uv, rot_x=0.0):
    """Hop tam (cx,cy,cz), kich thuoc (sx,sy,sz), quay quanh truc X goc rot_x (rad). Mat ngoai theo chieu tay trai."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    faces = [((0, 0, 1), [(-hx, -hy, hz), (-hx, hy, hz), (hx, hy, hz), (hx, -hy, hz)]),
             ((0, 0, -1), [(hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz), (-hx, -hy, -hz)]),
             ((1, 0, 0), [(hx, -hy, hz), (hx, hy, hz), (hx, hy, -hz), (hx, -hy, -hz)]),
             ((-1, 0, 0), [(-hx, -hy, -hz), (-hx, hy, -hz), (-hx, hy, hz), (-hx, -hy, hz)]),
             ((0, 1, 0), [(-hx, hy, hz), (-hx, hy, -hz), (hx, hy, -hz), (hx, hy, hz)]),
             ((0, -1, 0), [(-hx, -hy, -hz), (-hx, -hy, hz), (hx, -hy, hz), (hx, -hy, -hz)])]
    c, s = math.cos(rot_x), math.sin(rot_x)

    def rx(p):
        return (p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c)
    for n, quad in faces:
        b = len(verts)
        rn = rx(n)
        for p in quad:
            rp = rx(p)
            verts.append(((rp[0] + cx, rp[1] + cy, rp[2] + cz), rn, uv))
        # thu tu dinh tren la nguoc chieu kim dong ho nhin tu ngoai (tay phai) -> dao lai cho tay trai
        idx.extend([b, b + 2, b + 1, b, b + 3, b + 2])


# o mau trong anh bang mau garage_parts.png (4 o ngang): than toi, kim loai sang, do, den
UV_DARK, UV_METAL, UV_RED, UV_BLACK = (0.125, 0.5), (0.375, 0.5), (0.625, 0.5), (0.875, 0.5)


def gt_wing():
    v, i = [], []
    box(v, i, -0.36, 0.14, 0.0, 0.035, 0.28, 0.10, UV_METAL)            # tru trai
    box(v, i, 0.36, 0.14, 0.0, 0.035, 0.28, 0.10, UV_METAL)             # tru phai
    box(v, i, 0.0, 0.30, -0.02, 1.25, 0.035, 0.30, UV_DARK, rot_x=0.16)  # canh chinh, hoi chuc
    box(v, i, -0.63, 0.30, -0.02, 0.03, 0.17, 0.36, UV_RED)             # tam chan trai
    box(v, i, 0.63, 0.30, -0.02, 0.03, 0.17, 0.36, UV_RED)              # tam chan phai
    return v, i


def ducktail():
    v, i = [], []
    box(v, i, 0.0, 0.05, 0.0, 1.05, 0.05, 0.34, UV_DARK, rot_x=0.42)     # tam vat len o duoi
    box(v, i, 0.0, 0.015, 0.10, 1.05, 0.03, 0.16, UV_BLACK)              # de
    return v, i


def main():
    out = os.path.join(HERE, 'models')
    os.makedirs(out, exist_ok=True)
    # bang mau 4 o cho mo hinh tu ve (PNG 4x1 viet tay, khong can thu vien)
    import zlib
    px = [(41, 48, 63), (190, 198, 210), (214, 40, 40), (16, 18, 22)]
    raw = b''.join(b'\x00' + b''.join(bytes(c) for c in px for _ in range(8)) for _ in range(8))

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 32, 8, 8, 2, 0, 0, 0)) + \
        chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    open(os.path.join(out, 'garage_parts.png'), 'wb').write(png)
    shutil.copy(os.path.join(CARKIT, 'Textures', 'colormap.png'), os.path.join(out, 'garage_carkit.png'))

    jobs = [('garage_spoiler_1.spm', 'kit', 'debris-spoiler-a.glb'),
            ('garage_spoiler_2.spm', 'kit', 'debris-spoiler-b.glb'),
            ('garage_spoiler_3.spm', 'gen', gt_wing),
            ('garage_spoiler_4.spm', 'gen', ducktail)]
    for name, kind, src in jobs:
        if kind == 'kit':
            v, i = read_glb(os.path.join(CARKIT, src)); tex = 'garage_carkit.png'
        else:
            v, i = src(); tex = 'garage_parts.png'
        v = recenter(v)
        n, mn, mx = write_spm(os.path.join(out, name), [(tex, v, i)])
        print('%-22s %4d dinh %4d tam giac  kich thuoc %.2f x %.2f x %.2f' %
              (name, n, len(i) // 3, mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]))


if __name__ == '__main__':
    main()
