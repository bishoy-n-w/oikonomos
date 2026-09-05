import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/field_spec.dart';

class CrudCollectionScreen extends StatelessWidget {
  const CrudCollectionScreen({
    required this.title,
    required this.collection,
    required this.fields,
    this.createDefaults = const {},
    this.titlePath,
    this.subtitlePaths = const [],
    this.beforeSave,
    this.childActions = const [],
    super.key,
  });

  final String title;
  final CollectionReference<Map<String, dynamic>> collection;
  final List<FieldSpec> fields;
  final Map<String, dynamic> createDefaults;
  final String? titlePath;
  final List<String> subtitlePaths;
  final SaveTransform? beforeSave;
  final List<ChildCollectionAction> childActions;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Padding(
        padding: const EdgeInsets.all(12),
        child: CrudCollectionPage(
          title: title,
          collection: collection,
          fields: fields,
          createDefaults: createDefaults,
          titlePath: titlePath,
          subtitlePaths: subtitlePaths,
          beforeSave: beforeSave,
          childActions: childActions,
        ),
      ),
    );
  }
}

class CrudCollectionPage extends StatelessWidget {
  const CrudCollectionPage({
    required this.title,
    required this.collection,
    required this.fields,
    this.createDefaults = const {},
    this.titlePath,
    this.subtitlePaths = const [],
    this.beforeSave,
    this.childActions = const [],
    this.allowDelete = true,
    super.key,
  });

  final String title;
  final CollectionReference<Map<String, dynamic>> collection;
  final List<FieldSpec> fields;
  final Map<String, dynamic> createDefaults;
  final String? titlePath;
  final List<String> subtitlePaths;
  final SaveTransform? beforeSave;
  final List<ChildCollectionAction> childActions;
  final bool allowDelete;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            FilledButton.icon(
              onPressed: () => _createDocument(context),
              icon: const Icon(Icons.add),
              label: const Text('Add'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Expanded(
          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: collection.snapshots(),
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return Center(child: Text('Error: ${snapshot.error}'));
              }
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }

              final docs = snapshot.data!.docs;
              if (docs.isEmpty) {
                return const Center(child: Text('No records yet.'));
              }

              return ListView.separated(
                itemCount: docs.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final doc = docs[index];
                  final data = doc.data();
                  final resolvedTitle = titlePath == null
                      ? doc.id
                      : (_displayValue(_readPath(data, titlePath!)) ?? doc.id);

                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            resolvedTitle,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 2),
                          SelectableText(
                            'ID: ${doc.id}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          if (subtitlePaths.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            ...subtitlePaths.map((path) {
                              final value = _displayValue(_readPath(data, path));
                              if (value == null || value.isEmpty) {
                                return const SizedBox.shrink();
                              }
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 2),
                                child: Text('$path: $value'),
                              );
                            }),
                          ],
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              OutlinedButton.icon(
                                onPressed: () => _editDocument(
                                  context,
                                  documentId: doc.id,
                                  initialData: data,
                                ),
                                icon: const Icon(Icons.edit),
                                label: const Text('Edit'),
                              ),
                              if (allowDelete)
                                TextButton.icon(
                                  onPressed: () =>
                                      _deleteDocument(context, doc.id),
                                  icon: const Icon(Icons.delete),
                                  label: const Text('Delete'),
                                ),
                              ...childActions.map(
                                (action) => FilledButton.tonal(
                                  onPressed: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => CrudCollectionScreen(
                                          title: '${action.title} - ${doc.id}',
                                          collection: action.collectionFactory(
                                            doc.id,
                                            data,
                                          ),
                                          fields: action.fields,
                                          createDefaults: action.createDefaults,
                                          titlePath: action.titlePath,
                                          subtitlePaths: action.subtitlePaths,
                                          beforeSave: action.beforeSave,
                                        ),
                                      ),
                                    );
                                  },
                                  child: Text(action.label),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Future<void> _createDocument(BuildContext context) async {
    final result = await showDialog<DocFormResult>(
      context: context,
      builder: (_) => DocumentFormDialog(
        title: 'Add $title',
        fields: fields,
        initialData: createDefaults,
        allowCustomDocumentId: true,
      ),
    );
    if (result == null) return;
    if (!context.mounted) return;

    var payload = _deepMerge(createDefaults, result.data);
    if (beforeSave != null) {
      payload = beforeSave!(payload, true);
    }

    try {
      final docId = result.docId?.trim();
      if (docId == null || docId.isEmpty) {
        await collection.add(payload);
      } else {
        await collection.doc(docId).set(payload, SetOptions(merge: true));
      }
    } catch (e) {
      if (!context.mounted) return;
      _showSnack(context, 'Create failed: $e');
    }
  }

  Future<void> _editDocument(
    BuildContext context, {
    required String documentId,
    required Map<String, dynamic> initialData,
  }) async {
    final result = await showDialog<DocFormResult>(
      context: context,
      builder: (_) => DocumentFormDialog(
        title: 'Edit $title',
        fields: fields,
        initialData: initialData,
        existingDocumentId: documentId,
      ),
    );
    if (result == null) return;
    if (!context.mounted) return;

    var payload = result.data;
    if (beforeSave != null) {
      payload = beforeSave!(payload, false);
    }

    try {
      await collection.doc(documentId).set(payload, SetOptions(merge: true));
    } catch (e) {
      if (!context.mounted) return;
      _showSnack(context, 'Update failed: $e');
    }
  }

  Future<void> _deleteDocument(BuildContext context, String documentId) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete document?'),
            content: Text('This will delete "$documentId".'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;
    if (!context.mounted) return;

    if (!confirmed) return;
    try {
      await collection.doc(documentId).delete();
    } catch (e) {
      if (!context.mounted) return;
      _showSnack(context, 'Delete failed: $e');
    }
  }
}

