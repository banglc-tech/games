#!/usr/bin/env python3
# Chay 1 lan tren PC (thu muc patch/): them tinh nang DUOI XE vao bo va gara
#   - apply.py: cac ban va moi (cau hinh, kart_model, abstract_kart) + chep mo hinh
#   - gen-assets.sh: thanh 3 vach
#   - garage.stkgui: muc DUOI XE
#   - garage_screen.cpp: giao dien + mo hinh xem truoc
import os
H = os.path.dirname(os.path.abspath(__file__))


def edit(name, fn, marker, newline=None):
    p = os.path.join(H, name)
    s = open(p, encoding='utf-8', newline='').read()
    if marker in s:
        print('da co:', name)
        return
    s = fn(s.replace('\r\n', '\n'))
    assert marker in s, name
    open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print('sua:', name)


def one(s, a, b):
    assert s.count(a) == 1, a
    return s.replace(a, b)


# ---------------------------------------------------------------- apply.py
APPLY_ADD = r"""shutil.copy(os.path.join(H, 'garage_spoiler.hpp'), os.path.join(R, 'src/karts/garage_spoiler.hpp'))
# mo hinh duoi xe (tao bang glb2spm.py) + bang mau
for f in os.listdir(os.path.join(H, 'models')):
    shutil.copy(os.path.join(H, 'models', f), os.path.join(R, 'data/models', f))

# 5. duoi xe: cau hinh, gan vao mo hinh xe, ap cho xe nguoi choi
patch('src/config/user_config.hpp', [(
    '''    PARAM_PREFIX IntUserConfigParam m_garage_speed''',
    '''    PARAM_PREFIX IntUserConfigParam m_garage_spoiler
            PARAM_DEFAULT( IntUserConfigParam(0, "garage_spoiler",
                           "Garage: spoiler type 0-4 (0 = none)") );
    PARAM_PREFIX IntUserConfigParam m_garage_spoiler_size
            PARAM_DEFAULT( IntUserConfigParam(1, "garage_spoiler_size",
                           "Garage: spoiler size 0-2") );
    PARAM_PREFIX IntUserConfigParam m_garage_spoiler_height
            PARAM_DEFAULT( IntUserConfigParam(1, "garage_spoiler_height",
                           "Garage: spoiler height 0-2") );
    PARAM_PREFIX IntUserConfigParam m_garage_speed''')], 'm_garage_spoiler_size')

patch('src/karts/kart_model.hpp', [(
    '''    std::string m_hat_name;
''',
    '''    std::string m_hat_name;

    /** Gara: mo hinh duoi xe gan them ("" = khong) va vi tri cua no. */
    std::string m_spoiler_name;
    core::matrix4 m_spoiler_location;
'''), (
    '''    void setHatMeshName(const std::string &name) {m_hat_name = name; }''',
    '''    void setHatMeshName(const std::string &name) {m_hat_name = name; }
    /** Gara: gan duoi xe (goi truoc attachModel). */
    void setSpoiler(const std::string &name, const core::matrix4 &location)
    {
        m_spoiler_name = name;
        m_spoiler_location = location;
    }''')], 'setSpoiler')

patch('src/karts/kart_model.cpp', [(
    '''        configNode(node, *m_hat_location, bone_attachment ?
                getInverseBoneMatrix(m_hat_bone) : core::matrix4());
        file_manager->popTextureSearchPath();
    }
''',
    '''        configNode(node, *m_hat_location, bone_attachment ?
                getInverseBoneMatrix(m_hat_bone) : core::matrix4());
        file_manager->popTextureSearchPath();
    }

    // Gara: duoi xe gan them (chi xe nguoi choi co ten mo hinh)
    if (!m_spoiler_name.empty())
    {
        file_manager->pushTextureSearchPath
            (file_manager->getAsset(FileManager::MODEL,""), "models");
        scene::IMesh* spoiler_mesh = irr_driver->getAnimatedMesh
            (file_manager->getAsset(FileManager::MODEL, m_spoiler_name));
        if (spoiler_mesh)
        {
            scene::ISceneNode* spoiler_node = irr_driver->addMesh(
                spoiler_mesh, "spoiler", node, getRenderInfo());
            configNode(spoiler_node, m_spoiler_location, core::matrix4());
        }
        file_manager->popTextureSearchPath();
    }
'''), (
    '''    km->m_hat_name              = m_hat_name;
''',
    '''    km->m_hat_name              = m_hat_name;
    km->m_spoiler_name          = m_spoiler_name;
    km->m_spoiler_location      = m_spoiler_location;
''')], 'm_spoiler_name')

patch('src/karts/abstract_kart.cpp', [(
    '''        m_kart_model.reset(m_kart_properties->getKartModelCopy(ri));
    if (!new_hitbox)''',
    '''        m_kart_model.reset(m_kart_properties->getKartModelCopy(ri));
    if (!NetworkConfig::get()->isNetworking() &&
        RaceManager::get()->getKartGlobalPlayerId(m_world_kart_id) > -1 &&
        UserConfigParams::m_garage_spoiler > 0)
    {
        m_kart_model->setSpoiler(
            GarageSpoiler::meshName(UserConfigParams::m_garage_spoiler),
            GarageSpoiler::location(*m_kart_model,
                UserConfigParams::m_garage_spoiler,
                UserConfigParams::m_garage_spoiler_size,
                UserConfigParams::m_garage_spoiler_height));
    }
    if (!new_hitbox)'''), (
    '''#include "karts/kart_model.hpp"
''',
    '''#include "karts/kart_model.hpp"
#include "karts/garage_spoiler.hpp"
''')], 'GarageSpoiler')

"""


