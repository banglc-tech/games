#!/usr/bin/env python3
# Va gara gia dinh vao ma nguon SuperTuxKart 1.5.  Chay: python3 apply.py /opt/stk/stk-code
import shutil, sys, os

R = sys.argv[1]
H = os.path.dirname(os.path.abspath(__file__))


def patch(rel, edits, marker):
    p = os.path.join(R, rel)
    s = open(p, encoding='utf-8').read()
    if marker in s:
        print('da va:', rel)
        return
    for a, b in edits:
        assert s.count(a) == 1, (rel, a, s.count(a))
        s = s.replace(a, b)
    assert marker in s, (rel, marker)
    open(p, 'w', encoding='utf-8').write(s)
    print('va:', rel)


shutil.copy(os.path.join(H, 'garage.stkgui'), os.path.join(R, 'data/gui/screens/garage.stkgui'))
shutil.copy(os.path.join(H, 'garage_screen.hpp'), os.path.join(R, 'src/states_screens/garage_screen.hpp'))
shutil.copy(os.path.join(H, 'garage_screen.cpp'), os.path.join(R, 'src/states_screens/garage_screen.cpp'))
shutil.copy(os.path.join(H, 'garage_characteristic.hpp'), os.path.join(R, 'src/karts/garage_characteristic.hpp'))

shutil.copy(os.path.join(H, 'garage_bg.png'), os.path.join(R, 'data/gui/icons/garage_bg.png'))
shutil.copy(os.path.join(H, 'garage_panel.png'), os.path.join(R, 'data/gui/icons/garage_panel.png'))
# bo nut cua gara: garage/*.png
os.makedirs(os.path.join(R, 'data/gui/icons/garage'), exist_ok=True)
for f in os.listdir(os.path.join(H, 'garage')):
    shutil.copy(os.path.join(H, 'garage', f), os.path.join(R, 'data/gui/icons/garage', f))

# 0. the giao dien moi <icon-stretch>: anh keo gian kin khung (dung cho anh nen gara)
patch('src/guiengine/screen_loader.cpp', [(
    '''                else if (wcscmp(L"icon", xml->getNodeName()) == 0)
                {''',
    '''                else if (wcscmp(L"icon-stretch", xml->getNodeName()) == 0)
                {
                    append_to.push_back(new IconButtonWidget(IconButtonWidget::SCALE_MODE_STRETCH,
                                                             false, false));
                }
                else if (wcscmp(L"icon", xml->getNodeName()) == 0)
                {''')], 'icon-stretch')

shutil.copy(os.path.join(H, 'garage_spoiler.hpp'), os.path.join(R, 'src/karts/garage_spoiler.hpp'))
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

# 1. cau hinh: 3 muc thong so cua gara
patch('src/config/user_config.hpp', [(
    '''    PARAM_PREFIX StringUserConfigParam m_last_used_kart_group''',
    '''    PARAM_PREFIX IntUserConfigParam m_garage_speed
            PARAM_DEFAULT( IntUserConfigParam(1, "garage_speed",
                           "Garage: top speed level 0-3 (1 = standard)") );
    PARAM_PREFIX IntUserConfigParam m_garage_power
            PARAM_DEFAULT( IntUserConfigParam(1, "garage_power",
                           "Garage: engine power level 0-3 (1 = standard)") );
    PARAM_PREFIX IntUserConfigParam m_garage_turn
            PARAM_DEFAULT( IntUserConfigParam(1, "garage_turn",
                           "Garage: steering level 0-3 (1 = standard)") );
    PARAM_PREFIX StringUserConfigParam m_last_used_kart_group''')], 'm_garage_speed')

# 2. KartProperties: them lop he so cua gara vao chuoi thong so
patch('src/karts/kart_properties.hpp', [(
    '''    void combineCharacteristics(HandicapLevel h);''',
    '''    void combineCharacteristics(HandicapLevel h);

    /** Thong so do nguoi choi chinh trong gara (NULL = khong dung). */
    std::shared_ptr<AbstractCharacteristic> m_garage_characteristic;

public:
    void setGarageTuning(int speed, int power, int turn, HandicapLevel h);
private:''')], 'setGarageTuning')

patch('src/karts/kart_properties.cpp', [(
    '''    m_combined_characteristic->addCharacteristic(m_characteristic.get());
    m_cached_characteristic = std::make_shared<CachedCharacteristic>''',
    '''    m_combined_characteristic->addCharacteristic(m_characteristic.get());
    if (m_garage_characteristic)
    {
        m_combined_characteristic->addCharacteristic(
            m_garage_characteristic.get());
    }
    m_cached_characteristic = std::make_shared<CachedCharacteristic>'''), (
    '''//-----------------------------------------------------------------------------
void KartProperties::combineCharacteristics(HandicapLevel handicap)''',
    '''//-----------------------------------------------------------------------------
/** Ap thong so chinh trong gara cho xe nay (chi goi cho xe cua nguoi choi). */
void KartProperties::setGarageTuning(int speed, int power, int turn,
                                     HandicapLevel h)
{
    if (!m_characteristic)
        return;
    if (speed == 1 && power == 1 && turn == 1)
        return;
    m_garage_characteristic = std::make_shared<GarageCharacteristic>(
        GarageCharacteristic::speedFactor(speed),
        GarageCharacteristic::powerFactor(power),
        GarageCharacteristic::turnFactor(turn));
    combineCharacteristics(h);
}   // setGarageTuning

//-----------------------------------------------------------------------------
void KartProperties::combineCharacteristics(HandicapLevel handicap)'''), (
    '''#include "karts/kart_properties.hpp"
''',
    '''#include "karts/kart_properties.hpp"
#include "karts/garage_characteristic.hpp"
''')], 'setGarageTuning')

# 3. Chi xe cua nguoi choi, khi khong choi mang, moi nhan thong so gara
patch('src/karts/abstract_kart.cpp', [(
    '''    m_kart_properties->copyForPlayer(kp, handicap);
''',
    '''    m_kart_properties->copyForPlayer(kp, handicap);
    if (!NetworkConfig::get()->isNetworking() &&
        RaceManager::get()->getKartGlobalPlayerId(m_world_kart_id) > -1)
    {
        m_kart_properties->setGarageTuning(UserConfigParams::m_garage_speed,
            UserConfigParams::m_garage_power, UserConfigParams::m_garage_turn,
            handicap);
    }
''')], 'setGarageTuning')

# 4. Menu chinh: nut Gara
patch('data/gui/screens/main_menu.stkgui', [(
    '''            <icon-button id="addons" width="128" height="128"''',
    '''            <icon-button id="garage" width="128" height="128"
                         icon="gui/icons/karts.png"
                         raw_text="Gara" word_wrap="true"/>
            <icon-button id="addons" width="128" height="128"''')], 'id="garage"')

patch('src/states_screens/main_menu_screen.cpp', [(
    '''    else if (selection == "options")
    {''',
    '''    else if (selection == "garage")
    {
        GarageScreen::getInstance()->push();
    }
    else if (selection == "options")
    {'''), (
    '''#include "states_screens/main_menu_screen.hpp"
''',
    '''#include "states_screens/main_menu_screen.hpp"
#include "states_screens/garage_screen.hpp"
''')], 'GarageScreen')
print('xong')