class DocumentFormDialog extends StatefulWidget {
  const DocumentFormDialog({
    required this.title,
    required this.fields,
    required this.initialData,
    this.allowCustomDocumentId = false,
    this.existingDocumentId,
    super.key,
  });

  final String title;
  final List<FieldSpec> fields;
  final Map<String, dynamic> initialData;
  final bool allowCustomDocumentId;
  final String? existingDocumentId;

  @override
  State<DocumentFormDialog> createState() => _DocumentFormDialogState();
}

class _DocumentFormDialogState extends State<DocumentFormDialog> {
  late final TextEditingController _docIdController;
  final Map<String, TextEditingController> _textControllers = {};
  final Map<String, bool> _boolValues = {};
  final Map<String, String?> _optionValues = {};
  final Map<String, String?> _referenceValues = {};

  @override
  void initState() {
    super.initState();
    _docIdController = TextEditingController(text: widget.existingDocumentId);

    for (final field in widget.fields) {
      final initial = _readPath(widget.initialData, field.path);
      switch (field.type) {
        case FieldType.boolValue:
          _boolValues[field.path] = initial is bool ? initial : false;
          break;
        case FieldType.option:
          final raw = initial?.toString();
          final selected = field.options.contains(raw)
              ? raw
              : (field.options.isNotEmpty ? field.options.first : null);
          _optionValues[field.path] = selected;
          break;
        case FieldType.reference:
          _referenceValues[field.path] = initial?.toString();
          break;
        case FieldType.text:
        case FieldType.multiline:
        case FieldType.dateTime:
        case FieldType.csv:
        case FieldType.jsonMap:
          _textControllers[field.path] = TextEditingController(
            text: _editableText(field.type, initial),
          );
          break;
      }
    }
  }

