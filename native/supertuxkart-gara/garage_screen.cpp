//  SuperTuxKart - gara gia dinh: chon xe, mau son va thong so.
//
//  This program is free software; you can redistribute it and/or
//  modify it under the terms of the GNU General Public License
//  as published by the Free Software Foundation; either version 3
//  of the License, or (at your option) any later version.

#include "states_screens/garage_screen.hpp"

#include "config/player_manager.hpp"
#include "config/player_profile.hpp"
#include "config/user_config.hpp"
#include "graphics/irr_driver.hpp"
#include <ge_render_info.hpp>
#include "guiengine/engine.hpp"
#include "guiengine/widgets/icon_button_widget.hpp"
#include "guiengine/widgets/label_widget.hpp"
#include "guiengine/widgets/model_view_widget.hpp"
#include "io/file_manager.hpp"
#include "karts/garage_spoiler.hpp"
#include "karts/kart_model.hpp"
#include "karts/kart_properties.hpp"
#include "karts/kart_properties_manager.hpp"
#include "network/network_config.hpp"
#include "states_screens/offline_kart_selection.hpp"
#include "states_screens/state_manager.hpp"
#include "utils/log.hpp"
#include "utils/string_utils.hpp"

#include <cmath>

using namespace GUIEngine;

namespace
{
    const int PAINT_COUNT = 12;
    /** Sac do (0..1) cua tung o mau; o 0 = giu mau goc cua xe. Thu tu khop
     *  voi cac anh sw_N.png: do, cam, vang, xanh chuoi, xanh la, xanh ngoc,
     *  xanh duong, cham, tim, canh sen, hong. */
    const float PAINT_HUE[PAINT_COUNT] =
    {
        0.0f, 1.0f, 0.085f, 0.15f, 0.22f, 0.34f, 0.52f, 0.61f, 0.70f, 0.78f,
        0.87f, 0.94f
    };
    const char* TUNE_IDS[3] = { "speed", "power", "turn" };

    int clampLevel(int v) { return v < 0 ? 0 : v > 3 ? 3 : v; }

    IntUserConfigParam* tuneParam(int i)
    {
        return i == 0 ? &UserConfigParams::m_garage_speed :
               i == 1 ? &UserConfigParams::m_garage_power :
                        &UserConfigParams::m_garage_turn;
    }
}

// ----------------------------------------------------------------------------
GarageScreen::GarageScreen() : Screen("garage.stkgui")
{
    m_model_view = NULL;
    m_kart_index = 0;
    m_paint = 0;
}   // GarageScreen

// ----------------------------------------------------------------------------
void GarageScreen::loadedFromFile()
{
}   // loadedFromFile

// ----------------------------------------------------------------------------
void GarageScreen::beforeAddingWidget()
{
    m_model_view = getWidget<ModelViewWidget>("model");
    const core::dimension2du screen_size = irr_driver->getActualScreenSize();
    bool need_hd_rtt = (screen_size.Width > 1280 || screen_size.Height > 1280);
    m_model_view->setRTTSize(need_hd_rtt ? 1024 : 512);
}   // beforeAddingWidget

