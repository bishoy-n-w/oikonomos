import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/field_spec.dart';
import '../widgets/crud_collection.dart';
import '../services/translations.dart';
import '../services/app_settings.dart';

class ClassAssignmentsScreen extends StatelessWidget {
  const ClassAssignmentsScreen({
    required this.churchId,
    required this.academicYearId,
    super.key,
  });

  final String churchId;
  final String academicYearId;

  @override
  Widget build(BuildContext context) {
    final lang = AppSettings.language.value;

    if (churchId.isEmpty || academicYearId.isEmpty) {
      return Center(
        child: Text(AppTranslation.translate('church', lang)),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: CrudCollectionPage(
        title: '${AppTranslation.translate('class_assignments', lang)} - $academicYearId',
        collection: FirebaseFirestore.instance
            .collection('churches')
            .doc(churchId)
            .collection('academicYears')
            .doc(academicYearId)
            .collection('classInstances'),
        fields: [
          FieldSpec(
            path: 'classId',
            label: AppTranslation.translate('classes', lang),
            type: FieldType.reference,
            required: true,
            referenceCollectionPath: 'churches/$churchId/classes',
            referenceDisplayPath: 'current.name',
          ),
          FieldSpec(
            path: 'serviceGroupId',
            label: AppTranslation.translate('service_groups', lang),
            type: FieldType.reference,
            required: true,
            referenceCollectionPath: 'churches/$churchId/serviceGroups',
            referenceDisplayPath: 'current.displayName',
          ),
          const FieldSpec(
            path: 'gradeId',
            label: 'Grade Level',
            type: FieldType.option,
            options: _gradeOptions,
          ),
        ],
        createDefaults: const {'gradeId': 'G1'},
        titlePath: 'classId',
        subtitlePaths: const ['serviceGroupId', 'gradeId'],
      ),
    );
  }
}

const _gradeOptions = <String>[
  'KG',
  'G1',
  'G2',
  'G3',
  'G4',
  'G5',
  'G6',
  'G7',
  'G8',
  'G9',
  'G10',
  'G11',
  'G12',
];