  @override
  void dispose() {
    _docIdController.dispose();
    for (final controller in _textControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.allowCustomDocumentId) ...[
                TextField(
                  controller: _docIdController,
                  decoration: const InputDecoration(
                    labelText: 'Document ID (optional)',
                    border: OutlineInputBorder(),
                    hintText: 'Leave empty to auto-generate ID',
                  ),
                ),
                const SizedBox(height: 12),
              ],
              ...widget.fields.map(_buildField),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submit,
          child: const Text('Save'),
        ),
      ],
    );
  }

  Future<void> _pickDateTime(BuildContext context, String path, TextEditingController controller) async {
    final initialStr = controller.text.trim();
    DateTime initialDate = DateTime.now();
    if (initialStr.isNotEmpty) {
      final parsed = DateTime.tryParse(initialStr);
      if (parsed != null) {
        initialDate = parsed.toLocal();
      }
    }

    final date = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(1900),
      lastDate: DateTime(2100),
    );
    if (date == null) return;

    if (!context.mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initialDate),
    );
    if (time == null) return;

    final combined = DateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
    );

    controller.text = combined.toUtc().toIso8601String();
  }

  Widget _buildField(FieldSpec field) {
    final label = field.required ? '${field.label} *' : field.label;
    switch (field.type) {
      case FieldType.boolValue:
        return SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _boolValues[field.path] ?? false,
          onChanged: (value) => setState(() => _boolValues[field.path] = value),
          title: Text(label),
        );
      case FieldType.option:
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: DropdownButtonFormField<String>(
            initialValue: _optionValues[field.path],
            isExpanded: true,
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              labelText: label,
            ),
            items: field.options
                .map((e) => DropdownMenuItem<String>(value: e, child: Text(e)))
                .toList(),
            onChanged: (value) => setState(() => _optionValues[field.path] = value),
          ),
        );
      case FieldType.reference:
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: FirebaseFirestore.instance
                .collection(field.referenceCollectionPath!)
                .snapshots(),
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return Text('Error loading references: ${snapshot.error}');
              }
              if (!snapshot.hasData) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8.0),
                  child: LinearProgressIndicator(),
                );
              }
              final docs = snapshot.data!.docs;
              final selectedValue = _referenceValues[field.path];

              final hasSelected = docs.any((doc) => doc.id == selectedValue);
              final valueToUse = hasSelected ? selectedValue : null;

              return DropdownButtonFormField<String>(
                initialValue: valueToUse,
                isExpanded: true,
                decoration: InputDecoration(
                  border: const OutlineInputBorder(),
                  labelText: label,
                  hintText: field.hint,
                ),
                items: docs.map((doc) {
                  final data = doc.data();
                  final displayVal = _displayValue(_readPath(data, field.referenceDisplayPath)) ?? doc.id;
                  return DropdownMenuItem<String>(
                    value: doc.id,
                    child: Text('$displayVal (${doc.id})'),
                  );
                }).toList(),
                onChanged: (value) {
                  setState(() {
                    _referenceValues[field.path] = value;
                  });
                },
              );
            },
          ),
        );
      case FieldType.dateTime:
        final controller = _textControllers[field.path]!;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextField(
            controller: controller,
            readOnly: true,
            onTap: () => _pickDateTime(context, field.path, controller),
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              labelText: label,
              hintText: field.hint ?? 'Tap to select date & time',
              suffixIcon: IconButton(
                icon: const Icon(Icons.calendar_month),
                onPressed: () => _pickDateTime(context, field.path, controller),
              ),
            ),
          ),
        );
      case FieldType.text:
      case FieldType.multiline:
      case FieldType.csv:
      case FieldType.jsonMap:
        final controller = _textControllers[field.path]!;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextField(
            controller: controller,
            maxLines: field.type == FieldType.multiline ||
                    field.type == FieldType.jsonMap
                ? field.maxLines
                : 1,
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              labelText: label,
              hintText: field.hint,
            ),
          ),
        );
    }
  }

  void _submit() {
    final output = <String, dynamic>{};

    for (final field in widget.fields) {
      dynamic parsed;

      switch (field.type) {
        case FieldType.text:
        case FieldType.multiline:
          final raw = _textControllers[field.path]!.text.trim();
          if (field.required && raw.isEmpty) {
            _showSnack(context, '${field.label} is required.');
            return;
          }
          parsed = raw.isEmpty ? null : raw;
          break;
        case FieldType.boolValue:
          parsed = _boolValues[field.path] ?? false;
          break;
        case FieldType.option:
          final raw = (_optionValues[field.path] ?? '').trim();
          if (field.required && raw.isEmpty) {
            _showSnack(context, '${field.label} is required.');
            return;
          }
          parsed = raw.isEmpty ? null : raw;
          break;
        case FieldType.reference:
          final raw = (_referenceValues[field.path] ?? '').trim();
          if (field.required && raw.isEmpty) {
            _showSnack(context, '${field.label} is required.');
            return;
          }
          parsed = raw.isEmpty ? null : raw;
          break;
        case FieldType.dateTime:
          final raw = _textControllers[field.path]!.text.trim();
          if (raw.isEmpty) {
            if (field.required) {
              _showSnack(context, '${field.label} is required.');
              return;
            }
            parsed = null;
          } else {
            final date = DateTime.tryParse(raw);
            if (date == null) {
              _showSnack(
                context,
                'Invalid date for ${field.label}. Use ISO-8601.',
              );
              return;
            }
            parsed = Timestamp.fromDate(date.toUtc());
          }
          break;
        case FieldType.csv:
          final raw = _textControllers[field.path]!.text.trim();
          parsed = raw.isEmpty
              ? <String>[]
              : raw
                  .split(',')
                  .map((e) => e.trim())
                  .where((e) => e.isNotEmpty)
                  .toList();
          break;
        case FieldType.jsonMap:
          final raw = _textControllers[field.path]!.text.trim();
          if (raw.isEmpty) {
            parsed = <String, dynamic>{};
          } else {
            try {
              final decoded = jsonDecode(raw);
              if (decoded is! Map) {
                _showSnack(context, '${field.label} must be a JSON object.');
                return;
              }
              parsed = Map<String, dynamic>.from(decoded);
            } catch (_) {
              _showSnack(context, '${field.label} has invalid JSON.');
              return;
            }
          }
          break;
      }

      _writePath(output, field.path, parsed);
    }

    final idText = _docIdController.text.trim();
    Navigator.pop(
      context,
      DocFormResult(
        docId: idText.isEmpty ? null : idText,
        data: output,
      ),
    );
  }
}

