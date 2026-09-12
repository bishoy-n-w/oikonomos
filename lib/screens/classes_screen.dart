// ignore_for_file: unnecessary_underscores, deprecated_member_use, use_build_context_synchronously
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';

class ClassesScreen extends StatefulWidget {
  const ClassesScreen({
    required this.churchId,
    required this.academicYearId,
    required this.serviceGroupId,
    required this.userRole,
    super.key,
  });

  final String churchId;
  final String academicYearId;
  final String serviceGroupId;
  final String userRole;

  @override
  State<ClassesScreen> createState() => _ClassesScreenState();
}

class _ClassesScreenState extends State<ClassesScreen> {
  String _searchQuery = '';
  String? _localGradeFilter;

  final Map<String, String> _yearNames = {};
  final Map<String, String> _groupNames = {};
  final Map<String, String> _gradeNames = {};

  final CollectionReference<Map<String, dynamic>> _churchesRef =
      FirebaseFirestore.instance.collection('churches');

  CollectionReference<Map<String, dynamic>> get _ref =>
      _churchesRef.doc(widget.churchId).collection('classes');

  @override
  void initState() {
    super.initState();
    _fetchNames();
  }

  Future<void> _fetchNames() async {
    if (widget.churchId.isEmpty) return;
    try {
      final db = _churchesRef.doc(widget.churchId);
      final churchDoc = await db.get();
      final gradesMap = churchDoc.data()?['grades'] as Map<String, dynamic>? ?? {};
      for (final k in gradesMap.keys) {
        _gradeNames[k] = gradesMap[k].toString();
      }

      final ySnap = await db.collection('academicYears').get();
      for (var d in ySnap.docs) {
        _yearNames[d.id] = d.data()['displayName'] ?? d.id;
      }

      final gSnap = await db.collection('serviceGroups').get();
      for (var d in gSnap.docs) {
        _groupNames[d.id] = d.data()['displayName'] ?? d.id;
      }

      if (mounted) setState(() {});
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final lang = AppSettings.language.value;
    final isRtl = AppSettings.isRtl();
    final isAdmin = widget.userRole == 'Admin' || widget.userRole == 'owner';

    if (widget.churchId.isEmpty) {
      return Center(
        child: Text(AppTranslation.translate('church', lang)),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Title & Header Action
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                AppTranslation.translate('classes', lang),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 28),
              ),
              if (isAdmin)
                FilledButton.icon(
                  onPressed: () => _showCreateEditClassDialog(context, null, null),
                  icon: const Icon(Icons.add),
                  label: const Text('Create Class'),
                ),
            ],
          ),
          const SizedBox(height: 24),

