import 'dart:async';
import 'dart:convert';
import 'dart:html' as html;
import 'dart:typed_data';

abstract class AppFile {
  String get name;
  int get size;
  Future<Uint8List> readAsBytes();
  Future<String> readAsString();
}

class WebAppFile implements AppFile {
  WebAppFile(this._file);

  final html.File _file;

  @override
  String get name => _file.name;

  @override
  int get size => _file.size;

  @override
  Future<Uint8List> readAsBytes() {
    final completer = Completer<Uint8List>();
    final reader = html.FileReader();
    
    reader.onLoadEnd.listen((_) {
      if (reader.result is List<int>) {
        completer.complete(Uint8List.fromList(reader.result as List<int>));
      } else if (reader.result is ByteBuffer) {
        completer.complete((reader.result as ByteBuffer).asUint8List());
      } else {
        completer.completeError('Failed to read file as bytes');
      }
    });

    reader.onError.listen((err) {
      completer.completeError('File reading error: $err');
    });

    reader.readAsArrayBuffer(_file);
    return completer.future;
  }

  @override
  Future<String> readAsString() {
    final completer = Completer<String>();
    final reader = html.FileReader();

    reader.onLoadEnd.listen((_) {
      completer.complete(reader.result as String);
    });

    reader.onError.listen((err) {
      completer.completeError('File reading error: $err');
    });

    reader.readAsText(_file);
    return completer.future;
  }
}

class FileService {
  static void pickFile({
    required String allowedExtensions,
    required Function(AppFile file) onPicked,
    Function(String error)? onError,
  }) {
    try {
      final uploadInput = html.InputElement(type: 'file');
      uploadInput.accept = allowedExtensions;
      
      uploadInput.onChange.listen((e) {
        final files = uploadInput.files;
        if (files != null && files.isNotEmpty) {
          onPicked(WebAppFile(files.first));
        } else {
          if (onError != null) {
            onError('No file selected');
          }
        }
      });

      uploadInput.click();
    } catch (e) {
      if (onError != null) {
        onError('File picker error: $e');
      }
    }
  }

  static Future<String> compressImage(AppFile file) {
    final completer = Completer<String>();
    if (file is! WebAppFile) {
      completer.complete('');
      return completer.future;
    }

    final reader = html.FileReader();
    reader.onLoadEnd.listen((_) {
      final dataUrl = reader.result as String;
      final img = html.ImageElement();
      img.src = dataUrl;
      
      img.onLoad.listen((_) {
        try {
          final canvas = html.CanvasElement();
          final ctx = canvas.getContext('2d') as html.CanvasRenderingContext2D;
          
          // Target thumbnail dimensions (maximum 150 pixels)
          const maxDim = 150;
          int width = img.width ?? 150;
          int height = img.height ?? 150;
          
          if (width > height) {
            if (width > maxDim) {
              height = (height * maxDim / width).round();
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = (width * maxDim / height).round();
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImageScaled(img, 0, 0, width, height);
          
          // Export as compressed 70% quality JPEG string
          final compressedDataUrl = canvas.toDataUrl('image/jpeg', 0.7);
          completer.complete(compressedDataUrl);
        } catch (e) {
          completer.completeError('Compression failed: $e');
        }
      });

      img.onError.listen((err) {
        completer.completeError('Failed to load image element');
      });
    });

    reader.onError.listen((err) {
      completer.completeError('Failed to read image source');
    });

    reader.readAsDataUrl(file._file);
    return completer.future;
  }

  static void saveFile({
    required String content,
    required String fileName,
  }) {
    try {
      final bytes = utf8.encode(content);
      final blob = html.Blob([bytes], 'text/csv');
      final url = html.Url.createObjectUrlFromBlob(blob);
      final anchor = html.AnchorElement(href: url)
        ..setAttribute('download', fileName)
        ..click();
      html.Url.revokeObjectUrl(url);
    } catch (_) {}
  }
}
