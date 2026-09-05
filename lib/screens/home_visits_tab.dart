import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/field_spec.dart';
import '../widgets/crud_collection.dart';

class HomeVisitsTab extends StatefulWidget {
  const HomeVisitsTab({
    required this.churchId,
    required this.academicYearId,
    super.key,
  });

  final String churchId;
  final String academicYearId;

  @override
  State<HomeVisitsTab> createState() => _HomeVisitsTabState();
}

class _HomeVisitsTabState extends State<HomeVisitsTab> {
  String? _selectedClassInstanceId;

  CollectionReference<Map<String, dynamic>> get _classInstancesRef =>
      FirebaseFirestore.instance
          .collection('churches')
          .doc(widget.churchId)
          .collection('academicYears')
          .doc(widget.academicYearId)
          .collection('classInstances');

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: _classInstancesRef.snapshots(),
          builder: (context, snapshot) {
            if (!snapshot.hasData) {
              return const LinearProgressIndicator();
            }
            final docs = snapshot.data!.docs;
            final ids = docs.map((e) => e.id).toList();
            if (_selectedClassInstanceId != null &&
                !ids.contains(_selectedClassInstanceId)) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted) return;
                setState(() {
                  _selectedClassInstanceId = null;
                });
              });
            }
            if (_selectedClassInstanceId == null && ids.isNotEmpty) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted) return;
                setState(() {
                  _selectedClassInstanceId = ids.first;
                });
              });
            }

            return Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    SizedBox(
                      width: 420,
                      child: DropdownButtonFormField<String>(
                        initialValue: ids.contains(_selectedClassInstanceId)
                            ? _selectedClassInstanceId
                            : null,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Class Instance',
                          border: OutlineInputBorder(),
                        ),
                        items: docs
                            .map(
                              (doc) => DropdownMenuItem<String>(
                                value: doc.id,
                                child: Text(
                                  '${doc.data()['classId'] ?? doc.id} (${doc.id})',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (value) =>
                            setState(() => _selectedClassInstanceId = value),
                      ),
                    ),
                    Text(
                      _selectedClassInstanceId == null
                          ? 'No class instance selected.'
                          : 'Path: churches/${widget.churchId}/academicYears/${widget.academicYearId}/homeVisitsByClassInstance/$_selectedClassInstanceId/visits',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 12),
        Expanded(
          child: _selectedClassInstanceId == null
              ? const MissingSelection(
                  message: 'Create/select a class instance first.',
                )
              : CrudCollectionPage(
                  title: 'Home Visits',
                  collection: FirebaseFirestore.instance
                      .collection('churches')
                      .doc(widget.churchId)
                      .collection('academicYears')
                      .doc(widget.academicYearId)
                      .collection('homeVisitsByClassInstance')
                      .doc(_selectedClassInstanceId)
                      .collection('visits'),
                  fields: [
                    FieldSpec(
                      path: 'kidId',
                      label: 'Kid',
                      type: FieldType.reference,
                      required: true,
                      referenceCollectionPath: 'churches/${widget.churchId}/kids',
                      referenceDisplayPath: 'current.fullName',
                    ),
                    const FieldSpec(
                      path: 'visitDateTime',
                      label: 'Visit Date Time (ISO-8601)',
                      type: FieldType.dateTime,
                      required: true,
                    ),
                    const FieldSpec(
                      path: 'visitorMisterIds',
                      label: 'Visitor Mister IDs (comma separated)',
                      type: FieldType.csv,
                    ),
                    const FieldSpec(
                      path: 'notes',
                      label: 'Notes',
                      type: FieldType.multiline,
                      maxLines: 3,
                    ),
                    FieldSpec(
                      path: 'createdBy',
                      label: 'Created By',
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
                  beforeSave: withCreatedAtAndUpdatedAt,
                ),
        ),
      ],
    );
  }
}

class MissingSelection extends StatelessWidget {
  const MissingSelection({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        message,
        style: Theme.of(context).textTheme.titleMedium,
        textAlign: TextAlign.center,
      ),
    );
  }
}

Map<String, dynamic> withCreatedAtAndUpdatedAt(
  Map<String, dynamic> data,
  bool isCreate,
) {
  final next = Map<String, dynamic>.from(data);
  if (isCreate && next['createdAt'] == null) {
    next['createdAt'] = FieldValue.serverTimestamp();
  }
  next['updatedAt'] = FieldValue.serverTimestamp();
  return next;
}
