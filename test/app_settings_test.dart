import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oikonomos/services/app_settings.dart';
import 'package:oikonomos/services/translations.dart';
import 'package:oikonomos/services/storage_service.dart';
import 'package:oikonomos/services/file_service.dart';

void main() {
  group('App Translation Service Tests', () {
    test('Should return English translations correctly', () {
      expect(AppTranslation.translate('dashboard', 'en'), 'Dashboard');
      expect(AppTranslation.translate('kids', 'en'), 'Kids Directory');
      expect(AppTranslation.translate('welcome', 'en'), 'Welcome to Oikonomos');
    });

    test('Should return Arabic translations correctly', () {
      expect(AppTranslation.translate('dashboard', 'ar'), 'لوحة التحكم');
      expect(AppTranslation.translate('kids', 'ar'), 'دليل الأطفال');
      expect(AppTranslation.translate('welcome', 'ar'), 'مرحباً بك في أويكونوموس');
    });

    test('Should fall back gracefully to the original key if missing', () {
      expect(AppTranslation.translate('non_existent_key_123', 'en'), 'non_existent_key_123');
    });
  });

  group('App Layout & Theme Settings Tests', () {
    setUp(() {
      // Reset settings to default before each test
      AppSettings.language.value = 'en';
      AppSettings.themeMode.value = ThemeMode.light;
    });

    test('Should toggle theme mode successfully', () {
      expect(AppSettings.themeMode.value, ThemeMode.light);
      AppSettings.toggleTheme();
      expect(AppSettings.themeMode.value, ThemeMode.dark);
      AppSettings.toggleTheme();
      expect(AppSettings.themeMode.value, ThemeMode.light);
    });

    test('Should change language successfully', () {
      expect(AppSettings.language.value, 'en');
      AppSettings.setLanguage('ar');
      expect(AppSettings.language.value, 'ar');
    });

    test('Should return correct text directionality (RTL mirroring)', () {
      // When English is active
      expect(AppSettings.isRtl(), false);
      expect(AppSettings.getDirection(), TextDirection.ltr);

      // When Arabic is active
      AppSettings.setLanguage('ar');
      expect(AppSettings.isRtl(), true);
      expect(AppSettings.getDirection(), TextDirection.rtl);
    });
  });

  group('Platform-Safe Storage Service Tests', () {
    test('Should execute stub methods on VM test runners without crashing', () {
      // Since this test runs on the native VM (not a browser), the storage service stub should
      // execute gracefully with no errors.
      expect(() => StorageService.setString('test_key', 'test_val'), returnsNormally);
      expect(StorageService.getString('test_key'), isNull);
      expect(() => StorageService.remove('test_key'), returnsNormally);
    });
  });

  group('Platform-Safe File Service Tests', () {
    test('Should execute file export stub on VM test runners with no errors', () {
      expect(
        () => FileService.saveFile(content: 'test content', fileName: 'test.csv'),
        returnsNormally,
      );
    });

    test('Should return empty string stub for image compression on VM test runners', () async {
      // Mock class for app file testing
      final mockFile = _MockAppFile();
      final compressed = await FileService.compressImage(mockFile);
      expect(compressed, isEmpty);
    });
  });
}

class _MockAppFile implements AppFile {
  @override
  String get name => 'mock_image.jpg';

  @override
  int get size => 1024;

  @override
  Future<Uint8List> readAsBytes() async => Uint8List(0);

  @override
  Future<String> readAsString() async => '';
}
