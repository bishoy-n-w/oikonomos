import 'dart:html' as html;

class StorageService {
  static void setString(String key, String value) {
    try {
      html.window.localStorage[key] = value;
    } catch (_) {}
  }

  static String? getString(String key) {
    try {
      return html.window.localStorage[key];
    } catch (_) {
      return null;
    }
  }

  static void remove(String key) {
    try {
      html.window.localStorage.remove(key);
    } catch (_) {}
  }
}
