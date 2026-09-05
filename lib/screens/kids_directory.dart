import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/field_spec.dart';
import '../widgets/crud_collection.dart';

class KidsDirectoryScreen extends StatelessWidget {
  const KidsDirectoryScreen({required this.churchId, super.key});

  final String churchId;

  @override
  Widget build(BuildContext context) {
    if (churchId.isEmpty) {
      return const Center(
        child: Text('Please select a church from the top bar.'),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: CrudCollectionPage(
        title: 'Children Directory',
        collection: FirebaseFirestore.instance
            .collection('churches')
            .doc(churchId)
            .collection('kids'),
        fields: const [
          FieldSpec(
            path: 'active',
            label: 'Active Student',
            type: FieldType.boolValue,
          ),
          FieldSpec(
            path: 'current.fullName',
            label: 'Full Name',
            type: FieldType.text,
            required: true,
          ),
          FieldSpec(
            path: 'current.gender',
            label: 'Gender',
            type: FieldType.option,
            options: ['M', 'F'],
          ),
          FieldSpec(
            path: 'current.dob',
            label: 'Date of Birth',
            type: FieldType.dateTime,
          ),
          FieldSpec(
            path: 'current.school',
            label: 'School',
            type: FieldType.text,
          ),
          FieldSpec(
            path: 'current.address',
            label: 'Address',
            type: FieldType.text,
          ),
          FieldSpec(
            path: 'current.phone',
            label: 'Phone',
            type: FieldType.text,
          ),
          FieldSpec(
            path: 'current.notes',
            label: 'Pastoral Notes',
            type: FieldType.multiline,
            maxLines: 3,
          ),
        ],
        createDefaults: const {'active': true},
        titlePath: 'current.fullName',
        subtitlePaths: const [
          'current.gender',
          'current.dob',
          'current.phone',
          'current.address',
          'current.school',
        ],
        beforeSave: _withCreatedAt,
        childActions: [
          ChildCollectionAction(
            label: 'Historical Archive',
            title: 'Profile Versions',
            collectionFactory: (parentId, _) => FirebaseFirestore.instance
                .collection('churches')
                .doc(churchId)
                .collection('kids')
                .doc(parentId)
                .collection('versions'),
            fields: const [
              FieldSpec(
                path: 'at',
                label: 'Archived At',
                type: FieldType.dateTime,
                required: true,
              ),
              FieldSpec(
                path: 'changes',
                label: 'Profile Changes JSON',
                type: FieldType.jsonMap,
              ),
            ],
            titlePath: 'at',
            subtitlePaths: const ['changes'],
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
