package com.robotcontrol.phone.ble

import android.content.Context
import android.content.SharedPreferences

object BondStore {

    private const val PREFS_NAME = "ble_bond_prefs"
    private const val PREF_KEY_CONSOLE_ADDR = "console_mac"
    private const val PREF_KEY_PHONE_ADDR = "phone_mac"
    private const val PREF_KEY_CLIENT_ADDR = "client_mac"

    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    private fun getPrefs(): SharedPreferences {
        return prefs ?: throw IllegalStateException("BondStore not initialized, call init(context) first")
    }

    fun saveConsoleAddress(mac: String) {
        getPrefs().edit().putString(PREF_KEY_CONSOLE_ADDR, mac).apply()
    }

    fun getConsoleAddress(): String? {
        return getPrefs().getString(PREF_KEY_CONSOLE_ADDR, null)
    }

    fun savePhoneAddress(mac: String) {
        getPrefs().edit().putString(PREF_KEY_PHONE_ADDR, mac).apply()
    }

    fun getPhoneAddress(): String? {
        return getPrefs().getString(PREF_KEY_PHONE_ADDR, null)
    }

    fun saveBoundedClientAddress(mac: String) {
        getPrefs().edit().putString(PREF_KEY_CLIENT_ADDR, mac).apply()
    }

    fun getBoundedClientAddress(): String? {
        return getPrefs().getString(PREF_KEY_CLIENT_ADDR, null)
    }

    fun clearConsoleBond() {
        getPrefs().edit().remove(PREF_KEY_CONSOLE_ADDR).apply()
    }

    fun clearPhoneBond() {
        getPrefs().edit().remove(PREF_KEY_PHONE_ADDR).apply()
    }

    fun clearClientBond() {
        getPrefs().edit().remove(PREF_KEY_CLIENT_ADDR).apply()
    }

    fun hasConsoleBond(): Boolean {
        return getConsoleAddress() != null
    }

    fun hasPhoneBond(): Boolean {
        return getPhoneAddress() != null
    }

    fun hasClientBond(): Boolean {
        return getBoundedClientAddress() != null
    }
}
