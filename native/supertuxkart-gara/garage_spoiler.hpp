//  SuperTuxKart - gara gia dinh: duoi xe (canh gio) gan them.
//
//  This program is free software; you can redistribute it and/or
//  modify it under the terms of the GNU General Public License
//  as published by the Free Software Foundation; either version 3
//  of the License, or (at your option) any later version.

#ifndef HEADER_GARAGE_SPOILER_HPP
#define HEADER_GARAGE_SPOILER_HPP

#include "karts/kart_model.hpp"
#include "utils/string_utils.hpp"

#include <matrix4.h>
#include <string>

/** Kieu duoi xe: 0 = khong, 1..4 = cac mo hinh data/models/garage_spoiler_N.spm
 *  (tao bang patch/glb2spm.py). Co va do cao moi thu 3 nac. */
namespace GarageSpoiler
{
    const int TYPE_COUNT = 5;

    inline int clampType(int t) { return t < 0 ? 0 : t >= TYPE_COUNT ? 0 : t; }
    inline int clamp3(int v)    { return v < 0 ? 0 : v > 2 ? 2 : v; }

    inline std::string meshName(int type)
    {
        type = clampType(type);
        if (type == 0)
            return "";
        return "garage_spoiler_" + StringUtils::toString(type) + ".spm";
    }

    /** Vi tri + ti le cua duoi xe trong he toa do cua xe (goc o giua gam xe,
     *  +Z la dau xe): dat o phia duoi, cao theo nac, rong gan bang than xe. */
    inline irr::core::matrix4 location(const KartModel& km, int type,
                                       int size, int height)
    {
        // be rong cua tung mo hinh (don vi mo hinh), xem ket qua glb2spm.py
        static const float mesh_width[TYPE_COUNT] =
            { 1.0f, 1.10f, 1.00f, 1.29f, 1.05f };
        static const float size_factor[3]   = { 0.80f, 1.00f, 1.25f };
        static const float height_factor[3] = { 0.28f, 0.40f, 0.54f };
        type = clampType(type);
        const float s = km.getWidth() * 0.92f / mesh_width[type] *
            size_factor[clamp3(size)];
        const float y = km.getHeight() * height_factor[clamp3(height)];
        const float z = -km.getLength() * 0.5f + km.getLength() * 0.10f;

        irr::core::matrix4 t, sc;
        t.setTranslation(irr::core::vector3df(0.0f, y, z));
        sc.setScale(irr::core::vector3df(s, s, s));
        return t * sc;
    }
}

#endif
