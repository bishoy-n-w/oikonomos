import 'package:flutter/material.dart';
import 'storage_service.dart';

class AppSettings {
  static final ValueNotifier<String> language = ValueNotifier<String>('en');
  static final ValueNotifier<ThemeMode> themeMode = ValueNotifier<ThemeMode>(ThemeMode.light);

  static void initialize() {
    final savedLang = StorageService.getString('app_language');
    if (savedLang != null) {
      language.value = savedLang;
    }

    final savedTheme = StorageService.getString('app_theme');
    if (savedTheme != null) {
      themeMode.value = savedTheme == 'dark' ? ThemeMode.dark : ThemeMode.light;
    }
  }

  static void setLanguage(String lang) {
    language.value = lang;
    StorageService.setString('app_language', lang);
  }

  static void toggleTheme() {
    final next = themeMode.value == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    themeMode.value = next;
    StorageService.setString('app_theme', next == ThemeMode.dark ? 'dark' : 'light');
  }

  static bool isRtl() {
    return language.value == 'ar';
  }

  static TextDirection getDirection() {
    return isRtl() ? TextDirection.rtl : TextDirection.ltr;
  }
}
