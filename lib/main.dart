
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'firebase_options.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const FirebaseBootstrapApp());
}

class FirebaseBootstrapApp extends StatefulWidget {
  const FirebaseBootstrapApp({super.key});

  @override
  State<FirebaseBootstrapApp> createState() => _FirebaseBootstrapAppState();
}

class _FirebaseBootstrapAppState extends State<FirebaseBootstrapApp> {
  late final Future<FirebaseApp> _bootstrapFuture = _initializeFirebase();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<FirebaseApp>(
      future: _bootstrapFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return MaterialApp(
            home: Scaffold(
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'Firebase initialization failed.\n\n${snapshot.error}',
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ),
          );
        }
        if (!snapshot.hasData) {
          return const MaterialApp(
            home: Scaffold(
              body: Center(child: CircularProgressIndicator()),
            ),
          );
        }
        return const SundaySchoolApp();
      },
    );
  }
}

Future<FirebaseApp> _initializeFirebase() async {
  return Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
}

class SundaySchoolApp extends StatelessWidget {
  const SundaySchoolApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Oikonomos',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.teal),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

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
          title: const Text('Sunday School Admin'),
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
                  _selectedChurchId.isEmpty
                      ? const _MissingSelection(message: 'Select a church.')
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
                  _selectedChurchId.isEmpty
                      ? const _MissingSelection(message: 'Select a church.')
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
                                fields: const [
                                  FieldSpec(
                                    path: 'misterId',
                                    label: 'Mister ID',
                                    type: FieldType.text,
                                    required: true,
                                  ),
                                  FieldSpec(
                                    path: 'role',
                                    label: 'Role',
                                    type: FieldType.option,
                                    options: ['viewer', 'admin'],
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
                                createDefaults: const {'role': 'viewer'},
                                titlePath: 'misterId',
                                subtitlePaths: ['role', 'startAt', 'endAt'],
                              ),
                            ],
                          ),
                        ),
                  _selectedChurchId.isEmpty
                      ? const _MissingSelection(message: 'Select a church.')
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
                  _selectedChurchId.isEmpty
                      ? const _MissingSelection(message: 'Select a church.')
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
                                fields: const [
                                  FieldSpec(
                                    path: 'misterId',
                                    label: 'Mister ID',
                                    type: FieldType.text,
                                    required: true,
                                  ),
                                  FieldSpec(
                                    path: 'role',
                                    label: 'Role',
                                    type: FieldType.option,
                                    options: ['viewer', 'admin'],
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
                                fields: const [
                                  FieldSpec(
                                    path: 'kidId',
                                    label: 'Kid ID',
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
                                titlePath: 'kidId',
                                subtitlePaths: ['startAt', 'endAt'],
                              ),
                            ],
                          ),
                        ),
                  _selectedChurchId.isEmpty
                      ? const _MissingSelection(message: 'Select a church.')
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
                  (_selectedChurchId.isEmpty || _selectedAcademicYearId.isEmpty)
                      ? const _MissingSelection(
                          message: 'Select a church and an academic year.',
                        )
                      : Padding(
                          padding: const EdgeInsets.all(12),
                          child: CrudCollectionPage(
                            title:
                                'Class Instances in $_selectedAcademicYearId',
                            collection: _churchesRef
                                .doc(_selectedChurchId)
                                .collection('academicYears')
                                .doc(_selectedAcademicYearId)
                                .collection('classInstances'),
                            fields: const [
                              FieldSpec(
                                path: 'classId',
                                label: 'Class ID',
                                type: FieldType.text,
                                required: true,
                              ),
                              FieldSpec(
                                path: 'familyId',
                                label: 'Family ID',
                                type: FieldType.text,
                                required: true,
                              ),
                              FieldSpec(
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
                  (_selectedChurchId.isEmpty || _selectedAcademicYearId.isEmpty)
                      ? const _MissingSelection(
                          message: 'Select a church and an academic year.',
                        )
                      : Padding(
                          padding: const EdgeInsets.all(12),
                          child: CrudCollectionPage(
                            title:
                                'Attendance Events in $_selectedAcademicYearId',
                            collection: _churchesRef
                                .doc(_selectedChurchId)
                                .collection('academicYears')
                                .doc(_selectedAcademicYearId)
                                .collection('attendanceEvents'),
                            fields: const [
                              FieldSpec(
                                path: 'title',
                                label: 'Title',
                                type: FieldType.text,
                                required: true,
                              ),
                              FieldSpec(
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
                                label: 'Created By (Mister ID)',
                                type: FieldType.text,
                              ),
                              FieldSpec(
                                path: 'classInstanceIds',
                                label: 'Class Instance IDs (comma separated)',
                                type: FieldType.csv,
                              ),
                              FieldSpec(
                                path: 'eventDate',
                                label: 'Event Date (ISO-8601)',
                                type: FieldType.dateTime,
                                required: true,
                              ),
                              FieldSpec(
                                path: 'takenAt',
                                label: 'Taken At (ISO-8601)',
                                type: FieldType.dateTime,
                              ),
                              FieldSpec(
                                path: 'takenBy',
                                label: 'Taken By (Mister ID)',
                                type: FieldType.text,
                              ),
                              FieldSpec(
                                path: 'statuses',
                                label: 'Statuses JSON',
                                type: FieldType.jsonMap,
                                hint: '{"KID_1001":"present"}',
                              ),
                              FieldSpec(
                                path: 'notesByKid',
                                label: 'Notes By Kid JSON',
                                type: FieldType.jsonMap,
                                hint: '{"KID_1002":"Sick"}',
                              ),
                              FieldSpec(
                                path: 'createdAt',
                                label: 'Created At (ISO-8601)',
                                type: FieldType.dateTime,
                              ),
                              FieldSpec(
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
                  (_selectedChurchId.isEmpty || _selectedAcademicYearId.isEmpty)
                      ? const _MissingSelection(
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
}

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
              ? const _MissingSelection(
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
                  fields: const [
                    FieldSpec(
                      path: 'kidId',
                      label: 'Kid ID',
                      type: FieldType.text,
                      required: true,
                    ),
                    FieldSpec(
                      path: 'visitDateTime',
                      label: 'Visit Date Time (ISO-8601)',
                      type: FieldType.dateTime,
                      required: true,
                    ),
                    FieldSpec(
                      path: 'visitorMisterIds',
                      label: 'Visitor Mister IDs (comma separated)',
                      type: FieldType.csv,
                    ),
                    FieldSpec(
                      path: 'notes',
                      label: 'Notes',
                      type: FieldType.multiline,
                      maxLines: 3,
                    ),
                    FieldSpec(
                      path: 'createdBy',
                      label: 'Created By (Mister ID)',
                      type: FieldType.text,
                    ),
                    FieldSpec(
                      path: 'createdAt',
                      label: 'Created At (ISO-8601)',
                      type: FieldType.dateTime,
                    ),
                    FieldSpec(
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
                  beforeSave: _withCreatedAtAndUpdatedAt,
                ),
        ),
      ],
    );
  }
}
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
      case FieldType.text:
      case FieldType.multiline:
      case FieldType.dateTime:
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

enum FieldType {
  text,
  multiline,
  boolValue,
  option,
  dateTime,
  csv,
  jsonMap,
}

class FieldSpec {
  const FieldSpec({
    required this.path,
    required this.label,
    required this.type,
    this.required = false,
    this.options = const [],
    this.hint,
    this.maxLines = 4,
  });

  final String path;
  final String label;
  final FieldType type;
  final bool required;
  final List<String> options;
  final String? hint;
  final int maxLines;
}

typedef SaveTransform = Map<String, dynamic> Function(
  Map<String, dynamic> data,
  bool isCreate,
);

class ChildCollectionAction {
  const ChildCollectionAction({
    required this.label,
    required this.title,
    required this.collectionFactory,
    required this.fields,
    this.createDefaults = const {},
    this.titlePath,
    this.subtitlePaths = const [],
    this.beforeSave,
  });

  final String label;
  final String title;
  final CollectionReference<Map<String, dynamic>> Function(
    String parentDocId,
    Map<String, dynamic> parentData,
  ) collectionFactory;
  final List<FieldSpec> fields;
  final Map<String, dynamic> createDefaults;
  final String? titlePath;
  final List<String> subtitlePaths;
  final SaveTransform? beforeSave;
}

class _MissingSelection extends StatelessWidget {
  const _MissingSelection({required this.message});

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
