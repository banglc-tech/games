//  SuperTuxKart - gara gia dinh: thong so xe do nguoi choi tu chinh.
//
//  This program is free software; you can redistribute it and/or
//  modify it under the terms of the GNU General Public License
//  as published by the Free Software Foundation; either version 3
//  of the License, or (at your option) any later version.

#ifndef HEADER_GARAGE_CHARACTERISTIC_HPP
#define HEADER_GARAGE_CHARACTERISTIC_HPP

#include "karts/abstract_characteristic.hpp"
#include "utils/interpolation_array.hpp"

/** Nhan them he so vao thong so da tinh cua xe (toc do toi da, cong suat
 *  may, ban kinh quay dau). Dat cuoi chuoi CombinedCharacteristic. */
class GarageCharacteristic : public AbstractCharacteristic
{
private:
    float m_speed;
    float m_power;
    float m_turn;

public:
    GarageCharacteristic(float speed, float power, float turn)
        : m_speed(speed), m_power(power), m_turn(turn) {}

    static float speedFactor(int level)
    {
        static const float f[4] = { 0.8f, 1.0f, 1.2f, 1.4f };
        return f[level < 0 ? 0 : level > 3 ? 3 : level];
    }
    static float powerFactor(int level)
    {
        static const float f[4] = { 0.8f, 1.0f, 1.3f, 1.6f };
        return f[level < 0 ? 0 : level > 3 ? 3 : level];
    }
    static float turnFactor(int level)
    {
        static const float f[4] = { 0.85f, 1.0f, 1.2f, 1.4f };
        return f[level < 0 ? 0 : level > 3 ? 3 : level];
    }

    virtual void process(CharacteristicType type, Value value,
                         bool *is_set) const
    {
        if (!*is_set)
            return;
        switch (type)
        {
        case ENGINE_MAX_SPEED:
        case ENGINE_GENERIC_MAX_SPEED:
            *value.f *= m_speed;
            break;
        case ENGINE_POWER:
            *value.f *= m_power;
            break;
        case TURN_RADIUS:
            // Ban kinh nho hon = quay dau gat hon
            for (unsigned int i = 0; i < value.ia->size(); i++)
                value.ia->setY(i, value.ia->getY(i) / m_turn);
            break;
        default:
            break;
        }
    }

    virtual void copyFrom(const AbstractCharacteristic *other) {}
};

#endif
