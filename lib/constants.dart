import 'package:flutter/services.dart' show rootBundle;

class AppVersion {
  static String _version = '1.0.1'; // Fallback value

  static String get current => _version;

  static Future<void> initialize() async {
    try {
      final content = await rootBundle.loadString('pubspec.yaml');
      // Regex to extract 'version: x.y.z+n' line
      final regExp = RegExp(r'^version:\s*([^\s#]+)', multiLine: true);
      final match = regExp.firstMatch(content);
      if (match != null && match.group(1) != null) {
        _version = match.group(1)!.trim();
      }
    } catch (_) {
      // Gracefully fall back to the default version if reading fails
    }
  }
}
