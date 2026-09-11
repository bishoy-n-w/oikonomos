import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/field_spec.dart';
import '../widgets/crud_collection.dart';
import '../services/translations.dart';
import '../services/app_settings.dart';

class ServiceGroupsScreen extends StatelessWidget {
  const ServiceGroupsScreen({required this.churchId, super.key});

  final String churchId;

  @override
  Widget build(BuildContext context) {
    final lang = AppSettings.language.value;

    if (churchId.isEmpty) {
      return Center(
        child: Text(AppTranslation.translate('church', lang)),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: CrudCollectionPage(
        title: AppTranslation.translate('service_groups', lang),
        collection: FirebaseFirestore.instance
            .collection('churches')
            .doc(churchId)
            .collection('serviceGroups'),
        fields: const [
          FieldSpec(
            path: 'displayName',
            label: 'Service Group Name',
            type: FieldType.text,
            required: true,
          ),
        ],
        createDefaults: const {},
        titlePath: 'displayName',
        subtitlePaths: const [],
        beforeSave: _withCreatedAt,
      ),
    );
  }
}

Map<String, dynamic> _withCreatedAt(
  Map<String, dynamic> data,
  bool isCreate,
) {
  final next = Map<String, dynamic>.from(data);
  if (isCreate && next['createdAt'] == null) {
    next['createdAt'] = FieldValue.serverTimestamp();
  }
  return next;
}
