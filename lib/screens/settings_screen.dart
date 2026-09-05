import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/field_spec.dart';
import '../widgets/crud_collection.dart';
import 'home_visits_tab.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    required this.churchId,
    required this.academicYearId,
    super.key,
  });

  final String churchId;
  final String academicYearId;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  static const _settingsTabs = <Tab>[
    Tab(text: 'Classes'),
    Tab(text: 'Service Groups'),
    Tab(text: 'Academic Years'),
    Tab(text: 'Class Assignments'),
    Tab(text: 'Home Visits Log'),
    Tab(text: 'Churches Config'),
  ];

  CollectionReference<Map<String, dynamic>> get _churchesRef =>
      FirebaseFirestore.instance.collection('churches');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    if (widget.churchId.isEmpty) {
      return const Center(child: Text('Select a church first.'));
    }

    return DefaultTabController(
      length: _settingsTabs.length,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sub-navigation bar inside Settings
          Container(
            color: colorScheme.surfaceContainerLow,
            child: const TabBar(
              isScrollable: true,
              tabs: _settingsTabs,
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                // 1. Classes Config
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: CrudCollectionPage(
                    title: 'Class Groups',
                    collection: _churchesRef
                        .doc(widget.churchId)
                        .collection('classes'),
                    fields: const [
                      FieldSpec(
                        path: 'active',
                        label: 'Active Class',
                        type: FieldType.boolValue,
                      ),
                      FieldSpec(
                        path: 'current.name',
                        label: 'Class Name',
                        type: FieldType.text,
                        required: true,
                      ),
                      FieldSpec(
                        path: 'current.currentKidIds',
                        label: 'Enrolled Kid IDs (comma separated)',
                        type: FieldType.csv,
                      ),
                      FieldSpec(
                        path: 'current.currentMisters',
                        label: 'Assigned Misters (JSON)',
                        type: FieldType.jsonMap,
                        hint: '{"MID_ABC123":"admin"}',
                      ),
                    ],
                    createDefaults: const {'active': true},
                    titlePath: 'current.name',
                    subtitlePaths: const [
                      'active',
                      'current.currentKidIds',
                      'current.currentMisters',
                    ],
                    beforeSave: _withCreatedAt,
                    childActions: [
                      ChildCollectionAction(
                        label: 'Mister Memberships',
                        title: 'Class Mister Memberships',
                        collectionFactory: (parentId, _) => _churchesRef
                            .doc(widget.churchId)
                            .collection('classes')
                            .doc(parentId)
                            .collection('mistersMemberships'),
                        fields: [
                          FieldSpec(
                            path: 'misterId',
                            label: 'Mister',
                            type: FieldType.reference,
                            required: true,
                            referenceCollectionPath: 'churches/${widget.churchId}/misters',
                            referenceDisplayPath: 'displayName',
                          ),
                          const FieldSpec(
                            path: 'role',
                            label: 'Role',
                            type: FieldType.option,
                            options: ['viewer', 'admin'],
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
                        createDefaults: const {'role': 'viewer'},
                        titlePath: 'misterId',
                        subtitlePaths: const ['role', 'startAt', 'endAt'],
                      ),
                      ChildCollectionAction(
                        label: 'Kid Memberships',
                        title: 'Class Kid Memberships',
                        collectionFactory: (parentId, _) => _churchesRef
                            .doc(widget.churchId)
                            .collection('classes')
                            .doc(parentId)
                            .collection('kidsMemberships'),
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
                ),

                // 2. Service Groups Config
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: CrudCollectionPage(
                    title: 'Service Groups Directory',
                    collection: _churchesRef
                        .doc(widget.churchId)
                        .collection('serviceGroups'),
                    fields: const [
                      FieldSpec(
                        path: 'active',
                        label: 'Active Service Group',
                        type: FieldType.boolValue,
                      ),
                      FieldSpec(
                        path: 'current.displayName',
                        label: 'Service Group Name',
                        type: FieldType.text,
                        required: true,
                      ),
                      FieldSpec(
                        path: 'current.roles',
                        label: 'Current Roles JSON',
                        type: FieldType.jsonMap,
                        hint: '{"MID_ABC123":"admin"}',
                      ),
                    ],
                    createDefaults: const {'active': true},
                    titlePath: 'current.displayName',
                    subtitlePaths: const ['active', 'current.roles'],
                    childActions: [
                      ChildCollectionAction(
                        label: 'Mister Memberships',
                        title: 'Service Group Servant Assignments',
                        collectionFactory: (parentId, _) => _churchesRef
                            .doc(widget.churchId)
                            .collection('serviceGroups')
                            .doc(parentId)
                            .collection('mistersMemberships'),
                        fields: [
                          FieldSpec(
                            path: 'misterId',
                            label: 'Mister',
                            type: FieldType.reference,
                            required: true,
                            referenceCollectionPath: 'churches/${widget.churchId}/misters',
                            referenceDisplayPath: 'displayName',
                          ),
                          const FieldSpec(
                            path: 'role',
                            label: 'Role',
                            type: FieldType.option,
                            options: ['viewer', 'admin'],
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
                        createDefaults: const {'role': 'viewer'},
                        titlePath: 'misterId',
                        subtitlePaths: const ['role', 'startAt', 'endAt'],
                      ),
                    ],
                  ),
                ),

                // 3. Academic Years Config
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: CrudCollectionPage(
                    title: 'Academic Years',
                    collection: _churchesRef
                        .doc(widget.churchId)
                        .collection('academicYears'),
                    fields: const [
                      FieldSpec(
                        path: 'displayName',
                        label: 'Academic Year Name',
                        type: FieldType.text,
                        required: true,
                      ),
                      FieldSpec(
                        path: 'startDate',
                        label: 'Start Date',
                        type: FieldType.dateTime,
                        required: true,
                      ),
                      FieldSpec(
                        path: 'endDate',
                        label: 'End Date',
                        type: FieldType.dateTime,
                        required: true,
                      ),
                      FieldSpec(
                        path: 'active',
                        label: 'Active Year',
                        type: FieldType.boolValue,
                      ),
                    ],
                    createDefaults: const {'active': false},
                    titlePath: 'displayName',
                    subtitlePaths: const ['startDate', 'endDate', 'active'],
                  ),
                ),

                // 4. Class Instances (Assignments)
                widget.academicYearId.isEmpty
                    ? const Center(child: Text('Select an academic year first.'))
                    : Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: CrudCollectionPage(
                          title: 'Class Assignments in ${widget.academicYearId}',
                          collection: _churchesRef
                              .doc(widget.churchId)
                              .collection('academicYears')
                              .doc(widget.academicYearId)
                              .collection('classInstances'),
                          fields: [
                            FieldSpec(
                              path: 'classId',
                              label: 'Class',
                              type: FieldType.reference,
                              required: true,
                              referenceCollectionPath: 'churches/${widget.churchId}/classes',
                              referenceDisplayPath: 'current.name',
                            ),
                            FieldSpec(
                              path: 'serviceGroupId',
                              label: 'Service Group (Department)',
                              type: FieldType.reference,
                              required: true,
                              referenceCollectionPath: 'churches/${widget.churchId}/serviceGroups',
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
                      ),

                // 5. Home Visits Log
                widget.academicYearId.isEmpty
                    ? const Center(child: Text('Select an academic year first.'))
                    : Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: HomeVisitsTab(
                          churchId: widget.churchId,
                          academicYearId: widget.academicYearId,
                        ),
                      ),

                // 6. Global Churches Config
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: CrudCollectionPage(
                    title: 'Churches Registry',
                    collection: _churchesRef,
                    fields: const [
                      FieldSpec(
                        path: 'displayName',
                        label: 'Church Name',
                        type: FieldType.text,
                        required: true,
                      ),
                      FieldSpec(
                        path: 'active',
                        label: 'Active Church',
                        type: FieldType.boolValue,
                      ),
                      FieldSpec(
                        path: 'activeAcademicYearId',
                        label: 'Active Academic Year ID',
                        type: FieldType.text,
                      ),
                    ],
                    createDefaults: const {'active': true},
                    titlePath: 'displayName',
                    subtitlePaths: const [
                      'active',
                      'activeAcademicYearId',
                    ],
                    beforeSave: _withCreatedAt,
                  ),
                ),
              ],
            ),
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
