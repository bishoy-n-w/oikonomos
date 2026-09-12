// ignore_for_file: unnecessary_underscores, deprecated_member_use, use_build_context_synchronously
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/app_settings.dart';
import '../services/auth_service.dart';

class ChurchesScreen extends StatefulWidget {
  const ChurchesScreen({required this.churchId, super.key});
  
  final String churchId;

  @override
  State<ChurchesScreen> createState() => _ChurchesScreenState();
}

class _ChurchesScreenState extends State<ChurchesScreen> {
  String _searchQuery = '';
  String _statusFilter = 'All'; // 'All', 'Active', 'Inactive'
  String? _selectedYearFilter; // To filter by Active Year Display Name

  final CollectionReference<Map<String, dynamic>> _churchesRef =
      FirebaseFirestore.instance.collection('churches');

  final Map<String, String> _yearCache = {}; // Cache to map Year ID to Display Name

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isRtl = AppSettings.isRtl();
    final user = AuthService.instance.currentUser;

    if (user == null) return const Scaffold(body: Center(child: Text('Please sign in')));

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance.collection('global_admins').snapshots(),
      builder: (context, globalAdminsSnapshot) {
        if (!globalAdminsSnapshot.hasData) return const Center(child: CircularProgressIndicator());
        final isGlobalAdmin = globalAdminsSnapshot.data!.docs.any((d) => d.id == user.uid);

        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: _churchesRef.snapshots(),
          builder: (context, churchesSnapshot) {
            if (churchesSnapshot.hasError) return Center(child: Text('Error: ${churchesSnapshot.error}'));
            if (!churchesSnapshot.hasData) return const Center(child: CircularProgressIndicator());

            final allChurches = churchesSnapshot.data!.docs;
            final List<QueryDocumentSnapshot<Map<String, dynamic>>> visibleChurches = [];

            for (final churchDoc in allChurches) {
              if (isGlobalAdmin) {
                visibleChurches.add(churchDoc);
              } else if (churchDoc.id == widget.churchId) {
                visibleChurches.add(churchDoc);
              }
            }

            // Warm up cache and find unique academic year display names for column header filter list
            final List<String> uniqueYearsInList = [];
            for (final ch in visibleChurches) {
              final activeYid = ch.data()['activeAcademicYearId'] as String?;
              if (activeYid != null && activeYid.isNotEmpty) {
                // We fetch display names dynamically, but to build the header popup we can gather loaded ones
                final cachedName = _yearCache[activeYid];
                if (cachedName != null && !uniqueYearsInList.contains(cachedName)) {
                  uniqueYearsInList.add(cachedName);
                }
              }
            }

            final filteredChurches = visibleChurches.where((doc) {
              final data = doc.data();
              final name = (data['displayName'] ?? '').toString().toLowerCase();
              final isActive = data['active'] ?? true;
              final activeYid = data['activeAcademicYearId'] as String? ?? '';

              // Apply Status Filter
              if (_statusFilter == 'Active' && !isActive) return false;
              if (_statusFilter == 'Inactive' && isActive) return false;

              // Apply Year Filter
              if (_selectedYearFilter != null) {
                final yearName = _yearCache[activeYid] ?? activeYid;
                if (yearName != _selectedYearFilter) return false;
              }

              return name.contains(_searchQuery.toLowerCase().trim());
            }).toList();

            return Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Church Admin',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 28),
                      ),
                      if (isGlobalAdmin)
                        FilledButton.icon(
                          onPressed: () => _showAddChurchDialog(context, user.uid),
                          icon: const Icon(Icons.add),
                          label: const Text('Add Church'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Table
                  Expanded(
                    child: filteredChurches.isEmpty
                        ? const Center(child: Text('No churches registered.'))
                        : Card(
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
                                        // 1. Status Filter Header
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
                                        // 2. Church Name Filter Header
                                        DataColumn(
                                          label: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Text('Church Name'),
                                              const SizedBox(width: 4),
                                              SizedBox(
                                                width: 140,
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
                                                      _searchQuery = val;
                                                    });
                                                  },
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        // 3. Active Year Display Name Header with Popup list filter
                                        DataColumn(
                                          label: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Text('Active Term'),
                                              PopupMenuButton<String?>(
                                                icon: const Icon(Icons.filter_list, size: 16),
                                                tooltip: 'Filter Term',
                                                onSelected: (val) {
                                                  setState(() {
                                                    _selectedYearFilter = val;
                                                  });
                                                },
                                                itemBuilder: (context) => [
                                                  const PopupMenuItem<String?>(value: null, child: Text('All Terms')),
                                                  ...uniqueYearsInList.map((yr) => PopupMenuItem<String?>(value: yr, child: Text(yr))),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                        const DataColumn(label: Text('Grades')),
                                        const DataColumn(label: Text('Actions')),
                                      ],
                                      rows: filteredChurches.map((doc) {
                                        final churchId = doc.id;
                                        final data = doc.data();
                                        final active = data['active'] ?? true;
                                        final displayName = data['displayName'] ?? churchId;
                                        final activeYearId = data['activeAcademicYearId'] ?? '';
                                        final gradesMap = data['grades'] as Map<String, dynamic>? ?? {};

                                        return DataRow(
                                          cells: [
                                            DataCell(
                                              Icon(
                                                active ? Icons.check_circle : Icons.cancel,
                                                color: active ? Colors.green : Colors.red,
                                              ),
                                            ),
                                            DataCell(Text(displayName, style: const TextStyle(fontWeight: FontWeight.bold))),
                                            // Dynamic StreamBuilder to resolve and Cache year displayName reactively
                                            DataCell(
                                              activeYearId.isEmpty
                                                  ? const Text('None')
                                                  : StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                                                      stream: _churchesRef.doc(churchId).collection('academicYears').doc(activeYearId).snapshots(),
                                                      builder: (context, yearSnap) {
                                                        if (!yearSnap.hasData) return Text(activeYearId);
                                                        final yName = yearSnap.data?.data()?['displayName'] ?? activeYearId;
                                                        
                                                        // Cache the name for filtering header
                                                        if (yName != activeYearId && _yearCache[activeYearId] != yName) {
                                                          _yearCache[activeYearId] = yName;
                                                          Future.microtask(() => setState(() {}));
                                                        }

                                                        return Text(yName);
                                                      },
                                                    ),
                                            ),
                                            DataCell(
                                              ActionChip(
                                                label: Text('${gradesMap.length} Grades'),
                                                backgroundColor: colorScheme.primaryContainer,
                                                onPressed: () => _showGradesDialog(context, churchId, gradesMap),
                                              ),
                                            ),
                                            DataCell(
                                              Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  IconButton(
                                                    icon: const Icon(Icons.edit_outlined),
                                                    onPressed: isGlobalAdmin ? () => _showEditChurchDialog(context, doc, user.uid) : null,
                                                  ),
                                                  IconButton(
                                                    icon: const Icon(Icons.delete_outline),
                                                    color: colorScheme.error,
                                                    onPressed: isGlobalAdmin ? () => _deleteChurch(context, doc) : null,
                                                  ),
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
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // --- ACTIONS: GRADES POPUP WITH UNIQUE SERVICE GROUP ASSIGNMENTS ---
  Future<void> _showGradesDialog(
    BuildContext context,
    String churchId,
    Map<String, dynamic> currentGrades,
  ) async {
    final firestore = FirebaseFirestore.instance;
    final groupsSnap = await firestore.collection('churches').doc(churchId).collection('serviceGroups').get();
    final groups = groupsSnap.docs;

    final List<Map<String, dynamic>> tempGrades = [];
    currentGrades.forEach((k, v) {
      if (v is Map) {
         tempGrades.add({
           'id': int.tryParse(k) ?? k,
           'name': v['name']?.toString() ?? '',
           'serviceGroupId': v['serviceGroupId']?.toString(),
         });
      }
    });

    tempGrades.sort((a, b) => (a['id'] as int).compareTo(b['id'] as int));

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          return AlertDialog(
            title: const Text('Configure Grades & Service Group Binding'),
            content: SizedBox(
              width: 700,
              height: 500,
              child: Column(
                children: [
                  Expanded(
                    child: tempGrades.isEmpty
                        ? const Center(child: Text('No grades configured. Click "+" to add.'))
                        : ListView.builder(
                            itemCount: tempGrades.length,
                            itemBuilder: (context, index) {
                              final item = tempGrades[index];
                              final gradeId = item['id'] as int;
                              final nameCtrl = TextEditingController(text: item['name']);
                              
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8.0),
                                child: Row(
                                  children: [
                                    CircleAvatar(child: Text('$gradeId')),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      flex: 2,
                                      child: TextField(
                                        controller: nameCtrl,
                                        decoration: const InputDecoration(labelText: 'Grade Name', border: OutlineInputBorder()),
                                        onChanged: (val) {
                                          item['name'] = val.trim();
                                        },
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      flex: 3,
                                      child: DropdownButtonFormField<String?>(
                                        value: item['serviceGroupId'],
                                        decoration: const InputDecoration(labelText: 'Service Group', border: OutlineInputBorder()),
                                        items: [
                                          const DropdownMenuItem<String?>(value: null, child: Text('Unassigned')),     
                                          ...groups.map((g) {
                                            return DropdownMenuItem<String?>(
                                              value: g.id,
                                              child: Text(g.data()['displayName'] ?? g.id),
                                            );
                                          }),
                                        ],
                                        onChanged: (val) {
                                          setModalState(() {
                                            item['serviceGroupId'] = val;
                                          });
                                        },
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline, color: Colors.red),
                                      onPressed: () {
                                        setModalState(() {
                                          tempGrades.removeAt(index);
                                          for (int i = 0; i < tempGrades.length; i++) {
                                            tempGrades[i]['id'] = i + 1;
                                          }
                                        });
                                      },
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () {
                          setModalState(() {
                            final nextId = tempGrades.length + 1;
                            tempGrades.add({
                              'id': nextId,
                              'name': 'Grade $nextId',
                              'serviceGroupId': null,
                            });
                          });
                        },
                        icon: const Icon(Icons.add),
                        label: const Text('Add New Grade'),
                      ),
                      FilledButton(
                        onPressed: () async {
                          final Map<String, dynamic> finalMap = {};
                          for (final g in tempGrades) {
                            finalMap[g['id'].toString()] = {
                              'name': g['name'],
                              'serviceGroupId': g['serviceGroupId'],
                            };
                          }
                          await _churchesRef.doc(churchId).update({'grades': finalMap});
                          Navigator.pop(context);
                          setState(() {});
                        },
                        child: const Text('Save Grades Map'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // --- ACTIONS: ADD CHURCH (MANDATES FIRST ACTIVE ACADEMIC YEAR) ---
  Future<void> _showAddChurchDialog(BuildContext context, String userUid) async {
    final nameCtrl = TextEditingController();
    final yearCtrl = TextEditingController(text: 'Academic Year 2026/2027');
    final formKey = GlobalKey<FormState>();

    DateTime selectedStartDate = DateTime.now();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Text('Wizard: Create Church Tenant'),
          content: SizedBox(
            width: 500,
            child: Form(
              key: formKey,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('1. General Church Profile', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(labelText: 'Church Name *', border: OutlineInputBorder()),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                    ),
                    const Divider(height: 32),
                    const Text('2. Map First Term (Mandatory)', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: yearCtrl,
                      decoration: const InputDecoration(labelText: 'Academic Year Label *', border: OutlineInputBorder()),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                    InkWell(
                      onTap: () async {
                        final dt = await showDatePicker(
                          context: context,
                          initialDate: DateTime.now(),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2035),
                        );
                        if (dt != null) setModalState(() => selectedStartDate = DateTime(dt.year, dt.month, 1));
                      },
                      child: InputDecorator(
                        decoration: const InputDecoration(labelText: 'Start Month & Year *', border: OutlineInputBorder()),
                        child: Text('${selectedStartDate.year} - ${selectedStartDate.month.toString().padLeft(2, '0')}'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                if (formKey.currentState!.validate()) Navigator.pop(context, true);
              },
              child: const Text('Create Church & Year'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      final newChurchId = 'CHC_${DateTime.now().millisecondsSinceEpoch}';
      final newYearId = 'AY_${DateTime.now().millisecondsSinceEpoch}';

      final churchRef = _churchesRef.doc(newChurchId);
      final yearRef = churchRef.collection('academicYears').doc(newYearId);

      batch.set(churchRef, {
        'displayName': nameCtrl.text.trim(),
        'active': true,
        'activeAcademicYearId': newYearId,
        'grades': <String, dynamic>{},
        'createdAt': FieldValue.serverTimestamp(),
        'createdBy': userUid,
      });

      batch.set(yearRef, {
        'displayName': yearCtrl.text.trim(),
        'startDate': Timestamp.fromDate(selectedStartDate),
        'active': true,
        'createdAt': FieldValue.serverTimestamp(),
        'createdBy': userUid,
      });

      await batch.commit();
      _showSnack('Church successfully onboarded!');
    }
  }

  // --- ACTIONS: EDIT CHURCH (WITH IN-PLACE TERM EDITING + YEAR ADD/DELETE) ---
  Future<void> _showEditChurchDialog(
    BuildContext context,
    DocumentSnapshot<Map<String, dynamic>> churchDoc,
    String userUid,
  ) async {
    final churchId = churchDoc.id;
    final nameCtrl = TextEditingController(text: churchDoc.data()?['displayName']);
    bool isActive = churchDoc.data()?['active'] ?? true;
    final formKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: _churchesRef.doc(churchId).snapshots(),
        builder: (context, churchSnapshot) {
          if (!churchSnapshot.hasData) return const Center(child: CircularProgressIndicator());
          final currentChurchData = churchSnapshot.data!.data() ?? {};
          final gradesMap = currentChurchData['grades'] as Map<String, dynamic>? ?? {};
          final activeYearId = currentChurchData['activeAcademicYearId'] ?? '';

          return StatefulBuilder(
            builder: (context, setModalState) {
              return AlertDialog(
                title: Text('Edit Church: $churchId'),
                content: SizedBox(
                  width: 650,
                  height: 600,
                  child: Form(
                    key: formKey,
                    autovalidateMode: AutovalidateMode.onUserInteraction,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextFormField(
                          controller: nameCtrl,
                          decoration: const InputDecoration(labelText: 'Church Name *', border: OutlineInputBorder()),
                          validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                        ),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Active Status'),
                          value: isActive,
                          onChanged: (val) => setModalState(() => isActive = val),
                        ),
                        const SizedBox(height: 8),
                        
                        // Interactive Grades configuration tile inside Edit Church Dialog
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.grade_outlined, color: Colors.indigo),
                          title: const Text('Configure Grades Map', style: TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('${gradesMap.length} Grades configured'),
                          trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                          onTap: () => _showGradesDialog(context, churchId, gradesMap),
                        ),
                        
                        const Divider(height: 32),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Academic Years Timeline', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            IconButton(
                              icon: const Icon(Icons.add_circle_outline, color: Colors.teal),
                              tooltip: 'Add Year',
                              onPressed: () => _showAddYearDialog(context, churchId, userUid),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Expanded(
                          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                            stream: _churchesRef.doc(churchId).collection('academicYears').snapshots(),
                            builder: (context, snap) {
                              if (!snap.hasData) return const Center(child: CircularProgressIndicator());
                              final years = snap.data!.docs;

                              return ListView.builder(
                                itemCount: years.length,
                                itemBuilder: (context, index) {
                                  final yrDoc = years[index];
                                  final yrData = yrDoc.data();
                                  final yrName = yrData['displayName'] ?? yrDoc.id;
                                  final yrActive = yrData['active'] ?? false;
                                  final yrStart = (yrData['startDate'] as Timestamp?)?.toDate();

                                  final isCurrentActive = yrDoc.id == activeYearId;

                                  return ListTile(
                                    dense: true,
                                    title: Text(yrName, style: const TextStyle(fontWeight: FontWeight.bold)),
                                    subtitle: Text('Start Month: ${yrStart?.year}-${yrStart?.month.toString().padLeft(2, '0')}'),
                                    trailing: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Switch(
                                          value: yrActive,
                                          onChanged: (val) async {
                                            await _setActiveYear(churchId, yrDoc.id);
                                          },
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.edit, size: 16),
                                          onPressed: () => _showEditYearInline(context, churchId, yrDoc),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.delete_outline, size: 16),
                                          color: isCurrentActive ? Colors.grey : Colors.red,
                                          onPressed: isCurrentActive 
                                              ? null 
                                              : () => _deleteYear(churchId, yrDoc.id, years.length),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                  FilledButton(
                    onPressed: () {
                      if (formKey.currentState!.validate()) Navigator.pop(context, true);
                    },
                    child: const Text('Save Changes'),
                  ),
                ],
              );
            },
          );
        },
      ),
    );

    if (confirmed == true) {
      await _churchesRef.doc(churchId).update({
        'displayName': nameCtrl.text.trim(),
        'active': isActive,
      });
      _showSnack('Church settings saved.');
    }
  }

  Future<void> _showAddYearDialog(BuildContext context, String churchId, String userUid) async {
    final yearCtrl = TextEditingController();
    DateTime selectedDate = DateTime.now();
    final formKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Text('Add Academic Year'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: yearCtrl,
                  decoration: const InputDecoration(labelText: 'Display Name *', border: OutlineInputBorder()),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: () async {
                    final dt = await showDatePicker(
                      context: context,
                      initialDate: selectedDate,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2035),
                    );
                    if (dt != null) setModalState(() => selectedDate = DateTime(dt.year, dt.month, 1));
                  },
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Start Month *', border: OutlineInputBorder()),
                    child: Text('${selectedDate.year} - ${selectedDate.month.toString().padLeft(2, '0')}'),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                if (formKey.currentState!.validate()) Navigator.pop(context, true);
              },
              child: const Text('Add'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      final yearId = 'AY_${DateTime.now().millisecondsSinceEpoch}';
      await _churchesRef.doc(churchId).collection('academicYears').doc(yearId).set({
        'displayName': yearCtrl.text.trim(),
        'startDate': Timestamp.fromDate(selectedDate),
        'active': false,
        'createdAt': FieldValue.serverTimestamp(),
        'createdBy': userUid,
      });
      _showSnack('Academic year added.');
    }
  }

  Future<void> _deleteYear(String churchId, String yearId, int totalYears) async {
    if (totalYears <= 1) {
      _showSnack('Cannot delete. A church must contain at least one Academic Year.');
      return;
    }

    // Referential integrity check: check if year is referenced in classes subcollection
    try {
      final classesSnap = await _churchesRef.doc(churchId).collection('classes').get();
      bool isReferenced = false;
      for (final doc in classesSnap.docs) {
        final yearsMap = doc.data()['academicYears'] as Map<String, dynamic>? ?? {};
        if (yearsMap.containsKey(yearId)) {
          isReferenced = true;
          break;
        }
      }

      if (isReferenced) {
        _showSnack('Cannot delete. This Academic Year is referenced inside active Class configurations.');
        return;
      }
    } catch (e) {
      _showSnack('Verification failed: $e');
      return;
    }

    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Academic Year?'),
            content: const Text('Are you sure you want to delete this year? This action is permanent.'),
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
      await _churchesRef.doc(churchId).collection('academicYears').doc(yearId).delete();
      _showSnack('Year deleted.');
    }
  }

  Future<void> _showEditYearInline(
    BuildContext context,
    String churchId,
    DocumentSnapshot<Map<String, dynamic>> yearDoc,
  ) async {
    final data = yearDoc.data()!;
    final dCtrl = TextEditingController(text: data['displayName']);
    DateTime selectedDate = (data['startDate'] as Timestamp).toDate();
    final formKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Text('Edit Term Inline'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: dCtrl,
                  decoration: const InputDecoration(labelText: 'Display Name *', border: OutlineInputBorder()),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: () async {
                    final dt = await showDatePicker(
                      context: context,
                      initialDate: selectedDate,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2035),
                    );
                    if (dt != null) setModalState(() => selectedDate = DateTime(dt.year, dt.month, 1));
                  },
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Start Month *', border: OutlineInputBorder()),
                    child: Text('${selectedDate.year} - ${selectedDate.month.toString().padLeft(2, '0')}'),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                if (formKey.currentState!.validate()) Navigator.pop(context, true);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      await _churchesRef.doc(churchId).collection('academicYears').doc(yearDoc.id).update({
        'displayName': dCtrl.text.trim(),
        'startDate': Timestamp.fromDate(selectedDate),
      });
    }
  }

  Future<void> _setActiveYear(String churchId, String yearId) async {
    try {
      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      batch.update(_churchesRef.doc(churchId), {
        'activeAcademicYearId': yearId,
      });

      final yearsSnap = await _churchesRef.doc(churchId).collection('academicYears').get();
      for (final doc in yearsSnap.docs) {
        batch.update(doc.reference, {
          'active': doc.id == yearId,
        });
      }

      await batch.commit();
    } catch (_) {}
  }

  Future<void> _deleteChurch(BuildContext context, DocumentSnapshot<Map<String, dynamic>> doc) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Church?'),
            content: Text('Are you sure you want to delete "${doc.id}"? This will delete the church tenant. This action is permanent.'),
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
      _showSnack('Church successfully deleted.');
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
