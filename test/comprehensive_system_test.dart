import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oikonomos/services/app_settings.dart';
import 'package:oikonomos/services/translations.dart';
import 'package:oikonomos/services/storage_service.dart';
import 'package:oikonomos/services/file_service.dart';

void main() {
  setUpAll(() {
    // Initialize preferences state
    AppSettings.initialize();
  });

  group('Oikonomos Language & Translation Engine Tests', () {
    test('Arabic translations must contain proper keys', () {
      expect(AppTranslation.translate('dashboard', 'ar'), 'لوحة التحكم');
      expect(AppTranslation.translate('kids', 'ar'), 'دليل الأطفال');
      expect(AppTranslation.translate('servants', 'ar'), 'دليل الخدام');
      expect(AppTranslation.translate('service_groups', 'ar'), 'أسر الخدمة (المجموعات)');
    });

    test('English translations must contain proper keys', () {
      expect(AppTranslation.translate('dashboard', 'en'), 'Dashboard');
      expect(AppTranslation.translate('kids', 'en'), 'Kids Directory');
      expect(AppTranslation.translate('servants', 'en'), 'Servants Directory');
      expect(AppTranslation.translate('service_groups', 'en'), 'Service Groups');
    });

    test('Locale state should return correct Directionality', () {
      AppSettings.setLanguage('ar');
      expect(AppSettings.isRtl(), true);
      expect(AppSettings.getDirection(), TextDirection.rtl);

      AppSettings.setLanguage('en');
      expect(AppSettings.isRtl(), false);
      expect(AppSettings.getDirection(), TextDirection.ltr);
    });
  });

  group('Oikonomos Theme State Controller Tests', () {
    test('ThemeMode should toggle light and dark modes securely', () {
      AppSettings.themeMode.value = ThemeMode.light;
      AppSettings.toggleTheme();
      expect(AppSettings.themeMode.value, ThemeMode.dark);
      AppSettings.toggleTheme();
      expect(AppSettings.themeMode.value, ThemeMode.light);
    });
  });

  group('E.164 Phone & Email Validation Rule Tests', () {
    test('Strict email regex must accept correct and reject incorrect formats', () {
      final emailReg = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
      
      expect(emailReg.hasMatch('test@gmail.com'), true);
      expect(emailReg.hasMatch('servant.name@church.org'), true);
      
      expect(emailReg.hasMatch('test@gmail'), false);
      expect(emailReg.hasMatch('test.com'), false);
      expect(emailReg.hasMatch('test@.com'), false);
    });

    test('Mobile strip non-digits must format E.164 raw inputs correctly', () {
      String strip(String num) => num.replaceAll(RegExp(r'\D'), '');
      
      expect(strip('+20 123-456-7890'), '201234567890');
      expect(strip('+1 (437) 633-8888'), '14376338888');
      expect(strip('02-1234567'), '021234567');
    });

    test('Mobile length rules must identify valid and invalid digit counts', () {
      bool validateMobile(String num) {
        final digits = num.replaceAll(RegExp(r'\D'), '');
        return digits.length >= 7 && digits.length <= 15;
      }

      expect(validateMobile('+20 1234567890'), true); // 12 digits
      expect(validateMobile('12345'), false); // Too short
      expect(validateMobile('1234567890123456'), false); // Too long
    });
  });

  group('Academic Year Date Timeline Calculator Tests', () {
    test('Selecting a Start Month and Year must calculate the correct End Date', () {
      const selectedYear = 2026;
      const selectedMonth = 9; // September

      final startDate = DateTime(selectedYear, selectedMonth, 1);
      final endDate = DateTime(selectedYear + 1, selectedMonth, 1).subtract(const Duration(days: 1));

      expect(startDate.year, 2026);
      expect(startDate.month, 9);
      expect(startDate.day, 1);

      // End date must be exactly 1 year later minus 1 day (August 31, 2027)
      expect(endDate.year, 2027);
      expect(endDate.month, 8);
      expect(endDate.day, 31);
    });
  });

  group('Platform-Safe Local Cache & File Storage Tests', () {
    test('StorageService stubs must operate on VM runners safely with no exceptions', () {
      expect(() => StorageService.setString('cache_lang', 'ar'), returnsNormally);
      expect(StorageService.getString('cache_lang'), isNull);
      expect(() => StorageService.remove('cache_lang'), returnsNormally);
    });

    test('FileService stubs must operate on VM runners safely with no exceptions', () {
      expect(
        () => FileService.saveFile(content: 'Roster CSV Data', fileName: 'misters.csv'),
        returnsNormally,
      );
    });

    test('Client-side photo compressor stub must return an empty string safely on VM tests', () async {
      final mockFile = _MockAppFile();
      final result = await FileService.compressImage(mockFile);
      expect(result, isEmpty);
    });
  });
}

class _MockAppFile implements AppFile {
  @override
  String get name => 'profile_pic.png';

  @override
  int get size => 2048;

  @override
  Future<Uint8List> readAsBytes() async => Uint8List(0);

  @override
  Future<String> readAsString() async => 'mock content';
}