def f_apply(s):
    a = "# 1. cau hinh: 3 muc thong so cua gara\n"
    return one(s, a, APPLY_ADD + a)


edit('apply.py', f_apply, 'garage_spoiler.hpp')

# ---------------------------------------------------------------- gen-assets.sh
BAR3 = r"""# thanh 3 vach (co / do cao duoi xe): bar3_0..bar3_2
for n in 0 1 2; do
  cmd="convert -size 400x44 xc:none"
  for k in 0 1 2; do
    x=$((k*137)); col="$OFF"; [ $k -le $n ] && col="$ACC"
    cmd="$cmd -fill '$col' -draw \"roundrectangle $x,8 $((x+126)),35 9,9\""
  done
  eval "$cmd PNG32:bar3_$n.png"
done
"""
edit('gen-assets.sh', lambda s: one(s, 'ls | wc -l\n', BAR3 + 'ls | wc -l\n'), 'bar3_')

# ---------------------------------------------------------------- garage.stkgui
SPOILER_UI = """        <spacer height="1%" width="25"/>
        <label id="lbl-spoiler" width="100%" height="fit" text_align="left" raw_text="Spoiler"/>
        <div layout="horizontal-row" width="100%" height="8%">
            <icon-button id="spoiler-prev" width="16%" height="100%" icon="gui/icons/garage/prev.png"/>
            <label id="spoiler-label" proportion="1" height="100%" text_align="center" raw_text=""/>
            <icon-button id="spoiler-next" width="16%" height="100%" icon="gui/icons/garage/next.png"/>
        </div>
        <div layout="horizontal-row" width="100%" height="7%">
            <label id="lbl-ssize" width="27%" height="100%" text_align="left" raw_text="Size"/>
            <icon-button id="ssize-minus" width="13%" height="100%" icon="gui/icons/garage/minus.png"/>
            <icon id="ssize-bar" proportion="1" height="100%" icon="gui/icons/garage/bar3_1.png"/>
            <icon-button id="ssize-plus" width="13%" height="100%" icon="gui/icons/garage/plus.png"/>
        </div>
        <div layout="horizontal-row" width="100%" height="7%">
            <label id="lbl-sheight" width="27%" height="100%" text_align="left" raw_text="Height"/>
            <icon-button id="sheight-minus" width="13%" height="100%" icon="gui/icons/garage/minus.png"/>
            <icon id="sheight-bar" proportion="1" height="100%" icon="gui/icons/garage/bar3_1.png"/>
            <icon-button id="sheight-plus" width="13%" height="100%" icon="gui/icons/garage/plus.png"/>
        </div>

"""


def f_gui(s):
    s = one(s, '<div layout="horizontal-row" width="100%" height="10%">\n            <icon-button id="kart-prev"',
            '<div layout="horizontal-row" width="100%" height="8%">\n            <icon-button id="kart-prev"')
    s = s.replace('<div layout="horizontal-row" width="100%" height="9%">',
                  '<div layout="horizontal-row" width="100%" height="7%">')
    s = s.replace('<spacer height="2%" width="25"/>', '<spacer height="1%" width="25"/>')
    a = '        <spacer height="1%" width="25"/>\n        <label id="lbl-tune"'
    s = one(s, a, SPOILER_UI + a)
    s = one(s, '<icon-button id="race" width="100%" height="14%"', '<icon-button id="race" width="100%" height="11%"')
    return s


edit('garage.stkgui', f_gui, 'spoiler-prev')

