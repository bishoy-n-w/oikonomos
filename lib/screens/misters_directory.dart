import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/field_spec.dart';
import '../widgets/crud_collection.dart';

class MistersDirectoryScreen extends StatelessWidget {
  const MistersDirectoryScreen({required this.churchId, super.key});

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
        title: 'Servants Directory',
        collection: FirebaseFirestore.instance
            .collection('churches')
            .doc(churchId)
            .collection('misters'),
        fields: const [
          FieldSpec(
            path: 'displayName',
            label: 'Display Name',
            type: FieldType.text,
            required: true,
          ),
          FieldSpec(
            path: 'authUid',
            label: 'Auth UID / Email',
            type: FieldType.text,
            required: true,
          ),
          FieldSpec(
            path: 'phone',
            label: 'Phone Number',
            type: FieldType.text,
          ),
          FieldSpec(
            path: 'churchRole',
            label: 'Access Role',
            type: FieldType.option,
            options: ['viewer', 'admin'],
          ),
          FieldSpec(
            path: 'active',
            label: 'Active Servant',
            type: FieldType.boolValue,
          ),
        ],
        createDefaults: const {
          'active': true,
          'churchRole': 'viewer',
        },
        titlePath: 'displayName',
        subtitlePaths: const [
          'churchRole',
          'phone',
          'authUid',
          'active',
        ],
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
