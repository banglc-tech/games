//  SuperTuxKart - gara gia dinh: chon xe, mau son va thong so.
//
//  This program is free software; you can redistribute it and/or
//  modify it under the terms of the GNU General Public License
//  as published by the Free Software Foundation; either version 3
//  of the License, or (at your option) any later version.

#ifndef HEADER_GARAGE_SCREEN_HPP
#define HEADER_GARAGE_SCREEN_HPP

#include "guiengine/screen.hpp"

#include <string>
#include <vector>

namespace GUIEngine
{
    class Widget;
    class ModelViewWidget;
}

class GarageScreen : public GUIEngine::Screen,
                     public GUIEngine::ScreenSingleton<GarageScreen>
{
    friend class GUIEngine::ScreenSingleton<GarageScreen>;
    GarageScreen();

    GUIEngine::ModelViewWidget* m_model_view;

    /** Ten dinh danh cac xe, theo thu tu duyet. */
    std::vector<std::string>    m_idents;
    /** Xe dang chon (chi so trong m_idents). */
    int                         m_kart_index;
    /** O mau dang chon: 0 = mau goc, 1..11 = cac mau. */
    int                         m_paint;

    void updateModel();
    void updateColor();
    void updateBars();
    void updateSwatches();
    void saveAll();

public:
    virtual void loadedFromFile() OVERRIDE;
    virtual void beforeAddingWidget() OVERRIDE;
    virtual void init() OVERRIDE;
    virtual void tearDown() OVERRIDE;
    virtual void eventCallback(GUIEngine::Widget* widget,
                               const std::string& name,
                               const int playerID) OVERRIDE;
};

#endif
