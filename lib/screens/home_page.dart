import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/field_spec.dart';
import '../widgets/crud_collection.dart';
import '../services/auth_service.dart';
import '../constants.dart';
import 'home_visits_tab.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  static const _tabs = <Tab>[
    Tab(text: 'Churches'),
    Tab(text: 'Misters'),
    Tab(text: 'Families'),
    Tab(text: 'Kids'),
    Tab(text: 'Classes'),
    Tab(text: 'Academic Years'),
    Tab(text: 'Class Instances'),
    Tab(text: 'Attendance'),
    Tab(text: 'Home Visits'),
  ];

  String _selectedChurchId = 'CHC_ABC123';
  String _selectedAcademicYearId = 'AY_2026';

  CollectionReference<Map<String, dynamic>> get _churchesRef =>
      FirebaseFirestore.instance.collection('churches');

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: _tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.asset(
                  'assets/icon.png',
                  width: 32,
                  height: 32,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
                ),
              ),
              const SizedBox(width: 10),
              const Text('Sunday School Admin'),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.logout),
              tooltip: 'Sign Out',
              onPressed: _handleSignOut,
            ),
          ],
          bottom: const TabBar(
            isScrollable: true,
            tabs: _tabs,
          ),
        ),
        body: Column(
          children: [
            _buildContextCard(),
            Expanded(
              child: TabBarView(
                children: [
                  // Tab 1: Churches
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: CrudCollectionPage(
                      title: 'Churches',
                      collection: _churchesRef,
                      fields: const [
                        FieldSpec(
                          path: 'displayName',
                          label: 'Display Name',
                          type: FieldType.text,
                          required: true,
                        ),
                        FieldSpec(
                          path: 'active',
                          label: 'Active',
                          type: FieldType.boolValue,
                        ),
                        FieldSpec(
                          path: 'activeAcademicYearId',
                          label: 'Active Academic Year ID',
                          type: FieldType.text,
                        ),
                        FieldSpec(
                          path: 'createdAt',
                          label: 'Created At (ISO-8601)',
                          type: FieldType.dateTime,
                          hint: 'e.g. 2026-02-10T08:30:00Z',
                        ),
                      ],
                      createDefaults: const {'active': true},
                      titlePath: 'displayName',
                      subtitlePaths: const [
                        'active',
                        'activeAcademicYearId',
                        'createdAt',
                      ],
                      beforeSave: _withCreatedAt,
                    ),
                  ),

                  // Tab 2: Misters
                  _selectedChurchId.isEmpty
                      ? const MissingSelection(message: 'Select a church.')
                      : Padding(
                          padding: const EdgeInsets.all(12),
                          child: CrudCollectionPage(
                            title: 'Misters in $_selectedChurchId',
                            collection: _churchesRef
                                .doc(_selectedChurchId)
                                .collection('misters'),
                            fields: const [
                              FieldSpec(
                                path: 'authUid',
                                label: 'Auth UID',
                                type: FieldType.text,
                                required: true,
                              ),
                              FieldSpec(
                                path: 'displayName',
                                label: 'Display Name',
                                type: FieldType.text,
                                required: true,
                              ),
                              FieldSpec(
                                path: 'phone',
                                label: 'Phone',
                                type: FieldType.text,
                              ),
                              FieldSpec(
                                path: 'churchRole',
                                label: 'Church Role',
                                type: FieldType.option,
                                options: ['viewer', 'admin'],
                              ),
                              FieldSpec(
                                path: 'active',
                                label: 'Active',
                                type: FieldType.boolValue,
                              ),
                              FieldSpec(
                                path: 'createdAt',
                                label: 'Created At (ISO-8601)',
                                type: FieldType.dateTime,
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
                              'active',
                              'authUid',
                              'createdAt',
                            ],
                            beforeSave: _withCreatedAt,
                          ),
                        ),

                  // Tab 3: Families
                  _selectedChurchId.isEmpty
                      ? const MissingSelection(message: 'Select a church.')
                      : Padding(
                          padding: const EdgeInsets.all(12),
                          child: CrudCollectionPage(
                            title: 'Families in $_selectedChurchId',
                            collection: _churchesRef
                                .doc(_selectedChurchId)
                                .collection('families'),
                            fields: const [
                              FieldSpec(
                                path: 'active',
                                label: 'Active',
                                type: FieldType.boolValue,
                              ),
                              FieldSpec(
                                path: 'current.displayName',
                                label: 'Current Display Name',
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
                                label: 'Versions',
                                title: 'Family Versions',
                                collectionFactory:
                                    (parentId, _) => _churchesRef
                                        .doc(_selectedChurchId)
                                        .collection('families')
                                        .doc(parentId)
                                        .collection('versions'),
                                fields: const [
                                  FieldSpec(
                                    path: 'displayName',
                                    label: 'Display Name',
                                    type: FieldType.text,
                                    required: true,
                                  ),
                                  FieldSpec(
                                    path: 'startAt',
                                    label: 'Start At (ISO-8601)',
                                    type: FieldType.dateTime,
                                    required: true,
                                  ),
                                  FieldSpec(
                                    path: 'endAt',
                                    label: 'End At (ISO-8601)',
                                    type: FieldType.dateTime,
                                  ),
                                ],
                                titlePath: 'displayName',
                                subtitlePaths: ['startAt', 'endAt'],
                              ),
                              ChildCollectionAction(
                                label: 'Mister Memberships',
                                title: 'Family Mister Memberships',
                                collectionFactory:
                                    (parentId, _) => _churchesRef
                                        .doc(_selectedChurchId)
                                        .collection('families')
                                        .doc(parentId)
                                        .collection('mistersMemberships'),
                                fields: [
                                  FieldSpec(
                                    path: 'misterId',
                                    label: 'Mister',
                                    type: FieldType.reference,
                                    required: true,
                                    referenceCollectionPath: 'churches/$_selectedChurchId/misters',
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
                                subtitlePaths: ['role', 'startAt', 'endAt'],
                              ),
                            ],
                          ),
                        ),

                  // Tab 4: Kids
                  _selectedChurchId.isEmpty
                      ? const MissingSelection(message: 'Select a church.')
                      : Padding(
                          padding: const EdgeInsets.all(12),
                          child: CrudCollectionPage(
                            title: 'Kids in $_selectedChurchId',
                            collection: _churchesRef
                                .doc(_selectedChurchId)
                                .collection('kids'),
                            fields: const [
                              FieldSpec(
                                path: 'active',
                                label: 'Active',
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
                                label: 'Date of Birth (ISO-8601)',
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
                                label: 'Notes',
                                type: FieldType.multiline,
                                maxLines: 3,
                              ),
                              FieldSpec(
                                path: 'createdAt',
                                label: 'Created At (ISO-8601)',
                                type: FieldType.dateTime,
                              ),
                            ],
                            createDefaults: const {'active': true},
                            titlePath: 'current.fullName',
                            subtitlePaths: const [
                              'current.gender',
                              'current.school',
                              'current.address',
                              'active',
                              'createdAt',
                            ],
                            beforeSave: _withCreatedAt,
                            childActions: [
                              ChildCollectionAction(
                                label: 'Versions',
                                title: 'Kid Versions',
                                collectionFactory:
                                    (parentId, _) => _churchesRef
                                        .doc(_selectedChurchId)
                                        .collection('kids')
                                        .doc(parentId)
                                        .collection('versions'),
                                fields: const [
                                  FieldSpec(
                                    path: 'at',
                                    label: 'At (ISO-8601)',
                                    type: FieldType.dateTime,
                                    required: true,
                                  ),
                                  FieldSpec(
                                    path: 'changes',
                                    label: 'Changes JSON',
                                    type: FieldType.jsonMap,
                                  ),
                                ],
                                titlePath: 'at',
                                subtitlePaths: ['changes'],
                              ),
                            ],
                          ),
                        ),

                  // Tab 5: Classes
                  _selectedChurchId.isEmpty
                      ? const MissingSelection(message: 'Select a church.')
                      : Padding(
                          padding: const EdgeInsets.all(12),
                          child: CrudCollectionPage(
                            title: 'Classes in $_selectedChurchId',
                            collection: _churchesRef
                                .doc(_selectedChurchId)
                                .collection('classes'),
                            fields: const [
                              FieldSpec(
                                path: 'active',
                                label: 'Active',
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
                                label: 'Current Kid IDs (comma separated)',
                                type: FieldType.csv,
                              ),
                              FieldSpec(
                                path: 'current.currentMisters',
                                label: 'Current Misters JSON',
                                type: FieldType.jsonMap,
                                hint: '{"MID_ABC123":"admin"}',
                              ),
                              FieldSpec(
                                path: 'createdAt',
                                label: 'Created At (ISO-8601)',
                                type: FieldType.dateTime,
                              ),
                            ],
                            createDefaults: const {'active': true},
                            titlePath: 'current.name',
                            subtitlePaths: const [
                              'active',
                              'current.currentKidIds',
                              'current.currentMisters',
                              'createdAt',
                            ],
                            beforeSave: _withCreatedAt,
                            childActions: [
                              ChildCollectionAction(
                                label: 'Versions',
                                title: 'Class Versions',
                                collectionFactory:
                                    (parentId, _) => _churchesRef
                                        .doc(_selectedChurchId)
                                        .collection('classes')
                                        .doc(parentId)
                                        .collection('versions'),
                                fields: const [
                                  FieldSpec(
                                    path: 'name',
                                    label: 'Name',
                                    type: FieldType.text,
                                    required: true,
                                  ),
                                  FieldSpec(
                                    path: 'startAt',
                                    label: 'Start At (ISO-8601)',
                                    type: FieldType.dateTime,
                                    required: true,
                                  ),
                                  FieldSpec(
                                    path: 'endAt',
                                    label: 'End At (ISO-8601)',
                                    type: FieldType.dateTime,
                                  ),
                                ],
                                titlePath: 'name',
                                subtitlePaths: ['startAt', 'endAt'],
                              ),
                              ChildCollectionAction(
                                label: 'Mister Memberships',
                                title: 'Class Mister Memberships',
                                collectionFactory:
                                    (parentId, _) => _churchesRef
                                        .doc(_selectedChurchId)
                                        .collection('classes')
                                        .doc(parentId)
                                        .collection('mistersMemberships'),
                                fields: [
                                  FieldSpec(
                                    path: 'misterId',
                                    label: 'Mister',
                                    type: FieldType.reference,
                                    required: true,
                                    referenceCollectionPath: 'churches/$_selectedChurchId/misters',
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
                                subtitlePaths: ['role', 'startAt', 'endAt'],
                              ),
                              ChildCollectionAction(
                                label: 'Kid Memberships',
                                title: 'Class Kid Memberships',
                                collectionFactory:
                                    (parentId, _) => _churchesRef
                                        .doc(_selectedChurchId)
                                        .collection('classes')
                                        .doc(parentId)
                                        .collection('kidsMemberships'),
                                fields: [
                                  FieldSpec(
                                    path: 'kidId',
                                    label: 'Kid',
                                    type: FieldType.reference,
                                    required: true,
                                    referenceCollectionPath: 'churches/$_selectedChurchId/kids',
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
                                subtitlePaths: ['startAt', 'endAt'],
                              ),
                            ],
                          ),
                        ),

                  // Tab 6: Academic Years
                  _selectedChurchId.isEmpty
                      ? const MissingSelection(message: 'Select a church.')
                      : Padding(
                          padding: const EdgeInsets.all(12),
                          child: CrudCollectionPage(
                            title: 'Academic Years in $_selectedChurchId',
                            collection: _churchesRef
                                .doc(_selectedChurchId)
                                .collection('academicYears'),
                            fields: const [
                              FieldSpec(
                                path: 'displayName',
                                label: 'Display Name',
                                type: FieldType.text,
                                required: true,
                              ),
                              FieldSpec(
                                path: 'startDate',
                                label: 'Start Date (ISO-8601)',
                                type: FieldType.dateTime,
                                required: true,
                              ),
                              FieldSpec(
                                path: 'endDate',
                                label: 'End Date (ISO-8601)',
                                type: FieldType.dateTime,
                                required: true,
                              ),
                              FieldSpec(
                                path: 'active',
                                label: 'Active',
                                type: FieldType.boolValue,
                              ),
                            ],
                            createDefaults: const {'active': false},
                            titlePath: 'displayName',
                            subtitlePaths: const ['startDate', 'endDate', 'active'],
                          ),
                        ),

                  // Tab 7: Class Instances
                  (_selectedChurchId.isEmpty || _selectedAcademicYearId.isEmpty)
                      ? const MissingSelection(
                          message: 'Select a church and an academic year.',
                        )
                      : Padding(
                          padding: const EdgeInsets.all(12),
                          child: CrudCollectionPage(
                            title: 'Class Instances in $_selectedAcademicYearId',
                            collection: _churchesRef
                                .doc(_selectedChurchId)
                                .collection('academicYears')
                                .doc(_selectedAcademicYearId)
                                .collection('classInstances'),
                            fields: [
                              FieldSpec(
                                path: 'classId',
                                label: 'Class',
                                type: FieldType.reference,
                                required: true,
                                referenceCollectionPath: 'churches/$_selectedChurchId/classes',
                                referenceDisplayPath: 'current.name',
                              ),
                              FieldSpec(
                                path: 'familyId',
                                label: 'Family',
                                type: FieldType.reference,
                                required: true,
                                referenceCollectionPath: 'churches/$_selectedChurchId/families',
                                referenceDisplayPath: 'current.displayName',
                              ),
                              const FieldSpec(
                                path: 'gradeId',
                                label: 'Grade ID',
                                type: FieldType.option,
                                options: _gradeOptions,
                              ),
                            ],
                            createDefaults: const {'gradeId': 'G1'},
                            titlePath: 'classId',
                            subtitlePaths: const ['familyId', 'gradeId'],
                          ),
                        ),

                  // Tab 8: Attendance
                  (_selectedChurchId.isEmpty || _selectedAcademicYearId.isEmpty)
                      ? const MissingSelection(
                          message: 'Select a church and an academic year.',
                        )
                      : Padding(
                          padding: const EdgeInsets.all(12),
                          child: CrudCollectionPage(
                            title: 'Attendance Events in $_selectedAcademicYearId',
                            collection: _churchesRef
                                .doc(_selectedChurchId)
                                .collection('academicYears')
                                .doc(_selectedAcademicYearId)
                                .collection('attendanceEvents'),
                            fields: [
                              const FieldSpec(
                                path: 'title',
                                label: 'Title',
                                type: FieldType.text,
                                required: true,
                              ),
                              const FieldSpec(
                                path: 'type',
                                label: 'Type',
                                type: FieldType.option,
                                options: [
                                  'Sunday School',
                                  'Bible Study',
                                  'Trip',
                                  'Conference',
                                  'Other',
                                ],
                              ),
                              FieldSpec(
                                path: 'createdBy',
                                label: 'Created By',
                                type: FieldType.reference,
                                referenceCollectionPath: 'churches/$_selectedChurchId/misters',
                                referenceDisplayPath: 'displayName',
                              ),
                              const FieldSpec(
                                path: 'classInstanceIds',
                                label: 'Class Instance IDs (comma separated)',
                                type: FieldType.csv,
                              ),
                              const FieldSpec(
                                path: 'eventDate',
                                label: 'Event Date (ISO-8601)',
                                type: FieldType.dateTime,
                                required: true,
                              ),
                              const FieldSpec(
                                path: 'takenAt',
                                label: 'Taken At (ISO-8601)',
                                type: FieldType.dateTime,
                              ),
                              FieldSpec(
                                path: 'takenBy',
                                label: 'Taken By',
                                type: FieldType.reference,
                                referenceCollectionPath: 'churches/$_selectedChurchId/misters',
                                referenceDisplayPath: 'displayName',
                              ),
                              const FieldSpec(
                                path: 'statuses',
                                label: 'Statuses JSON',
                                type: FieldType.jsonMap,
                                hint: '{"KID_1001":"present"}',
                              ),
                              const FieldSpec(
                                path: 'notesByKid',
                                label: 'Notes By Kid JSON',
                                type: FieldType.jsonMap,
                                hint: '{"KID_1002":"Sick"}',
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
                            createDefaults: const {'type': 'Sunday School'},
                            titlePath: 'title',
                            subtitlePaths: const [
                              'type',
                              'eventDate',
                              'takenAt',
                              'takenBy',
                              'updatedAt',
                            ],
                            beforeSave: _withCreatedAtAndUpdatedAt,
                          ),
                        ),

                  // Tab 9: Home Visits
                  (_selectedChurchId.isEmpty || _selectedAcademicYearId.isEmpty)
                      ? const MissingSelection(
                          message: 'Select a church and an academic year.',
                        )
                      : Padding(
                          padding: const EdgeInsets.all(12),
                          child: HomeVisitsTab(
                            churchId: _selectedChurchId,
                            academicYearId: _selectedAcademicYearId,
                          ),
                        ),
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Oikonomos Admin System',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                        fontSize: 10,
                      ),
                    ),
                    Text(
                     'v${AppVersion.current}',
                     style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContextCard() {
    return Card(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SizedBox(
              width: 360,
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: _churchesRef.snapshots(),
                builder: (context, snapshot) {
                  if (!snapshot.hasData) {
                    return const LinearProgressIndicator();
                  }
                  final docs = snapshot.data!.docs;
                  final ids = docs.map((e) => e.id).toList();
                  final currentValue =
                      ids.contains(_selectedChurchId) ? _selectedChurchId : null;
                  if (currentValue == null && ids.isNotEmpty) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (!mounted) return;
                      setState(() {
                        _selectedChurchId = ids.first;
                        _selectedAcademicYearId = '';
                      });
                    });
                  }
                  return DropdownButtonFormField<String>(
                    initialValue: currentValue,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      labelText: 'Church',
                    ),
                    items: docs
                        .map(
                          (doc) => DropdownMenuItem<String>(
                            value: doc.id,
                            child: Text(
                              '${(doc.data()['displayName'] ?? doc.id)} (${doc.id})',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        _selectedChurchId = value;
                        _selectedAcademicYearId = '';
                      });
                    },
                  );
                },
              ),
            ),
            SizedBox(
              width: 360,
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: _selectedChurchId.isEmpty
                    ? null
                    : _churchesRef
                        .doc(_selectedChurchId)
                        .collection('academicYears')
                        .snapshots(),
                builder: (context, snapshot) {
                  if (_selectedChurchId.isEmpty) {
                    return const Text('Choose a church first');
                  }
                  if (!snapshot.hasData) {
                    return const LinearProgressIndicator();
                  }
                  final docs = snapshot.data!.docs;
                  final ids = docs.map((e) => e.id).toList();
                  final currentValue = ids.contains(_selectedAcademicYearId)
                      ? _selectedAcademicYearId
                      : null;
                  if (currentValue == null && ids.isNotEmpty) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (!mounted) return;
                      setState(() {
                        _selectedAcademicYearId = ids.first;
                      });
                    });
                  }
                  return DropdownButtonFormField<String>(
                    initialValue: currentValue,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      labelText: 'Academic Year',
                    ),
                    items: docs
                        .map(
                          (doc) => DropdownMenuItem<String>(
                            value: doc.id,
                            child: Text(
                              '${(doc.data()['displayName'] ?? doc.id)} (${doc.id})',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        _selectedAcademicYearId = value;
                      });
                    },
                  );
                },
              ),
            ),
            FilledButton.icon(
              onPressed:
                  _selectedChurchId.isEmpty ? null : _selectChurchActiveYear,
              icon: const Icon(Icons.autorenew),
              label: const Text('Use Church Active Year'),
            ),
            Text(
              'Path: churches/$_selectedChurchId/academicYears/$_selectedAcademicYearId',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _selectChurchActiveYear() async {
    try {
      final doc = await _churchesRef.doc(_selectedChurchId).get();
      final activeId = (doc.data()?['activeAcademicYearId'] ?? '').toString();
      if (!mounted) return;
      if (activeId.isEmpty) {
        _showSnack(context, 'This church has no activeAcademicYearId.');
        return;
      }
      setState(() {
        _selectedAcademicYearId = activeId;
      });
    } catch (e) {
      if (!mounted) return;
      _showSnack(context, 'Failed to load active year: $e');
    }
  }

  Future<void> _handleSignOut() async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Sign Out'),
            content: const Text('Are you sure you want to sign out?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Sign Out'),
              ),
            ],
          ),
        ) ??
        false;

    if (confirmed) {
      await AuthService.instance.signOut();
    }
  }

  void _showSnack(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
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

Map<String, dynamic> _withCreatedAtAndUpdatedAt(
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
