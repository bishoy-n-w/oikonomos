// ignore_for_file: unnecessary_underscores, deprecated_member_use, use_build_context_synchronously
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';
import '../services/auth_service.dart';

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
  String _statusFilter = 'All'; // 'All', 'Active', 'Inactive'
  String? _selectedGroupFilter; // Column Header Service Group filter
  String? _selectedGradeFilter; // Column Header Grade filter

  final Map<String, String> _yearNames = {};
  final Map<String, String> _groupNames = {};
  final Map<String, String> _gradeNames = {};
  final Map<String, String> _gradeToGroup = {}; // Maps Grade ID to its Service Group ID

  final CollectionReference<Map<String, dynamic>> _churchesRef =
      FirebaseFirestore.instance.collection('churches');

  CollectionReference<Map<String, dynamic>> get _ref =>
      _churchesRef.doc(widget.churchId).collection('classes');

  @override
  void initState() {
    super.initState();
    _fetchNames();
  }

  @override
  void didUpdateWidget(covariant ClassesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.churchId != widget.churchId) {
      _fetchNames();
    }
  }

  Future<void> _fetchNames() async {
    if (widget.churchId.isEmpty) return;
    try {
      final db = _churchesRef.doc(widget.churchId);
      final churchDoc = await db.get();
      final gradesMap = churchDoc.data()?['grades'] as Map<String, dynamic>? ?? {};
      for (final k in gradesMap.keys) {
        final gData = gradesMap[k] as Map<String, dynamic>? ?? {};
        final gName = gData['name']?.toString() ?? 'Grade $k';
        final gGroupId = gData['serviceGroupId']?.toString() ?? '';
        
        _gradeNames[k] = gName;
        _gradeToGroup[k] = gGroupId;
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

    final isAddEnabled = isAdmin;

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
              Opacity(
                opacity: isAddEnabled ? 1.0 : 0.4,
                child: IgnorePointer(
                  ignoring: !isAddEnabled,
                  child: FilledButton.icon(
                    onPressed: () => _showCreateEditClassDialog(context, null),
                    icon: const Icon(Icons.add),
                    label: const Text('Create Class'),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // 2. DataTable list View
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: _ref.snapshots(),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Center(child: Text('Database Error: ${snapshot.error}'));
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }

                final classDocs = snapshot.data!.docs;
                final List<Map<String, dynamic>> flattenedClasses = [];

                for (final doc in classDocs) {
                  final data = doc.data();
                  final active = data['active'] ?? true;
                  final yearsMap = data['academicYears'] as Map<String, dynamic>? ?? {};

                  // Read only the years map configured for the current selected Academic Year in the top filter!
                  if (widget.academicYearId.isNotEmpty && yearsMap.containsKey(widget.academicYearId)) {
                    final yearData = yearsMap[widget.academicYearId] as Map<String, dynamic>;
                    final sGroupId = yearData['serviceGroupId']?.toString() ?? '';
                    final gradeId = yearData['gradeId']?.toString() ?? '';
                    final name = yearData['name']?.toString() ?? doc.id;

                    // Apply Top-Level Service Group filter
                    if (widget.serviceGroupId.isNotEmpty && sGroupId != widget.serviceGroupId) {
                      continue;
                    }

                    // Apply Local Status Filter
                    if (_statusFilter == 'Active' && !active) continue;
                    if (_statusFilter == 'Inactive' && active) continue;

                    // Apply Local Column Headers Matrix filters
                    if (_selectedGroupFilter != null && sGroupId != _selectedGroupFilter) continue;
                    if (_selectedGradeFilter != null && gradeId != _selectedGradeFilter) continue;

                    // Apply Local Search Filter by Class Name
                    if (_searchQuery.isNotEmpty && !name.toLowerCase().contains(_searchQuery)) {
                      continue;
                    }

                    flattenedClasses.add({
                      'doc': doc,
                      'yearData': yearData,
                      'active': active,
                      'name': name,
                      'serviceGroupId': sGroupId,
                      'gradeId': gradeId,
                    });
                  }
                }

                // Dynamically gather unique options for column header filters list
                final List<String> uniqueGroupsInTable = [];
                final List<String> uniqueGradesInTable = [];

                for (final item in flattenedClasses) {
                  final gId = item['serviceGroupId'] as String;
                  final grId = item['gradeId'] as String;

                  if (gId.isNotEmpty && !uniqueGroupsInTable.contains(gId)) {
                    uniqueGroupsInTable.add(gId);
                  }
                  if (grId.isNotEmpty && !uniqueGradesInTable.contains(grId)) {
                    uniqueGradesInTable.add(grId);
                  }
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
                            columns: [
                              // Column 1: Status Filter
                              DataColumn(
                                label: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Text('Status'),
                                    PopupMenuButton<String>(
                                      icon: const Icon(Icons.filter_list, size: 16),
                                      tooltip: 'Filter Status',
                                      onSelected: (val) {
                                        setState(() {
                                          _statusFilter = val;
                                        });
                                      },
                                      itemBuilder: (context) => [
                                        const PopupMenuItem(value: 'All', child: Text('All Statuses')),
                                        const PopupMenuItem(value: 'Active', child: Text('Active Only')),
                                        const PopupMenuItem(value: 'Inactive', child: Text('Inactive Only')),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              // Column 2: Class Name Filter (Inline Search)
                              DataColumn(
                                label: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Text('Class Name'),
                                    const SizedBox(width: 4),
                                    SizedBox(
                                      width: 130,
                                      child: TextField(
                                        decoration: const InputDecoration(
                                          hintText: 'Search...',
                                          border: InputBorder.none,
                                          isDense: true,
                                          contentPadding: EdgeInsets.zero,
                                        ),
                                        style: const TextStyle(fontSize: 12),
                                        onChanged: (val) {
                                          setState(() {
                                            _searchQuery = val.toLowerCase().trim();
                                          });
                                        },
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              // Column 3: Service Group Filter (Header Matrix Dropdown)
                              DataColumn(
                                label: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Text('Service Group'),
                                    PopupMenuButton<String?>(
                                      icon: const Icon(Icons.filter_list, size: 16),
                                      tooltip: 'Filter Group',
                                      onSelected: (val) {
                                        setState(() {
                                          _selectedGroupFilter = val;
                                        });
                                      },
                                      itemBuilder: (context) => [
                                        const PopupMenuItem<String?>(value: null, child: Text('All Groups')),
                                        ...uniqueGroupsInTable.map((id) => PopupMenuItem<String?>(value: id, child: Text(_groupNames[id] ?? id))),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              // Column 4: Grade Filter (Header Matrix Dropdown)
                              DataColumn(
                                label: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Text('Grade Level'),
                                    PopupMenuButton<String?>(
                                      icon: const Icon(Icons.filter_list, size: 16),
                                      tooltip: 'Filter Grade',
                                      onSelected: (val) {
                                        setState(() {
                                          _selectedGradeFilter = val;
                                        });
                                      },
                                      itemBuilder: (context) => [
                                        const PopupMenuItem<String?>(value: null, child: Text('All Grades')),
                                        ...uniqueGradesInTable.map((id) => PopupMenuItem<String?>(value: id, child: Text(_gradeNames[id] ?? id))),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              const DataColumn(label: Text('Enrolled Kids')),
                              const DataColumn(label: Text('Assigned Servants')),
                              const DataColumn(label: Text('Actions')),
                            ],
                            rows: flattenedClasses.map((item) {
                              final DocumentSnapshot<Map<String, dynamic>> doc = item['doc'];
                              final Map<String, dynamic> yearData = item['yearData'];
                              final bool active = item['active'];
                              final String className = item['name'];
                              final String sGroupId = item['serviceGroupId'];
                              final String gradeId = item['gradeId'];

                              final kidsList = List.from(yearData['KidIds'] ?? []);
                              final mistersList = List.from(yearData['MistersIds'] ?? []);

                              return DataRow(
                                cells: [
                                  DataCell(
                                    Icon(
                                      active ? Icons.check_circle : Icons.cancel,
                                      color: active ? Colors.green : Colors.red,
                                    ),
                                  ),
                                  DataCell(Text(className, style: const TextStyle(fontWeight: FontWeight.bold))),
                                  DataCell(Text(_groupNames[sGroupId] ?? sGroupId)),
                                  DataCell(
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: colorScheme.tertiaryContainer,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        _gradeNames[gradeId] ?? gradeId,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: colorScheme.onTertiaryContainer,
                                        ),
                                      ),
                                    ),
                                  ),
                                  DataCell(Text('${kidsList.length} Kids')),
                                  DataCell(Text('${mistersList.length} Servants')),
                                  DataCell(
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (isAdmin) ...[
                                          IconButton(
                                            icon: const Icon(Icons.edit_outlined, size: 18),
                                            tooltip: 'Edit Class',
                                            onPressed: () => _showCreateEditClassDialog(context, doc),
                                          ),
                                          IconButton(
                                            icon: const Icon(Icons.delete_outline, size: 18),
                                            color: colorScheme.error,
                                            tooltip: 'Delete Class',
                                            onPressed: () => _deleteClass(doc),
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

  // --- ACTIONS: CREATE & EDIT DIALOG WITH MISTERS & KIDS CHIPS ---
  Future<void> _showCreateEditClassDialog(
    BuildContext context,
    DocumentSnapshot<Map<String, dynamic>>? classDoc,
  ) async {
    final isEdit = classDoc != null;
    final data = classDoc?.data();
    final classId = classDoc?.id ?? '';

    final yearsMap = data?['academicYears'] as Map<String, dynamic>? ?? {};
    final yearData = isEdit && yearsMap.containsKey(widget.academicYearId)
        ? yearsMap[widget.academicYearId] as Map<String, dynamic>
        : {};

    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController(text: yearData['name']?.toString());
    bool isActive = data?['active'] ?? true;

    // Local lists mapping IDs / emails
    final List<String> localKidIds = List<String>.from(yearData['KidIds'] ?? []);
    final List<String> localMisterEmails = List<String>.from(yearData['MistersIds'] ?? []);

    String? selYear = widget.academicYearId.isNotEmpty ? widget.academicYearId : null;
    String? selGroup = yearData['serviceGroupId']?.toString() ?? (widget.serviceGroupId.isNotEmpty ? widget.serviceGroupId : null);
    String? selGrade = yearData['gradeId']?.toString();

    // Fetch lists for dropdowns
    final db = _churchesRef.doc(widget.churchId);
    final ySnap = await db.collection('academicYears').get();
    final gSnap = await db.collection('serviceGroups').get();

    // Mapping maps for chip lookups
    final Map<String, String> kidIdToName = {};
    final kidsSnap = await db.collection('kids').where('active', isEqualTo: true).get();
    for (final doc in kidsSnap.docs) {
      kidIdToName[doc.id] = (doc.data()['current']?['fullName'] ?? doc.id).toString();
    }

    final Map<String, String> emailToName = {};
    final mistersSnap = await db.collection('misters').where('active', isEqualTo: true).get();
    for (final doc in mistersSnap.docs) {
      emailToName[doc.id] = (doc.data()['displayName'] ?? doc.id).toString();
    }

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          // Filter grade dropdown selection based on chosen Service Group dynamically!
          final availableGrades = _gradeToGroup.entries
              .where((e) => selGroup != null && e.value == selGroup)
              .map((e) => e.key)
              .toList();

          return AlertDialog(
            title: Text(isEdit ? 'Edit Class Configuration' : 'Create New Class'),
            content: SizedBox(
              width: 700,
              height: 600,
              child: Form(
                key: formKey,
                autovalidateMode: AutovalidateMode.onUserInteraction,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Active status'),
                        value: isActive,
                        onChanged: (v) => setModalState(() => isActive = v),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: selYear,
                        decoration: const InputDecoration(labelText: 'Academic Year *', border: OutlineInputBorder()),
                        items: ySnap.docs
                            .map((d) => DropdownMenuItem(value: d.id, child: Text(d.data()['displayName'] ?? d.id)))
                            .toList(),
                        onChanged: isEdit ? null : (v) => setModalState(() => selYear = v),
                        validator: (v) => v == null ? 'Required' : null,
                      ),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        value: selGroup,
                        decoration: const InputDecoration(labelText: 'Service Group *', border: OutlineInputBorder()),
                        items: gSnap.docs
                            .map((d) => DropdownMenuItem(value: d.id, child: Text(d.data()['displayName'] ?? d.id)))
                            .toList(),
                        onChanged: (v) => setModalState(() {
                          selGroup = v;
                          selGrade = null; // Reset grade on group change to prevent mismatch
                        }),
                        validator: (v) => v == null ? 'Required' : null,
                      ),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        value: selGrade,
                        decoration: const InputDecoration(labelText: 'Grade Level *', border: OutlineInputBorder()),
                        items: availableGrades
                            .map((id) => DropdownMenuItem(value: id, child: Text(_gradeNames[id] ?? id)))
                            .toList(),
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
                        validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null,
                      ),
                      const Divider(height: 32),

                      // --- MISTERS (SERVANTS) CONFIG SEGMENT ---
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Assigned Servants (Optional)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline, color: Colors.indigo),
                            onPressed: selGroup == null
                                ? () => _showSnack('Please select a Service Group first!')
                                : () => _showMisterSelector(context, localMisterEmails, selGroup!, setModalState),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: localMisterEmails.map((email) {
                          final displayName = emailToName[email] ?? email;
                          return Chip(
                            label: Text(displayName),
                            deleteIcon: const Icon(Icons.close, size: 14),
                            onDeleted: () => setModalState(() => localMisterEmails.remove(email)),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 16),

                      // --- KIDS (STUDENTS) CONFIG SEGMENT ---
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Enrolled Students (Optional)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline, color: Colors.teal),
                            onPressed: () => _showKidSelector(context, localKidIds, setModalState),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: localKidIds.map((id) {
                          final displayName = kidIdToName[id] ?? id;
                          return Chip(
                            label: Text(displayName),
                            deleteIcon: const Icon(Icons.close, size: 14),
                            onDeleted: () => setModalState(() => localKidIds.remove(id)),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () async {
                  if (formKey.currentState!.validate() && selYear != null && selGroup != null && selGrade != null) {
                    final className = nameController.text.trim();
                    final payloadData = {
                      'name': className,
                      'serviceGroupId': selGroup,
                      'gradeId': int.tryParse(selGrade!) ?? selGrade,
                      'KidIds': localKidIds,
                      'MistersIds': localMisterEmails,
                    };

                    try {
                      if (!isEdit) {
                        final docRef = _ref.doc();
                        await docRef.set({
                          'active': isActive,
                          'createdAt': FieldValue.serverTimestamp(),
                          'createdBy': AuthService.instance.currentUser?.uid,
                          'academicYears': {
                            selYear: payloadData,
                          }
                        });
                      } else {
                        await _ref.doc(classId).update({
                          'active': isActive,
                          'academicYears.$selYear': payloadData,
                        });
                      }
                      Navigator.pop(context);
                      _showSnack('Class successfully saved.');
                    } catch (e) {
                      _showSnack('Save failed: $e');
                    }
                  }
                },
                child: const Text('Save Class'),
              ),
            ],
          );
        },
      ),
    );
  }

  // --- ACTIONS: POPUP KID MULTI-SELECT MATRIX (WITH SEARCH BY NAME, GROUP, CLASS) ---
  Future<void> _showKidSelector(
    BuildContext context,
    List<String> currentSelectedKidIds,
    void Function(void Function()) parentSetState,
  ) async {
    final db = _churchesRef.doc(widget.churchId);
    final kidsSnap = await db.collection('kids').where('active', isEqualTo: true).get();
    final allKids = kidsSnap.docs;

    final classesSnap = await _ref.where('active', isEqualTo: true).get();
    final Map<String, String> kidToClassName = {};
    for (final cl in classesSnap.docs) {
      final data = cl.data();
      final yearsMap = data['academicYears'] as Map<String, dynamic>? ?? {};
      if (yearsMap.containsKey(widget.academicYearId)) {
        final yrData = yearsMap[widget.academicYearId] as Map<String, dynamic>;
        final classTitle = yrData['name']?.toString() ?? cl.id;
        final kidsArray = List.from(yrData['KidIds'] ?? []);
        for (final kId in kidsArray) {
          kidToClassName[kId.toString()] = classTitle;
        }
      }
    }

    String dlgSearchName = '';
    String dlgSearchGroup = '';
    String dlgSearchClass = '';
    final List<String> tempSelected = List.from(currentSelectedKidIds);

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          final filteredKids = allKids.where((k) {
            final emailId = k.id;
            final fullName = (k.data()['current']?['fullName'] ?? k.id).toString();
            final activeAssign = k.data()['activeAssignment'] as Map<String, dynamic>? ?? {};
            
            final resolvedGroupName = _groupNames[activeAssign['serviceGroupId']?.toString() ?? ''] ?? '';
            final resolvedClassName = kidToClassName[emailId] ?? '';

            if (dlgSearchName.isNotEmpty && !fullName.toLowerCase().contains(dlgSearchName.toLowerCase().trim())) return false;
            if (dlgSearchGroup.isNotEmpty && !resolvedGroupName.toLowerCase().contains(dlgSearchGroup.toLowerCase().trim())) return false;
            if (dlgSearchClass.isNotEmpty && !resolvedClassName.toLowerCase().contains(dlgSearchClass.toLowerCase().trim())) return false;

            return true;
          }).toList();

          return AlertDialog(
            title: const Text('Enroll Students'),
            content: SizedBox(
              width: 600,
              height: 450,
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          decoration: const InputDecoration(labelText: 'Search Name', prefixIcon: Icon(Icons.person)),
                          onChanged: (v) => setModalState(() => dlgSearchName = v),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          decoration: const InputDecoration(labelText: 'Search Group', prefixIcon: Icon(Icons.group)),
                          onChanged: (v) => setModalState(() => dlgSearchGroup = v),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          decoration: const InputDecoration(labelText: 'Search Class', prefixIcon: Icon(Icons.class_)),
                          onChanged: (v) => setModalState(() => dlgSearchClass = v),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: ListView.separated(
                      itemCount: filteredKids.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final k = filteredKids[index];
                        final kId = k.id;
                        final name = k.data()['current']?['fullName'] ?? kId;
                        final activeAssign = k.data()['activeAssignment'] as Map<String, dynamic>? ?? {};

                        final groupLabel = _groupNames[activeAssign['serviceGroupId']?.toString() ?? ''] ?? 'Unassigned';
                        final classLabel = kidToClassName[kId] ?? 'Unassigned';

                        final isSelected = tempSelected.contains(kId);

                        return CheckboxListTile(
                          dense: true,
                          title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('Group: $groupLabel  •  Class: $classLabel'),
                          value: isSelected,
                          onChanged: (val) {
                            setModalState(() {
                              if (val == true) {
                                tempSelected.add(kId);
                              } else {
                                tempSelected.remove(kId);
                              }
                            });
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
              FilledButton(
                onPressed: () {
                  parentSetState(() {
                    currentSelectedKidIds.clear();
                    currentSelectedKidIds.addAll(tempSelected);
                  });
                  Navigator.pop(context);
                },
                child: const Text('Apply Selection'),
              ),
            ],
          );
        },
      ),
    );
  }

  // --- ACTIONS: POPUP SERVANT MULTI-SELECT MATRIX (WITH SEARCH BY NAME, GROUP, CLASS) ---
  Future<void> _showMisterSelector(
    BuildContext context,
    List<String> currentSelectedMisterEmails,
    String targetGroupId,
    void Function(void Function()) parentSetState,
  ) async {
    final db = _churchesRef.doc(widget.churchId);

    // Filter list strictly to servants who are mapped inside the selected Service Group!
    final groupDoc = await db.collection('serviceGroups').doc(targetGroupId).get();
    final groupMistersMap = groupDoc.data()?['misters'] as Map<String, dynamic>? ?? {};
    final allowedEmails = groupMistersMap.keys.toList();

    if (allowedEmails.isEmpty) {
      _showSnack('The selected Service Group has no active servants.');
      return;
    }

    // Query active misters
    final mistersSnap = await db.collection('misters').where('active', isEqualTo: true).get();
    final allMisters = mistersSnap.docs.where((m) => allowedEmails.contains(m.id)).toList();

    // Query assigned classes to show in subtitle
    final classesSnap = await _ref.where('active', isEqualTo: true).get();
    final Map<String, List<String>> misterToClasses = {};
    for (final cl in classesSnap.docs) {
      final data = cl.data();
      final yearsMap = data['academicYears'] as Map<String, dynamic>? ?? {};
      if (yearsMap.containsKey(widget.academicYearId)) {
        final yrData = yearsMap[widget.academicYearId] as Map<String, dynamic>;
        final classTitle = yrData['name']?.toString() ?? cl.id;
        final mistersArray = List.from(yrData['MistersIds'] ?? []);
        for (final email in mistersArray) {
          misterToClasses.putIfAbsent(email.toString(), () => []).add(classTitle);
        }
      }
    }

    // Resolve which other groups each mister belongs to
    final groupsSnap = await db.collection('serviceGroups').get();
    final Map<String, List<String>> misterToGroups = {};
    for (final g in groupsSnap.docs) {
      final mData = g.data()['misters'] as Map<String, dynamic>? ?? {};
      for (final email in mData.keys) {
        misterToGroups.putIfAbsent(email, () => []).add(g.data()['displayName'] ?? g.id);
      }
    }

    String dlgSearchName = '';
    String dlgSearchGroup = '';
    String dlgSearchClass = '';
    final List<String> tempSelected = List.from(currentSelectedMisterEmails);

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          final filteredMisters = allMisters.where((m) {
            final email = m.id;
            final fullName = (m.data()['displayName'] ?? m.id).toString();
            
            final resolvedGroups = misterToGroups[email] ?? [];
            final resolvedGroupsStr = resolvedGroups.join(' ');
            final resolvedClasses = misterToClasses[email] ?? [];
            final resolvedClassesStr = resolvedClasses.join(' ');

            if (dlgSearchName.isNotEmpty && !fullName.toLowerCase().contains(dlgSearchName.toLowerCase().trim())) return false;
            if (dlgSearchGroup.isNotEmpty && !resolvedGroupsStr.toLowerCase().contains(dlgSearchGroup.toLowerCase().trim())) return false;
            if (dlgSearchClass.isNotEmpty && !resolvedClassesStr.toLowerCase().contains(dlgSearchClass.toLowerCase().trim())) return false;

            return true;
          }).toList();

          return AlertDialog(
            title: const Text('Assign Servants'),
            content: SizedBox(
              width: 600,
              height: 450,
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          decoration: const InputDecoration(labelText: 'Search Name', prefixIcon: Icon(Icons.person)),
                          onChanged: (v) => setModalState(() => dlgSearchName = v),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          decoration: const InputDecoration(labelText: 'Search Group', prefixIcon: Icon(Icons.group)),
                          onChanged: (v) => setModalState(() => dlgSearchGroup = v),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          decoration: const InputDecoration(labelText: 'Search Class', prefixIcon: Icon(Icons.class_)),
                          onChanged: (v) => setModalState(() => dlgSearchClass = v),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: ListView.separated(
                      itemCount: filteredMisters.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final m = filteredMisters[index];
                        final email = m.id;
                        final name = m.data()['displayName'] ?? email;

                        final groups = misterToGroups[email] ?? [];
                        final classes = misterToClasses[email] ?? [];

                        final isSelected = tempSelected.contains(email);

                        return CheckboxListTile(
                          dense: true,
                          title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('Groups: ${groups.isEmpty ? "None" : groups.join(", ")}  •  Classes: ${classes.isEmpty ? "None" : classes.join(", ")}'),
                          value: isSelected,
                          onChanged: (val) {
                            setModalState(() {
                              if (val == true) {
                                tempSelected.add(email);
                              } else {
                                tempSelected.remove(email);
                              }
                            });
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
              FilledButton(
                onPressed: () {
                  parentSetState(() {
                    currentSelectedMisterEmails.clear();
                    currentSelectedMisterEmails.addAll(tempSelected);
                  });
                  Navigator.pop(context);
                },
                child: const Text('Apply Selection'),
              ),
            ],
          );
        },
      ),
    );
  }

  // --- ACTIONS: DELETE CLASS ---
  Future<void> _deleteClass(DocumentSnapshot<Map<String, dynamic>> doc) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Class?'),
            content: Text('Are you sure you want to delete "${doc.id}"? This action is permanent.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
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
      await doc.reference.delete();
      _showSnack('Class successfully deleted.');
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
