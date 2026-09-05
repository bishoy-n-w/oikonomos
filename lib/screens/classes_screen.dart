import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/field_spec.dart';
import '../widgets/crud_collection.dart';
import '../services/translations.dart';
import '../services/app_settings.dart';

class ClassesScreen extends StatelessWidget {
  const ClassesScreen({required this.churchId, super.key});

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
        title: AppTranslation.translate('classes', lang),
        collection: FirebaseFirestore.instance
            .collection('churches')
            .doc(churchId)
            .collection('classes'),
        fields: [
          FieldSpec(
            path: 'active',
            label: AppTranslation.translate('active', lang),
            type: FieldType.boolValue,
          ),
          const FieldSpec(
            path: 'current.name',
            label: 'Class Name',
            type: FieldType.text,
            required: true,
          ),
          const FieldSpec(
            path: 'current.currentKidIds',
            label: 'Enrolled Kid IDs (comma separated)',
            type: FieldType.csv,
          ),
          FieldSpec(
            path: 'current.servantEmails',
            label: AppTranslation.translate('add_account', lang), // "Assigned Servant Emails (Share)"
            type: FieldType.emailChips,
            referenceCollectionPath: 'churches/$churchId/misters',
            hint: 'Type name or email to share...',
          ),
        ],
        createDefaults: const {'active': true},
        titlePath: 'current.name',
        subtitlePaths: const [
          'active',
          'current.currentKidIds',
          'current.servantEmails',
        ],
        beforeSave: _withCreatedAt,
        childActions: [
          ChildCollectionAction(
            label: 'Kid Memberships',
            title: 'Class Kid Memberships',
            collectionFactory: (parentId, _) => FirebaseFirestore.instance
                .collection('churches')
                .doc(churchId)
                .collection('classes')
                .doc(parentId)
                .collection('kidsMemberships'),
            fields: [
              FieldSpec(
                path: 'kidId',
                label: 'Kid',
                type: FieldType.reference,
                required: true,
                referenceCollectionPath: 'churches/$churchId/kids',
                referenceDisplayPath: 'current.fullName',
              ),
              const FieldSpec(
                path: 'startAt',
                label: 'Start At (ISO-8601)',
                type: FieldType.dateTime,
                required: true,
              ),
              const FieldSpec(
                path: 'endAt',
                label: 'End At (ISO-8601)',
                type: FieldType.dateTime,
              ),
            ],
            titlePath: 'kidId',
            subtitlePaths: const ['startAt', 'endAt'],
          ),
        ],
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
