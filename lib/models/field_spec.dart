import 'package:cloud_firestore/cloud_firestore.dart';

enum FieldType {
  text,
  multiline,
  boolValue,
  option,
  dateTime,
  csv,
  jsonMap,
  reference, // New type for relational dropdown lookups
  emailChips, // Google Drive-style tokenized emails with dynamic autocomplete
}

class FieldSpec {
  const FieldSpec({
    required this.path,
    required this.label,
    required this.type,
    this.required = false,
    this.options = const [],
    this.hint,
    this.maxLines = 4,
    this.referenceCollectionPath, // e.g., 'churches/$churchId/misters'
    this.referenceDisplayPath = 'displayName', // e.g., 'current.fullName' or 'displayName'
  });

  final String path;
  final String label;
  final FieldType type;
  final bool required;
  final List<String> options;
  final String? hint;
  final int maxLines;
  final String? referenceCollectionPath;
  final String referenceDisplayPath;
}

typedef SaveTransform = Map<String, dynamic> Function(
  Map<String, dynamic> data,
  bool isCreate,
);

class ChildCollectionAction {
  const ChildCollectionAction({
    required this.label,
    required this.title,
    required this.collectionFactory,
    required this.fields,
    this.createDefaults = const {},
    this.titlePath,
    this.subtitlePaths = const [],
    this.beforeSave,
  });

  final String label;
  final String title;
  final CollectionReference<Map<String, dynamic>> Function(
    String parentDocId,
    Map<String, dynamic> parentData,
  ) collectionFactory;
  final List<FieldSpec> fields;
  final Map<String, dynamic> createDefaults;
  final String? titlePath;
  final List<String> subtitlePaths;
  final SaveTransform? beforeSave;
}
