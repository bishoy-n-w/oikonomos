// ignore_for_file: unnecessary_underscores, deprecated_member_use, use_build_context_synchronously
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/field_spec.dart';
import '../widgets/crud_collection.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';

class HomeVisitsTab extends StatefulWidget {
  const HomeVisitsTab({
    required this.churchId,
    required this.academicYearId,
    required this.classId,
    super.key,
  });

  final String churchId;
  final String academicYearId;
  final String classId;

  @override
  State<HomeVisitsTab> createState() => _HomeVisitsTabState();
}

class _HomeVisitsTabState extends State<HomeVisitsTab> {
  @override
  Widget build(BuildContext context) {
    final lang = AppSettings.language.value;

    if (widget.churchId.isEmpty || widget.academicYearId.isEmpty) {
      return Center(
        child: Text(AppTranslation.translate('church', lang)),
      );
    }

    // --- CASE 1: If No Class is selected in the top bar ---
    if (widget.classId.isEmpty) {
      return Center(
        child: Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
          ),
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.filter_list_alt, size: 64, color: Theme.of(context).colorScheme.outlineVariant),
                const SizedBox(height: 16),
                Text(
                  'Select a Class Group',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Please select a specific Class in the top-right filters\nto log or view pastoral home visits.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // --- CASE 2: Clean, structured CRUD for the selected Class ---
    return CrudCollectionPage(
      title: 'Pastoral Home Visits',
      collection: FirebaseFirestore.instance
          .collection('churches')
          .doc(widget.churchId)
          .collection('classes')
          .doc(widget.classId)
          .collection('visits'),
      query: FirebaseFirestore.instance
          .collection('churches')
          .doc(widget.churchId)
          .collection('classes')
          .doc(widget.classId)
          .collection('visits')
          .where('academicYearId', isEqualTo: widget.academicYearId),
      fields: [
        FieldSpec(
          path: 'kidId',
          label: 'Student Name',
          type: FieldType.reference,
          required: true,
          referenceCollectionPath: 'churches/${widget.churchId}/kids',
          referenceDisplayPath: 'current.fullName',
        ),
        const FieldSpec(
          path: 'visitDateTime',
          label: 'Visit Date & Time (ISO-8601)',
          type: FieldType.dateTime,
          required: true,
        ),
        const FieldSpec(
          path: 'visitorMisterIds',
          label: 'Visitor Servants (comma separated UIDs)',
          type: FieldType.csv,
        ),
        const FieldSpec(
          path: 'notes',
          label: 'Visitation Notes',
          type: FieldType.multiline,
          maxLines: 4,
        ),
        FieldSpec(
          path: 'createdBy',
          label: 'Recorded By',
          type: FieldType.reference,
          referenceCollectionPath: 'churches/${widget.churchId}/misters',
          referenceDisplayPath: 'displayName',
        ),
        const FieldSpec(
          path: 'createdAt',
          label: 'Created At (ISO-8601)',
          type: FieldType.dateTime,
        ),
        const FieldSpec(
          path: 'updatedAt',
          label: 'Updated At (ISO-8601)',
          type: FieldType.dateTime,
        ),
      ],
      titlePath: 'kidId',
      subtitlePaths: const [
        'visitDateTime',
        'visitorMisterIds',
        'notes',
        'updatedAt',
      ],
      beforeSave: (data, isCreate) {
        final next = Map<String, dynamic>.from(data);
        if (isCreate) {
          next['createdAt'] = FieldValue.serverTimestamp();
          // Seed the current academic year scope automatically on save!
          next['academicYearId'] = widget.academicYearId;
        }
        next['updatedAt'] = FieldValue.serverTimestamp();
        return next;
      },
    );
  }
}