// ----------------------------------------------------------------------------
void GarageScreen::init()
{
    Screen::init();

    // Nen toi -> chu sang. Chu tieng Viet dat tu ma nguon (raw_text trong
    // file giao dien khong doc dung UTF-8).
    const video::SColor light(255, 232, 244, 255);
    const video::SColor accent(255, 150, 168, 190);   // xam xanh diu, it mau
    struct { const char* id; const wchar_t* text; bool head; } labels[] =
    {
        { "lbl-kart",  L"KIỂU XE",  true  },
        { "lbl-color", L"MÀU SƠN",  true  },
        { "lbl-tune",  L"THÔNG SỐ", true  },
        { "lbl-spoiler", L"ĐUÔI XE", true  },
        { "lbl-ssize",   L"Cỡ",      false },
        { "lbl-sheight", L"Độ cao",  false },
        { "lbl-speed", L"Tốc độ",   false },
        { "lbl-power", L"Động cơ",  false },
        { "lbl-turn",  L"Độ lái",   false },
    };
    for (auto& l : labels)
    {
        LabelWidget* w = getWidget<LabelWidget>(l.id);
        w->setText(l.text, false);
        w->setColor(l.head ? accent : light);
    }
    getWidget<LabelWidget>("kart-label")->setColor(light);
    getWidget<LabelWidget>("spoiler-label")->setColor(light);
    getWidget<LabelWidget>("kart-name")->setColor(light);
    getWidget<LabelWidget>("title")->setColor(light);

    // Danh sach xe: tat ca xe dang co (ke ca xe addon), mo san
    m_idents.clear();
    m_kart_index = 0;
    const std::string def = UserConfigParams::m_default_kart;
    for (unsigned int i = 0; i < kart_properties_manager->getNumberOfKarts();
         i++)
    {
        const KartProperties* kp = kart_properties_manager->getKartById(i);
        if (kp == NULL)
            continue;
        if (kp->getIdent() == def)
            m_kart_index = (int)m_idents.size();
        m_idents.push_back(kp->getIdent());
    }

    // O mau gan nhat voi mau da luu
    m_paint = 0;
    PlayerProfile* pp = PlayerManager::getCurrentPlayer();
    float hue = pp ? pp->getDefaultKartColor() : 0.0f;
    if (hue > 0.0f)
    {
        float best = 10.0f;
        for (int i = 1; i < PAINT_COUNT; i++)
        {
            float d = fabsf(PAINT_HUE[i] - hue);
            if (d > 0.5f) d = 1.0f - d;
            if (d < best) { best = d; m_paint = i; }
        }
    }

    for (int i = 0; i < 3; i++)
        *tuneParam(i) = clampLevel(*tuneParam(i));
    UserConfigParams::m_garage_spoiler =
        GarageSpoiler::clampType(UserConfigParams::m_garage_spoiler);
    UserConfigParams::m_garage_spoiler_size =
        GarageSpoiler::clamp3(UserConfigParams::m_garage_spoiler_size);
    UserConfigParams::m_garage_spoiler_height =
        GarageSpoiler::clamp3(UserConfigParams::m_garage_spoiler_height);

    updateSwatches();
    updateBars();
    updateModel();
}   // init

// ----------------------------------------------------------------------------
void GarageScreen::updateSwatches()
{
    for (int i = 0; i < PAINT_COUNT; i++)
    {
        IconButtonWidget* w = getWidget<IconButtonWidget>(
            ("c" + StringUtils::toString(i)).c_str());
        if (w == NULL)
            continue;
        std::string img = "gui/icons/garage/sw_" + StringUtils::toString(i) +
            (i == m_paint ? "_on.png" : ".png");
        w->setImage(img.c_str(), IconButtonWidget::ICON_PATH_TYPE_RELATIVE);
    }
}   // updateSwatches