          // 2. Local Filters
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: colorScheme.outlineVariant),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: '${AppTranslation.translate('search', lang)} by Class Name...',
                        border: InputBorder.none,
                        icon: const Icon(Icons.search),
                      ),
                      onChanged: (val) {
                        setState(() {
                          _searchQuery = val.toLowerCase().trim();
                        });
                      },
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String?>(
                        isExpanded: true,
                        value: _localGradeFilter,
                        hint: const Text('Filter by Grade...'),
                        items: [
                          const DropdownMenuItem<String?>(
                            value: null,
                            child: Text('All Grades'),
                          ),
                          ..._gradeNames.entries.map((e) {
                            return DropdownMenuItem<String?>(
                              value: e.key,
                              child: Text(e.value),
                            );
                          }),
                        ],
                        onChanged: (val) {
                          setState(() {
                            _localGradeFilter = val;
                          });
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // 3. DataTable List View
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: _ref.where('active', isEqualTo: true).snapshots(),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Center(child: Text('Database Error: ${snapshot.error}'));
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }

                final classDocs = snapshot.data!.docs;

                // We flatten the classes because a single class document might span multiple academic years.
                // We will display a row for each active academic year mapping that matches the filters.
                final List<Map<String, dynamic>> flattenedClasses = [];

                for (final doc in classDocs) {
                  final data = doc.data();
                  final yearsMap = data['academicYears'] as Map<String, dynamic>? ?? {};

                  for (final yearId in yearsMap.keys) {
                    // Global Academic Year Filter
                    if (widget.academicYearId.isNotEmpty && yearId != widget.academicYearId) {
                      continue;
                    }

                    final yearData = yearsMap[yearId] as Map<String, dynamic>;
                    final serviceGroupId = yearData['serviceGroupId']?.toString() ?? '';
                    
                    // Global Service Group Filter
                    if (widget.serviceGroupId.isNotEmpty && serviceGroupId != widget.serviceGroupId) {
                      continue;
                    }

                    final gradeId = yearData['gradeId']?.toString() ?? '';

                    // Local Grade Filter
                    if (_localGradeFilter != null && gradeId != _localGradeFilter) {
                      continue;
                    }

                    final name = yearData['name']?.toString() ?? doc.id;

                    // Local Search Filter
                    if (_searchQuery.isNotEmpty && !name.toLowerCase().contains(_searchQuery)) {
                      continue;
                    }

                    flattenedClasses.add({
                      'doc': doc,
                      'yearId': yearId,
                      'yearData': yearData,
                    });
                  }
                }

                if (flattenedClasses.isEmpty) {
                  return const Center(child: Text('No classes registered or matching filters.'));
                }

                return Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: colorScheme.outlineVariant),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.vertical,
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          minWidth: MediaQuery.of(context).size.width - 200,
                        ),
                        child: Directionality(
                          textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
                          child: DataTable(
                            headingTextStyle: const TextStyle(fontWeight: FontWeight.bold),
                            columns: const [
                              DataColumn(label: Text('Class Name')),
                              DataColumn(label: Text('Academic Year')),
                              DataColumn(label: Text('Service Group')),
                              DataColumn(label: Text('Grade')),
                              DataColumn(label: Text('Enrolled Kids')),
                              DataColumn(label: Text('Assigned Servants')),
                              DataColumn(label: Text('Actions')),
                            ],
                            rows: flattenedClasses.map((item) {
                              final DocumentSnapshot<Map<String, dynamic>> doc = item['doc'];
                              final String yearId = item['yearId'];
                              final Map<String, dynamic> yearData = item['yearData'];

                              final className = yearData['name'] ?? doc.id;
                              final sGroupId = yearData['serviceGroupId']?.toString() ?? '';
                              final gradeId = yearData['gradeId']?.toString() ?? '';
                              
                              final kidsList = List.from(yearData['KidIds'] ?? []);
                              final mistersMap = yearData['Misters'] as Map<String, dynamic>? ?? {};

                              return DataRow(
                                cells: [
                                  DataCell(
                                    Text(
                                      className,
                                      style: const TextStyle(fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  DataCell(Text(_yearNames[yearId] ?? yearId)),
                                  DataCell(Text(_groupNames[sGroupId] ?? sGroupId)),
                                  DataCell(
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: colorScheme.tertiaryContainer,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        _gradeNames[gradeId] ?? 'N/A',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: colorScheme.onTertiaryContainer,
                                        ),
                                      ),
                                    ),
                                  ),
                                  DataCell(Text('${kidsList.length} Kids')),
                                  DataCell(Text('${mistersMap.length} Servants')),
                                  DataCell(
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (isAdmin) ...[
                                          IconButton(
                                            icon: const Icon(Icons.edit_outlined, size: 18),
                                            tooltip: 'Edit Class',
                                            onPressed: () => _showCreateEditClassDialog(context, doc, yearId),
                                          ),
                                          IconButton(
                                            icon: const Icon(Icons.delete_outline, size: 18),
                                            color: colorScheme.error,
                                            tooltip: 'Delete Class Mapping',
                                            onPressed: () => _deleteClassMapping(doc, yearId),
                                          ),
                                        ] else ...[
                                          const Tooltip(
                                            message: 'Read Only',
                                            child: Icon(Icons.lock_outline, size: 16, color: Colors.grey),
                                          )
                                        ]
                                      ],
                                    ),
                                  ),
                                ],
                              );
                            }).toList(),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // --- ACTIONS: CREATE & EDIT DIALOG ---
  Future<void> _showCreateEditClassDialog(
    BuildContext context,
    DocumentSnapshot<Map<String, dynamic>>? classDoc,
    String? editYearId,
  ) async {
    final isEdit = classDoc != null && editYearId != null;
    final data = classDoc?.data();
    final classId = classDoc?.id ?? '';
    
    final yearsMap = data?['academicYears'] as Map<String, dynamic>? ?? {};
    final yearData = isEdit && yearsMap.containsKey(editYearId) 
        ? yearsMap[editYearId] as Map<String, dynamic> 
        : {};

    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController(text: yearData['name']?.toString());
    
    // Dropdown state
    String? selYear = isEdit ? editYearId : (widget.academicYearId.isNotEmpty ? widget.academicYearId : null);
    String? selGroup = yearData['serviceGroupId']?.toString() ?? (widget.serviceGroupId.isNotEmpty ? widget.serviceGroupId : null);
    String? selGrade = yearData['gradeId']?.toString();

    // Fetch lists for dropdowns
    final db = _churchesRef.doc(widget.churchId);
    final ySnap = await db.collection('academicYears').get();
    final gSnap = await db.collection('serviceGroups').get();
    final churchDoc = await db.get();
    final gradesMap = churchDoc.data()?['grades'] as Map<String, dynamic>? ?? {};

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: Text(isEdit ? 'Edit Class Configuration' : 'Create New Class'),
          content: SizedBox(
            width: 500,
            child: Form(
              key: formKey,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<String>(
                      value: selYear,
                      decoration: const InputDecoration(labelText: 'Academic Year *', border: OutlineInputBorder()),
                      items: ySnap.docs.map((d) => DropdownMenuItem(value: d.id, child: Text(d.data()['displayName'] ?? d.id))).toList(),
                      onChanged: isEdit ? null : (v) => setModalState(() => selYear = v),
                      validator: (v) => v == null ? 'Required' : null,
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      value: selGroup,
                      decoration: const InputDecoration(labelText: 'Service Group *', border: OutlineInputBorder()),
                      items: gSnap.docs.map((d) => DropdownMenuItem(value: d.id, child: Text(d.data()['displayName'] ?? d.id))).toList(),
                      onChanged: (v) => setModalState(() => selGroup = v),
                      validator: (v) => v == null ? 'Required' : null,
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      value: selGrade,
                      decoration: const InputDecoration(labelText: 'Grade Level *', border: OutlineInputBorder()),
                      items: gradesMap.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value.toString()))).toList(),
                      onChanged: (v) => setModalState(() => selGrade = v),
                      validator: (v) => v == null ? 'Required' : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: nameController,
                      decoration: const InputDecoration(
                        labelText: 'Class Name *',
                        border: OutlineInputBorder(),
                        hintText: 'e.g. Grade 5 boys',
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Class name is required';
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  Navigator.pop(context, true);
                }
              },
              child: const Text('Save Class'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true && selYear != null && selGroup != null && selGrade != null) {
      final className = nameController.text.trim();
      
      final payloadData = {
        'name': className,
        'serviceGroupId': selGroup,
        'gradeId': int.tryParse(selGrade!) ?? selGrade,
      };

      try {
        if (!isEdit) {
          final docRef = _ref.doc();
          await docRef.set({
            'active': true,
            'createdAt': FieldValue.serverTimestamp(),
            'academicYears': {
              selYear: {
                ...payloadData,
                'KidIds': [],
                'Misters': {},
              }
            }
          });
          _showSnack('Class created successfully!');
        } else {
          await _ref.doc(classId).update({
            'academicYears.$selYear.name': className,
            'academicYears.$selYear.serviceGroupId': selGroup,
            'academicYears.$selYear.gradeId': int.tryParse(selGrade!) ?? selGrade,
          });
          _showSnack('Class updated successfully!');
        }
      } catch (e) {
        _showSnack('Operation failed: $e');
      }
    }
  }

  Future<void> _deleteClassMapping(DocumentSnapshot<Map<String, dynamic>> doc, String yearId) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Class Term?'),
            content: Text('Are you sure you want to delete this class configuration for $yearId?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: Colors.red),
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;

    if (confirmed) {
      try {
        await doc.reference.update({
          'academicYears.$yearId': FieldValue.delete(),
        });
        _showSnack('Class mapping deleted.');
      } catch (e) {
        _showSnack('Delete failed: $e');
      }
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