# ---------------------------------------------------------------- garage_screen.cpp
BARS_OLD = """        w->setImage(img.c_str(), IconButtonWidget::ICON_PATH_TYPE_RELATIVE);
    }
}   // updateBars"""
BARS_NEW = """        w->setImage(img.c_str(), IconButtonWidget::ICON_PATH_TYPE_RELATIVE);
    }

    // Duoi xe: ten kieu + hai thanh 3 vach
    static const wchar_t* spoiler_names[GarageSpoiler::TYPE_COUNT] =
        { L"Không gắn", L"Cánh thấp", L"Cánh đôi", L"Cánh GT", L"Đuôi vịt" };
    getWidget<LabelWidget>("spoiler-label")->setText(
        spoiler_names[GarageSpoiler::clampType(
        UserConfigParams::m_garage_spoiler)], false);
    const char* ids[2] = { "ssize-bar", "sheight-bar" };
    const int vals[2] = { UserConfigParams::m_garage_spoiler_size,
                          UserConfigParams::m_garage_spoiler_height };
    for (int i = 0; i < 2; i++)
    {
        IconButtonWidget* w = getWidget<IconButtonWidget>(ids[i]);
        if (w == NULL)
            continue;
        std::string img = "gui/icons/garage/bar3_" +
            StringUtils::toString(GarageSpoiler::clamp3(vals[i])) + ".png";
        w->setImage(img.c_str(), IconButtonWidget::ICON_PATH_TYPE_RELATIVE);
    }
}   // updateBars"""
MODEL_OLD = """    m_model_view->setRotateContinuously(35.0f);
    m_model_view->update(0);
    updateColor();
}   // updateModel"""
MODEL_NEW = """    // Duoi xe gan them (cung vi tri nhu khi vao dua)
    const int sp_type = UserConfigParams::m_garage_spoiler;
    if (sp_type > 0)
    {
        file_manager->pushTextureSearchPath
            (file_manager->getAsset(FileManager::MODEL, ""), "models");
        scene::IMesh* sp_mesh = irr_driver->getAnimatedMesh(
            file_manager->getAsset(FileManager::MODEL,
            GarageSpoiler::meshName(sp_type)));
        if (sp_mesh)
        {
            m_model_view->addModel(sp_mesh, GarageSpoiler::location(
                kart_model, sp_type, UserConfigParams::m_garage_spoiler_size,
                UserConfigParams::m_garage_spoiler_height));
        }
        file_manager->popTextureSearchPath();
    }

    m_model_view->setRotateContinuously(35.0f);
    m_model_view->update(0);
    updateColor();
}   // updateModel"""
EVENT_OLD = """    if (name == "race")
    {"""
EVENT_NEW = """    if (name == "spoiler-prev" || name == "spoiler-next")
    {
        const int n = GarageSpoiler::TYPE_COUNT;
        UserConfigParams::m_garage_spoiler =
            (UserConfigParams::m_garage_spoiler +
            (name == "spoiler-next" ? 1 : n - 1)) % n;
        updateBars();
        updateModel();
        return;
    }
    if (name == "ssize-minus" || name == "ssize-plus")
    {
        UserConfigParams::m_garage_spoiler_size = GarageSpoiler::clamp3(
            UserConfigParams::m_garage_spoiler_size +
            (name == "ssize-plus" ? 1 : -1));
        updateBars();
        updateModel();
        return;
    }
    if (name == "sheight-minus" || name == "sheight-plus")
    {
        UserConfigParams::m_garage_spoiler_height = GarageSpoiler::clamp3(
            UserConfigParams::m_garage_spoiler_height +
            (name == "sheight-plus" ? 1 : -1));
        updateBars();
        updateModel();
        return;
    }
    if (name == "race")
    {"""
CLAMP_OLD = """    for (int i = 0; i < 3; i++)
        *tuneParam(i) = clampLevel(*tuneParam(i));
"""
CLAMP_NEW = CLAMP_OLD + """    UserConfigParams::m_garage_spoiler =
        GarageSpoiler::clampType(UserConfigParams::m_garage_spoiler);
    UserConfigParams::m_garage_spoiler_size =
        GarageSpoiler::clamp3(UserConfigParams::m_garage_spoiler_size);
    UserConfigParams::m_garage_spoiler_height =
        GarageSpoiler::clamp3(UserConfigParams::m_garage_spoiler_height);
"""


def f_cpp(s):
    s = one(s, '#include "karts/kart_model.hpp"\n',
            '#include "io/file_manager.hpp"\n#include "karts/garage_spoiler.hpp"\n#include "karts/kart_model.hpp"\n')
    s = one(s, '        { "lbl-tune",  L"THÔNG SỐ", true  },\n',
            '        { "lbl-tune",  L"THÔNG SỐ", true  },\n        { "lbl-spoiler", L"ĐUÔI XE", true  },\n'
            '        { "lbl-ssize",   L"Cỡ",      false },\n        { "lbl-sheight", L"Độ cao",  false },\n')
    s = one(s, '    getWidget<LabelWidget>("kart-label")->setColor(light);\n',
            '    getWidget<LabelWidget>("kart-label")->setColor(light);\n'
            '    getWidget<LabelWidget>("spoiler-label")->setColor(light);\n')
    s = one(s, CLAMP_OLD, CLAMP_NEW)
    s = one(s, BARS_OLD, BARS_NEW)
    s = one(s, MODEL_OLD, MODEL_NEW)
    s = one(s, EVENT_OLD, EVENT_NEW)
    return s


edit('garage_screen.cpp', f_cpp, 'GarageSpoiler')
print('xong')