// ----------------------------------------------------------------------------
void GarageScreen::updateBars()
{
    for (int i = 0; i < 3; i++)
    {
        IconButtonWidget* w = getWidget<IconButtonWidget>(
            (std::string(TUNE_IDS[i]) + "-bar").c_str());
        if (w == NULL)
            continue;
        std::string img = "gui/icons/garage/bar_" +
            StringUtils::toString(clampLevel(*tuneParam(i))) + ".png";
        w->setImage(img.c_str(), IconButtonWidget::ICON_PATH_TYPE_RELATIVE);
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
}   // updateBars

// ----------------------------------------------------------------------------
void GarageScreen::updateColor()
{
    if (m_model_view == NULL)
        return;
    m_model_view->getModelViewRenderInfo()->setHue(PAINT_HUE[m_paint]);
}   // updateColor

// ----------------------------------------------------------------------------
void GarageScreen::updateModel()
{
    if (m_idents.empty())
        return;
    const std::string& ident = m_idents[m_kart_index];
    const KartProperties* props = kart_properties_manager->getKart(ident);
    if (props == NULL)
    {
        Log::warn("GarageScreen", "Unknown kart %s", ident.c_str());
        return;
    }
    UserConfigParams::m_default_kart = ident;
    getWidget<LabelWidget>("kart-name")->setText(props->getName(), false);
    getWidget<LabelWidget>("kart-label")->setText(props->getName(), false);

    const KartModel& kart_model = props->getMasterKartModel();

    m_model_view->clearModels();

    core::matrix4 model_location;
    float scale = 35.0f;
    if (kart_model.getLength() > 1.45f)
        scale = 30.0f;
    model_location.setScale(core::vector3df(scale, scale, scale));

    // Than xe + banh + cac vat gan theo toc do, giong man hinh chon xe
    m_model_view->addModel(kart_model.getModel(), model_location,
                           kart_model.getBaseFrame(),
                           kart_model.getBaseFrame());

    model_location.setScale(core::vector3df(1.0f, 1.0f, 1.0f));
    for (unsigned i = 0; i < 4; i++)
    {
        model_location.setTranslation(kart_model
            .getWheelGraphicsPosition(i).toIrrVector());
        m_model_view->addModel(kart_model.getWheelModel(i), model_location);
    }

    for (unsigned i = 0; i < kart_model.getSpeedWeightedObjectsCount(); i++)
    {
        const SpeedWeightedObject& obj = kart_model.getSpeedWeightedObject(i);
        core::matrix4 swol = obj.m_location;
        if (!obj.m_bone_name.empty())
        {
            core::matrix4 inv =
                kart_model.getInverseBoneMatrix(obj.m_bone_name);
            swol = inv * obj.m_location;
        }
        m_model_view->addModel(obj.m_model, swol, -1, -1, 0.0f,
            obj.m_bone_name);
    }

    // Duoi xe gan them (cung vi tri nhu khi vao dua)
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
}   // updateModel

// ----------------------------------------------------------------------------
void GarageScreen::saveAll()
{
    PlayerProfile* pp = PlayerManager::getCurrentPlayer();
    if (pp)
        pp->setDefaultKartColor(PAINT_HUE[m_paint]);
    PlayerManager::get()->save();
    user_config->saveConfig();
}   // saveAll

// ----------------------------------------------------------------------------
void GarageScreen::tearDown()
{
    saveAll();
    Screen::tearDown();
}   // tearDown

// ----------------------------------------------------------------------------
void GarageScreen::eventCallback(Widget* widget, const std::string& name,
                                 const int playerID)
{
    if (name == "back")
    {
        StateManager::get()->escapePressed();
        return;
    }
    if (name == "kart-prev" || name == "kart-next")
    {
        const int n = (int)m_idents.size();
        if (n == 0)
            return;
        m_kart_index = (m_kart_index + (name == "kart-next" ? 1 : n - 1)) % n;
        updateModel();
        return;
    }
    if (name.size() >= 2 && name[0] == 'c' && isdigit(name[1]))
    {
        int i = atoi(name.c_str() + 1);
        if (i >= 0 && i < PAINT_COUNT)
        {
            m_paint = i;
            updateSwatches();
            updateColor();
        }
        return;
    }
    for (int i = 0; i < 3; i++)
    {
        const std::string id = TUNE_IDS[i];
        if (name == id + "-minus" || name == id + "-plus")
        {
            *tuneParam(i) = clampLevel(*tuneParam(i) +
                (name == id + "-plus" ? 1 : -1));
            updateBars();
            return;
        }
    }
    if (name == "spoiler-prev" || name == "spoiler-next")
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
    {
        saveAll();
        NetworkConfig::get()->unsetNetworking();
        KartSelectionScreen* s = OfflineKartSelectionScreen::getInstance();
        s->setMultiplayer(false);
        s->setFromOverworld(false);
        s->push();
    }
}   // eventCallback