class DocFormResult {
  const DocFormResult({required this.docId, required this.data});

  final String? docId;
  final Map<String, dynamic> data;
}

Map<String, dynamic> _deepMerge(
  Map<String, dynamic> base,
  Map<String, dynamic> overlay,
) {
  final result = Map<String, dynamic>.from(base);
  overlay.forEach((key, value) {
    final existing = result[key];
    if (existing is Map && value is Map) {
      result[key] = _deepMerge(
        Map<String, dynamic>.from(existing),
        Map<String, dynamic>.from(value),
      );
    } else {
      result[key] = value;
    }
  });
  return result;
}

dynamic _readPath(Map<String, dynamic> data, String path) {
  final parts = path.split('.');
  dynamic current = data;
  for (final part in parts) {
    if (current is! Map || !current.containsKey(part)) {
      return null;
    }
    current = current[part];
  }
  return current;
}

void _writePath(Map<String, dynamic> data, String path, dynamic value) {
  final parts = path.split('.');
  Map<String, dynamic> current = data;
  for (var i = 0; i < parts.length - 1; i++) {
    final key = parts[i];
    final existing = current[key];
    if (existing is Map<String, dynamic>) {
      current = existing;
    } else if (existing is Map) {
      final converted = Map<String, dynamic>.from(existing);
      current[key] = converted;
      current = converted;
    } else {
      final next = <String, dynamic>{};
      current[key] = next;
      current = next;
    }
  }
  current[parts.last] = value;
}

String _editableText(FieldType type, dynamic value) {
  if (value == null) return '';
  switch (type) {
    case FieldType.csv:
      if (value is Iterable) {
        return value.map((e) => e.toString()).join(', ');
      }
      return value.toString();
    case FieldType.dateTime:
      if (value is Timestamp) return value.toDate().toUtc().toIso8601String();
      if (value is DateTime) return value.toUtc().toIso8601String();
      return value.toString();
    case FieldType.jsonMap:
      if (value is Map) {
        return const JsonEncoder.withIndent('  ')
            .convert(Map<String, dynamic>.from(value));
      }
      return '';
    case FieldType.text:
    case FieldType.multiline:
    case FieldType.boolValue:
    case FieldType.option:
    case FieldType.reference:
      return value.toString();
  }
}

String? _displayValue(dynamic value) {
  if (value == null) return null;
  if (value is Timestamp) return value.toDate().toUtc().toIso8601String();
  if (value is DateTime) return value.toUtc().toIso8601String();
  if (value is bool || value is num) return value.toString();
  if (value is String) return value;
  if (value is Iterable) {
    return value.map((e) => e.toString()).join(', ');
  }
  if (value is Map) {
    return jsonEncode(value);
  }
  return value.toString();
}

void _showSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message)),
  );
}
