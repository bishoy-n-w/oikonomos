import 'dart:typed_data';

abstract class AppFile {
  String get name;
  int get size;
  Future<Uint8List> readAsBytes();
  Future<String> readAsString();
}

class FileService {
  static void pickFile({
    required String allowedExtensions,
    required Function(AppFile file) onPicked,
    Function(String error)? onError,
  }) {
    // Stub implementation for VM tests
  }

  static Future<String> compressImage(AppFile file) async {
    // Stub implementation for VM tests
    return '';
  }

  static void saveFile({
    required String content,
    required String fileName,
  }) {
    // Stub implementation for VM tests
  }
}
