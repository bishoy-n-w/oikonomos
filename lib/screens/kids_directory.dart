// ignore_for_file: unnecessary_underscores, deprecated_member_use, use_build_context_synchronously
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:excel/excel.dart' hide Border;
import 'package:flutter/material.dart';
import '../widgets/phone_field.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';
import '../services/file_service.dart';
import '../services/auth_service.dart';

class KidsDirectoryScreen extends StatefulWidget {
  const KidsDirectoryScreen({
    required this.churchId,
    required this.academicYearId,
    required this.serviceGroupId,
    required this.classId,
    required this.userUid,
    required this.userRole,
    super.key,
  });

  final String churchId;
  final String academicYearId;
  final String serviceGroupId;
  final String classId;
  final String userUid;
  final String userRole;

  @override
  State<KidsDirectoryScreen> createState() => _KidsDirectoryScreenState();
}

class _KidsDirectoryScreenState extends State<KidsDirectoryScreen> {
  final Map<String, bool> _selectedRows = {};
  String _searchQuery = '';
  bool _selectAll = false;

  // Collapsible Column Groups states
  bool _showAssignments = true;
  bool _showGeneralInfo = true;
  bool _isAddressExpanded = false; // Collapsed/Folded by default as proposed!
  bool _isContactsExpanded = false; // Collapsed/Folded by default as proposed!
  bool _showNotes = true;

  final Map<String, String> _yearNames = {};
  final Map<String, String> _groupNames = {};
  final Map<String, String> _classNames = {};

  final CollectionReference<Map<String, dynamic>> _churchesRef =
      FirebaseFirestore.instance.collection('churches');

  CollectionReference<Map<String, dynamic>> get _ref =>
      _churchesRef.doc(widget.churchId).collection('kids');

  @override
  void initState() {
    super.initState();
    _fetchNames();
  }

  @override
  void didUpdateWidget(covariant KidsDirectoryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.churchId != widget.churchId) {
      _fetchNames();
    }
  }

  Future<void> _fetchNames() async {
    if (widget.churchId.isEmpty) return;
    try {
      final db = _churchesRef.doc(widget.churchId);
      final ySnap = await db.collection('academicYears').get();
      for (var d in ySnap.docs) {
        _yearNames[d.id] = d.data()['displayName'] ?? d.id;
      }

      final gSnap = await db.collection('serviceGroups').get();
      for (var d in gSnap.docs) {
        _groupNames[d.id] = d.data()['displayName'] ?? d.id;
      }

      final cSnap = await db.collection('classes').get();
      for (var d in cSnap.docs) {
        final years = d.data()['academicYears'] as Map<String, dynamic>? ?? {};
        if (years.isNotEmpty) {
          _classNames[d.id] = years.values.first['name'] ?? d.id;
        } else {
          _classNames[d.id] = d.id;
        }
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
    final user = AuthService.instance.currentUser;

    if (widget.churchId.isEmpty) {
      return Center(
        child: Text(AppTranslation.translate('church', lang)),
      );
    }

    final isAdmin = widget.userRole == 'Admin' || widget.userRole == 'owner';

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: _churchesRef.doc(widget.churchId).collection('serviceGroups').snapshots(),
      builder: (context, groupsSnapshot) {
        if (!groupsSnapshot.hasData) return const Center(child: CircularProgressIndicator());
        final groupDocs = groupsSnapshot.data!.docs;

        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: _churchesRef.doc(widget.churchId).collection('classes').snapshots(),
          builder: (context, classesSnapshot) {
            if (!classesSnapshot.hasData) return const Center(child: CircularProgressIndicator());
            final classDocs = classesSnapshot.data!.docs;

            return Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Title & Header Actions
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        AppTranslation.translate('kids', lang),
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 28),
                      ),
                      Row(
                        children: [
                          if (isAdmin) ...[
                            OutlinedButton.icon(
                              onPressed: () => _showImportWizard(context),
                              icon: const Icon(Icons.upload_file),
                              label: const Text('Import Excel / CSV'),
                            ),
                            const SizedBox(width: 12),
                          ],
                          FilledButton.icon(
                            onPressed: () => _showAddEditDialog(context, null, groupDocs, classDocs),
                            icon: const Icon(Icons.add),
                            label: Text(AppTranslation.translate('add', lang)),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // 2. Search Card Filter
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
                            child: TextField(
                              decoration: InputDecoration(
                                hintText: '${AppTranslation.translate('search', lang)}...',
                                border: InputBorder.none,
                                icon: const Icon(Icons.search),
                              ),
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
                  ),
                  const SizedBox(height: 16),

                  // 3. DataTable Grid
                  Expanded(
                    child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                      stream: _ref.where('active', isEqualTo: true).snapshots(),
                      builder: (context, snapshot) {
                        if (snapshot.hasError) return Center(child: Text('Error: ${snapshot.error}'));
                        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());

                        final docs = snapshot.data!.docs;

                        final filteredDocs = docs.where((doc) {
                          final data = doc.data();
                          final activeAssign = data['activeAssignment'] as Map<String, dynamic>? ?? {};

                          // View Scoping based on Global Cascading Filters
                          if (widget.academicYearId.isNotEmpty && activeAssign['academicYearId'] != widget.academicYearId) {
                            return false;
                          }
                          if (widget.serviceGroupId.isNotEmpty && activeAssign['serviceGroupId'] != widget.serviceGroupId) {
                            return false;
                          }
                          if (widget.classId.isNotEmpty && activeAssign['classId'] != widget.classId) {
                            return false;
                          }

                          final info = data['info'] ?? {};
                          final name = doc.id.toLowerCase();
                          final school = (info['school'] ?? '').toString().toLowerCase();
                          final addr = data['address'] as Map<String, dynamic>? ?? {};
                          final region = (addr['region'] ?? '').toString().toLowerCase();

                          final contacts = data['contacts'] as Map<String, dynamic>? ?? {};
                          final fatherMobile = (contacts['fatherMob'] ?? '').toString();
                          final motherMobile = (contacts['motherMob'] ?? '').toString();
                          final query = _searchQuery.toLowerCase().trim();

                          return name.contains(query) ||
                              school.contains(query) ||
                              region.contains(query) ||
                              fatherMobile.contains(query) ||
                              motherMobile.contains(query);
                        }).toList();

                        final selectedCount = _selectedRows.values.where((v) => v).length;

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (selectedCount > 0) ...[
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: colorScheme.secondaryContainer,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      '$selectedCount items selected',
                                      style: TextStyle(
                                        color: colorScheme.onSecondaryContainer,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    Row(
                                      children: [
                                        if (isAdmin) ...[
                                          FilledButton.tonalIcon(
                                            onPressed: () => _showBulkAssignDialog(
                                              filteredDocs.where((d) => _selectedRows[d.id] == true).toList(),
                                              groupDocs,
                                              classDocs,
                                            ),
                                            icon: const Icon(Icons.assignment_ind, size: 18),
                                            label: const Text('Bulk Assign'),
                                          ),
                                          const SizedBox(width: 8),
                                        ],
                                        OutlinedButton.icon(
                                          onPressed: () => _exportSelectedToCsv(filteredDocs),
                                          icon: const Icon(Icons.download, size: 18),
                                          label: const Text('Export CSV'),
                                        ),
                                        const SizedBox(width: 8),
                                        FilledButton.icon(
                                          onPressed: () => _deleteSelected(filteredDocs),
                                          icon: const Icon(Icons.delete, size: 18),
                                          label: const Text('Delete'),
                                          style: FilledButton.styleFrom(
                                            backgroundColor: colorScheme.error,
                                            foregroundColor: colorScheme.onError,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            Expanded(
                              child: filteredDocs.isEmpty
                                  ? const Center(child: Text('No students registered matching filters.'))
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
                                                dataRowMinHeight: 60,
                                                dataRowMaxHeight: 60,
                                                columns: [
                                                  DataColumn(
                                                    label: Checkbox(
                                                      value: _selectAll,
                                                      onChanged: (val) {
                                                        setState(() {
                                                          _selectAll = val ?? false;
                                                          for (final doc in filteredDocs) {
                                                            _selectedRows[doc.id] = _selectAll;
                                                          }
                                                        });
                                                      },
                                                    ),
                                                  ),
                                                  
                                                  // --- DYNAMIC FOLDABLE HEADERS ---
                                                  // Group 1: Assignment Toggler Header
                                                  DataColumn(
                                                    label: InkWell(
                                                      onTap: () => setState(() => _showAssignments = !_showAssignments),
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          Text(_showAssignments ? 'Active Term' : 'Assign (+)'),
                                                          const SizedBox(width: 4),
                                                          Icon(_showAssignments ? Icons.unfold_less : Icons.unfold_more, size: 14),
                                                        ],
                                                      ),
                                                    ),
                                                  ),
                                                  if (_showAssignments) ...[
                                                    const DataColumn(label: Text('Group')),
                                                    const DataColumn(label: Text('Class')),
                                                  ],

                                                  // Group 2: General Profile Toggler Header
                                                  DataColumn(
                                                    label: InkWell(
                                                      onTap: () => setState(() => _showGeneralInfo = !_showGeneralInfo),
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          Text(_showGeneralInfo ? 'Child Full Name' : 'Profile (+)'),
                                                          const SizedBox(width: 4),
                                                          Icon(_showGeneralInfo ? Icons.unfold_less : Icons.unfold_more, size: 14),
                                                        ],
                                                      ),
                                                    ),
                                                  ),
                                                  if (_showGeneralInfo) ...[
                                                    const DataColumn(label: Text('Gender')),
                                                    const DataColumn(label: Text('Date of Birth')),
                                                    const DataColumn(label: Text('School')),
                                                    const DataColumn(label: Text('Father of Confession')),
                                                  ],

                                                  // Group 3: Address Toggler Header
                                                  DataColumn(
                                                    label: InkWell(
                                                      onTap: () => setState(() => _isAddressExpanded = !_isAddressExpanded),
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          Text(_isAddressExpanded ? 'Street' : 'Address (+)'),
                                                          const SizedBox(width: 4),
                                                          Icon(_isAddressExpanded ? Icons.unfold_less : Icons.unfold_more, size: 14),
                                                        ],
                                                      ),
                                                    ),
                                                  ),
                                                  if (_isAddressExpanded) ...[
                                                    const DataColumn(label: Text('Building')),
                                                    const DataColumn(label: Text('Floor')),
                                                    const DataColumn(label: Text('Apartment')),
                                                    const DataColumn(label: Text('Region')),
                                                  ],

                                                  // Group 4: Contacts Toggler Header
                                                  DataColumn(
                                                    label: InkWell(
                                                      onTap: () => setState(() => _isContactsExpanded = !_isContactsExpanded),
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          Text(_isContactsExpanded ? 'Kid Mobile' : 'Contacts (+)'),
                                                          const SizedBox(width: 4),
                                                          Icon(_isContactsExpanded ? Icons.unfold_less : Icons.unfold_more, size: 14),
                                                        ],
                                                      ),
                                                    ),
                                                  ),
                                                  if (_isContactsExpanded) ...[
                                                    const DataColumn(label: Text('Father Name')),
                                                    const DataColumn(label: Text('Father Profession')),
                                                    const DataColumn(label: Text('Father Mobile')),
                                                    const DataColumn(label: Text('Mother Name')),
                                                    const DataColumn(label: Text('Mother Profession')),
                                                    const DataColumn(label: Text('Mother Mobile')),
                                                    const DataColumn(label: Text('Other Mobiles')),
                                                  ],

                                                  // Group 5: Notes Toggler Header
                                                  DataColumn(
                                                    label: InkWell(
                                                      onTap: () => setState(() => _showNotes = !_showNotes),
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          Text(_showNotes ? 'Pastoral Notes' : 'Notes (+)'),
                                                          const SizedBox(width: 4),
                                                          Icon(_showNotes ? Icons.unfold_less : Icons.unfold_more, size: 14),
                                                        ],
                                                      ),
                                                    ),
                                                  ),
                                                  const DataColumn(label: Text('Actions')),
                                                ],
                                                rows: filteredDocs.map((doc) {
                                                  final kidId = doc.id;
                                                  final data = doc.data();
                                                  
                                                  final activeAssign = data['activeAssignment'] as Map<String, dynamic>? ?? {};
                                                  final info = data['info'] as Map<String, dynamic>? ?? {};
                                                  final address = data['address'] as Map<String, dynamic>? ?? {};
                                                  final contacts = data['contacts'] as Map<String, dynamic>? ?? {};
                                                  final notes = data['notes']?.toString() ?? '';

                                                  final gender = info['gender'] ?? 'M';

                                                  // --- ROLE-BASED ACCESS EDIT CONTROL ---
                                                  // 1. Owner / Church Admins can edit
                                                  // 2. Group Admins of the kid's service group can edit
                                                  // 3. Teachers assigned inside the kid's specific active class can edit
                                                  bool hasEditAccess = isAdmin;

                                                  if (!hasEditAccess && user != null) {
                                                    // Resolve Group Admin status
                                                    final groupDoc = groupDocs.cast<QueryDocumentSnapshot<Map<String, dynamic>>?>().firstWhere(
                                                          (g) => g?.id == activeAssign['serviceGroupId'],
                                                          orElse: () => null,
                                                        );
                                                    final groupMisters = groupDoc?.data()['misters'] as Map<String, dynamic>? ?? {};
                                                    final userGroupRole = groupMisters[user.email];
                                                    if (userGroupRole == 'admin') {
                                                      hasEditAccess = true;
                                                    }

                                                    // Resolve Class Teacher status
                                                    if (!hasEditAccess) {
                                                      final classDoc = classDocs.cast<QueryDocumentSnapshot<Map<String, dynamic>>?>().firstWhere(
                                                            (c) => c?.id == activeAssign['classId'],
                                                            orElse: () => null,
                                                          );
                                                      final classYearsMap = classDoc?.data()['academicYears'] as Map<String, dynamic>? ?? {};
                                                      if (classYearsMap.containsKey(widget.academicYearId)) {
                                                        final classMisters = List<String>.from(classYearsMap[widget.academicYearId]['MistersIds'] ?? []);
                                                        if (classMisters.contains(user.email)) {
                                                          hasEditAccess = true;
                                                        }
                                                      }
                                                    }
                                                  }

                                                  return DataRow(
                                                    selected: _selectedRows[kidId] ?? false,
                                                    onSelectChanged: (val) {
                                                      setState(() {
                                                        _selectedRows[kidId] = val ?? false;
                                                      });
                                                    },
                                                    cells: [
                                                      DataCell(
                                                        Checkbox(
                                                          value: _selectedRows[kidId] ?? false,
                                                          onChanged: (val) {
                                                            setState(() {
                                                              _selectedRows[kidId] = val ?? false;
                                                            });
                                                          },
                                                        ),
                                                      ),
                                                      
                                                      // Dynamic Assignments Group cell
                                                      DataCell(
                                                        _showAssignments
                                                            ? Text(_yearNames[activeAssign['academicYearId']] ?? activeAssign['academicYearId']?.toString() ?? 'Unassigned')
                                                            : Text('${_yearNames[activeAssign['academicYearId']] ?? ""} • ${_groupNames[activeAssign['serviceGroupId']] ?? ""} • ${_classNames[activeAssign['classId']] ?? ""}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                                                      ),
                                                      if (_showAssignments) ...[
                                                        DataCell(Text(_groupNames[activeAssign['serviceGroupId']] ?? activeAssign['serviceGroupId']?.toString() ?? 'Unassigned')),
                                                        DataCell(Text(_classNames[activeAssign['classId']] ?? activeAssign['classId']?.toString() ?? 'Unassigned')),
                                                      ],

                                                      // Dynamic Info Group cell
                                                      DataCell(
                                                        _showGeneralInfo
                                                            ? InkWell(
                                                                onTap: () => _showStudentDetailsDialog(context, doc, groupDocs, classDocs),
                                                                child: Text(
                                                                  kidId,
                                                                  style: TextStyle(
                                                                    fontWeight: FontWeight.bold,
                                                                    color: colorScheme.primary,
                                                                    decoration: TextDecoration.underline,
                                                                  ),
                                                                ),
                                                              )
                                                            : Text(kidId, style: const TextStyle(fontWeight: FontWeight.bold)),
                                                      ),
                                                      if (_showGeneralInfo) ...[
                                                        DataCell(Text(gender)),
                                                        DataCell(Text(_formatTimestamp(info['dob']))),
                                                        DataCell(Text(info['school']?.toString() ?? '')),
                                                        DataCell(Text(info['fatherOfConfession']?.toString() ?? '')),
                                                      ],

                                                      // Dynamic Address Group cell
                                                      DataCell(
                                                        _isAddressExpanded
                                                            ? Text(address['street']?.toString() ?? '')
                                                            : Text(address['region']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                                                      ),
                                                      if (_isAddressExpanded) ...[
                                                        DataCell(Text(address['building']?.toString() ?? '')),
                                                        DataCell(Text(address['floor']?.toString() ?? '')),
                                                        DataCell(Text(address['apartment']?.toString() ?? '')),
                                                        DataCell(Text(address['region']?.toString() ?? '')),
                                                      ],

                                                      // Dynamic Contacts Group cell
                                                      DataCell(
                                                        _isContactsExpanded
                                                            ? Text(contacts['kidMob']?.toString() ?? '')
                                                            : Text('F: ${contacts['fatherMob'] ?? ""} • M: ${contacts['motherMob'] ?? ""}', style: const TextStyle(fontSize: 10)),
                                                      ),
                                                      if (_isContactsExpanded) ...[
                                                        DataCell(Text(contacts['fatherName']?.toString() ?? '')),
                                                        DataCell(Text(contacts['fatherProfession']?.toString() ?? '')),
                                                        DataCell(Text(contacts['fatherMob']?.toString() ?? '')),
                                                        DataCell(Text(contacts['motherName']?.toString() ?? '')),
                                                        DataCell(Text(contacts['motherProfession']?.toString() ?? '')),
                                                        DataCell(Text(contacts['motherMob']?.toString() ?? '')),
                                                        DataCell(Text((contacts['otherMob'] is List) ? (contacts['otherMob'] as List).join(' | ') : (contacts['otherMob']?.toString() ?? ''))),
                                                      ],

                                                      // Dynamic Notes Group cell
                                                      DataCell(
                                                        _showNotes
                                                            ? Text(notes)
                                                            : Text(notes.length > 15 ? '${notes.substring(0, 15)}...' : notes, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                                                      ),

                                                      DataCell(
                                                        Row(
                                                          mainAxisSize: MainAxisSize.min,
                                                          children: [
                                                            if (hasEditAccess) ...[
                                                              IconButton(
                                                                icon: const Icon(Icons.edit_outlined, size: 18),
                                                                onPressed: () => _showAddEditDialog(context, doc, groupDocs, classDocs),
                                                              ),
                                                              IconButton(
                                                                icon: const Icon(Icons.delete_outline, size: 18),
                                                                color: colorScheme.error,
                                                                onPressed: () => _deleteSingle(context, doc),
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
                                    ),
                            ),
                          ],
                        );
                      },
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

  String _formatTimestamp(dynamic val) {
    if (val is Timestamp) {
      final dt = val.toDate();
      return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
    }
    return '';
  }

  void _exportSelectedToCsv(List<DocumentSnapshot<Map<String, dynamic>>> docs) {
    try {
      final List<String> csvLines = [];
      csvLines.add('Full Name,Gender,DOB,School,Confession Father,Street,Building,Floor,Apt,Area/Region,Home Tel,Kid Mobile,Father Name,Father Mobile,Father Job,Mother Name,Mother Mobile,Mother Job,Other Mobiles,Notes');

      for (final doc in docs) {
        if (_selectedRows[doc.id] == true) {
          final data = doc.data()!;
          final info = data['info'] ?? {};
          final address = data['address'] ?? {};
          final contacts = data['contacts'] ?? {};

          String clean(dynamic val) {
            if (val == null) return '';
            final str = val.toString().replaceAll('"', '""').replaceAll('\n', ' ');
            return '"$str"';
          }

          String cleanPhone(dynamic val) {
            if (val == null || val.toString().isEmpty) return '';
            return '"\t$val"'; // Lead plus force escape
          }

          final row = [
            clean(doc.id),
            clean(info['gender']),
            clean(_formatTimestamp(info['dob'])),
            clean(info['school']),
            clean(info['fatherOfConfession']),
            clean(address['street']),
            clean(address['building']),
            clean(address['floor']),
            clean(address['apartment']),
            clean(address['region']),
            cleanPhone(contacts['homeTele']),
            cleanPhone(contacts['kidMob']),
            clean(contacts['fatherName']),
            cleanPhone(contacts['fatherMob']),
            clean(contacts['fatherProfession']),
            clean(contacts['motherName']),
            cleanPhone(contacts['motherMob']),
            clean(contacts['motherProfession']),
            clean(contacts['otherMob']),
            clean(data['notes']),
          ];

          csvLines.add(row.join(','));
        }
      }

      final csvContent = csvLines.join('\n');
      FileService.saveFile(
        content: csvContent,
        fileName: 'kids_export_${DateTime.now().millisecondsSinceEpoch}.csv',
      );
      _showSnack('Exported ${csvLines.length - 1} kids to CSV.');
    } catch (e) {
      _showSnack('Export failed: $e');
    }
  }

  Future<void> _deleteSingle(BuildContext context, DocumentSnapshot<Map<String, dynamic>> doc) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Student?'),
            content: Text('Are you sure you want to delete "${doc.id}"? This cannot be undone.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
              FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
            ],
          ),
        ) ??
        false;

    if (confirmed) {
      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      _queueClassAssignmentRemoval(batch: batch, kidId: doc.id, activeAssign: doc.data()?['activeAssignment'] as Map<String, dynamic>?);
      batch.delete(doc.reference);

      await batch.commit();
      setState(() {
        _selectedRows.remove(doc.id);
      });
      _showSnack('${doc.id} deleted successfully.');
    }
  }

  Future<void> _deleteSelected(List<DocumentSnapshot<Map<String, dynamic>>> docs) async {
    final count = _selectedRows.values.where((v) => v).length;
    if (count == 0) return;

    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: Text('Delete $count Students?'),
            content: const Text('Are you sure you want to delete these students? This cannot be undone.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
              FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete All')),
            ],
          ),
        ) ??
        false;

    if (confirmed) {
      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      for (final doc in docs) {
        if (_selectedRows[doc.id] == true) {
          _queueClassAssignmentRemoval(batch: batch, kidId: doc.id, activeAssign: doc.data()?['activeAssignment'] as Map<String, dynamic>?);
          batch.delete(doc.reference);
        }
      }

      await batch.commit();
      setState(() {
        _selectedRows.clear();
      });
      _showSnack('Deleted $count kids.');
    }
  }

  void _queueClassAssignmentRemoval({
    required WriteBatch batch,
    required String kidId,
    required Map<String, dynamic>? activeAssign,
  }) {
    if (activeAssign == null) return;
    final oldClassId = activeAssign['classId'];
    final oldYearId = activeAssign['academicYearId'];

    if (oldClassId != null && oldYearId != null) {
      final classesRef = _churchesRef.doc(widget.churchId).collection('classes');
      batch.update(classesRef.doc(oldClassId), {
        'academicYears.$oldYearId.KidIds': FieldValue.arrayRemove([kidId])
      });
    }
  }

  void _queueClassAssignmentUpdate({
    required WriteBatch batch,
    required String kidId,
    required Map<String, dynamic>? oldAssign,
    required String newYearId,
    required String newGroupId,
    required String newClassId,
  }) {
    final classesRef = _churchesRef.doc(widget.churchId).collection('classes');
    final oldClassId = oldAssign?['classId'];
    final oldYearId = oldAssign?['academicYearId'];

    if (oldClassId == newClassId && oldYearId == newYearId) return;

    if (oldClassId != null && oldYearId != null) {
      batch.update(classesRef.doc(oldClassId), {
        'academicYears.$oldYearId.KidIds': FieldValue.arrayRemove([kidId])
      });
    }

    batch.update(classesRef.doc(newClassId), {
      'academicYears.$newYearId.KidIds': FieldValue.arrayUnion([kidId])
    });

    batch.update(_ref.doc(kidId), {
      'activeAssignment': {
        'academicYearId': newYearId,
        'serviceGroupId': newGroupId,
        'classId': newClassId,
      }
    });
  }

  // --- ACTIONS: BULK ASSIGN ---
  Future<void> _showBulkAssignDialog(
    List<DocumentSnapshot<Map<String, dynamic>>> selectedDocs,
    List<QueryDocumentSnapshot<Map<String, dynamic>>> groups,
    List<QueryDocumentSnapshot<Map<String, dynamic>>> classes,
  ) async {
    if (selectedDocs.isEmpty) return;

    String? selYear;
    String? selGroup;
    String? selClass;

    final db = _churchesRef.doc(widget.churchId);
    final ySnap = await db.collection('academicYears').get();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          final availableClasses = classes.where((c) {
            final yearsMap = c.data()['academicYears'] as Map<String, dynamic>? ?? {};
            if (selYear != null && !yearsMap.containsKey(selYear)) return false;
            if (selYear != null && selGroup != null) {
              final yData = yearsMap[selYear] as Map<String, dynamic>;
              if (yData['serviceGroupId'] != selGroup) return false;
            }
            return true;
          }).toList();

          return AlertDialog(
            title: Text('Bulk Assign ${selectedDocs.length} Kids'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: selYear,
                  decoration: const InputDecoration(labelText: 'Academic Year *', border: OutlineInputBorder()),
                  items: ySnap.docs
                      .map((d) => DropdownMenuItem(value: d.id, child: Text(d.data()['displayName'] ?? d.id)))
                      .toList(),
                  onChanged: (v) => setModalState(() {
                    selYear = v;
                    selClass = null;
                  }),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selGroup,
                  decoration: const InputDecoration(labelText: 'Service Group *', border: OutlineInputBorder()),
                  items: groups
                      .map((d) => DropdownMenuItem(value: d.id, child: Text(d.data()['displayName'] ?? d.id)))
                      .toList(),
                  onChanged: (v) => setModalState(() {
                    selGroup = v;
                    selClass = null;
                  }),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selClass,
                  decoration: const InputDecoration(labelText: 'Class *', border: OutlineInputBorder()),
                  items: availableClasses.map((d) {
                    final yData = (d.data()['academicYears'] as Map<String, dynamic>? ?? {})[selYear] as Map<String, dynamic>? ?? {};
                    return DropdownMenuItem(value: d.id, child: Text(yData['name'] ?? d.id));
                  }).toList(),
                  onChanged: (v) => setModalState(() => selClass = v),
                ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
              FilledButton(
                onPressed: (selYear != null && selGroup != null && selClass != null)
                    ? () => Navigator.pop(context, true)
                    : null,
                child: const Text('Assign'),
              ),
            ],
          );
        },
      ),
    );

    if (confirmed == true) {
      final batch = FirebaseFirestore.instance.batch();
      for (final doc in selectedDocs) {
        _queueClassAssignmentUpdate(
          batch: batch,
          kidId: doc.id,
          oldAssign: doc.data()?['activeAssignment'] as Map<String, dynamic>?,
          newYearId: selYear!,
          newGroupId: selGroup!,
          newClassId: selClass!,
        );
      }
      await batch.commit();
      setState(() {
        _selectedRows.clear();
        _selectAll = false;
      });
      _showSnack('Bulk assignment successful!');
    }
  }

  // --- ACTIONS: ADD & EDIT PROFILE DIALOG (WITH E.164 AUTO-NORMALIZATIONS) ---
  Future<void> _showAddEditDialog(
    BuildContext context,
    DocumentSnapshot<Map<String, dynamic>>? doc,
    List<QueryDocumentSnapshot<Map<String, dynamic>>> groups,
    List<QueryDocumentSnapshot<Map<String, dynamic>>> classes,
  ) async {
    final isEdit = doc != null;
    final data = doc?.data();
    bool isActive = data?['active'] ?? true;
    final activeAssign = data?['activeAssignment'] as Map<String, dynamic>? ?? {};
    final info = data?['info'] as Map<String, dynamic>? ?? {};
    final address = data?['address'] as Map<String, dynamic>? ?? {};
    final contacts = data?['contacts'] as Map<String, dynamic>? ?? {};

    // Form controllers
    final nameController = TextEditingController(text: doc?.id);
    final schoolController = TextEditingController(text: info['school']);
    final confessionController = TextEditingController(text: info['fatherOfConfession']);

    // Address sub-controllers
    final streetController = TextEditingController(text: address['street']);
    final bldController = TextEditingController(text: address['building']);
    final flrController = TextEditingController(text: address['floor']);
    final aptController = TextEditingController(text: address['apartment']);
    final regionController = TextEditingController(text: address['region']);

    // Phone / Contacts sub-controllers
    final kidMobileController = TextEditingController(text: contacts['kidMob']);
    final fNameController = TextEditingController(text: contacts['fatherName']);
    final fMobileController = TextEditingController(text: contacts['fatherMob']);
    final fJobController = TextEditingController(text: contacts['fatherProfession']);
    final mNameController = TextEditingController(text: contacts['motherName']);
    final mMobileController = TextEditingController(text: contacts['motherMob']);
    final mJobController = TextEditingController(text: contacts['motherProfession']);
    final otherMobileController = TextEditingController(
        text: (contacts['otherMob'] is List) ? (contacts['otherMob'] as List).join(', ') : (contacts['otherMob']?.toString() ?? ''));

    final notesController = TextEditingController(text: data?['notes']);

    // State properties
    String selectedGender = info['gender'] ?? 'M';
    DateTime? selectedDob;
    final dobVal = info['dob'];
    if (dobVal is Timestamp) selectedDob = dobVal.toDate();

    final formKey = GlobalKey<FormState>();

    // Assignment selectors
    final db = _churchesRef.doc(widget.churchId);
    final ySnap = await db.collection('academicYears').get();

    String? selYear = activeAssign['academicYearId'] ?? (widget.academicYearId.isNotEmpty ? widget.academicYearId : null);
    String? selGroup = activeAssign['serviceGroupId'] ?? (widget.serviceGroupId.isNotEmpty ? widget.serviceGroupId : null);
    String? selClass = activeAssign['classId'] ?? (widget.classId.isNotEmpty ? widget.classId : null);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          final availableClasses = classes.where((c) {
            final yearsMap = c.data()['academicYears'] as Map<String, dynamic>? ?? {};
            if (selYear != null && !yearsMap.containsKey(selYear)) return false;
            if (selYear != null && selGroup != null) {
              final yData = yearsMap[selYear] as Map<String, dynamic>;
              if (yData['serviceGroupId'] != selGroup) return false;
            }
            return true;
          }).toList();

          return AlertDialog(
            title: Text(isEdit ? 'Edit CRM Profile' : 'Register New Child'),
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
                      // --- ASSIGNMENT SECTION (REQUIRED) ---
                      ExpansionTile(
                        initiallyExpanded: true,
                        title: const Text('Class Assignment (Required)',
                            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.teal)),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              children: [
                                DropdownButtonFormField<String>(
                                  value: selYear,
                                  decoration: const InputDecoration(labelText: 'Academic Year *', border: OutlineInputBorder()),
                                  items: ySnap.docs
                                      .map((d) => DropdownMenuItem(value: d.id, child: Text(d.data()['displayName'] ?? d.id)))
                                      .toList(),
                                  onChanged: (v) => setModalState(() {
                                    selYear = v;
                                    selClass = null;
                                  }),
                                  validator: (v) => v == null ? 'Required' : null,
                                ),
                                const SizedBox(height: 12),
                                DropdownButtonFormField<String>(
                                  value: selGroup,
                                  decoration: const InputDecoration(labelText: 'Service Group *', border: OutlineInputBorder()),
                                  items: groups
                                      .map((d) => DropdownMenuItem(value: d.id, child: Text(d.data()['displayName'] ?? d.id)))
                                      .toList(),
                                  onChanged: (v) => setModalState(() {
                                    selGroup = v;
                                    selClass = null;
                                  }),
                                  validator: (v) => v == null ? 'Required' : null,
                                ),
                                const SizedBox(height: 12),
                                DropdownButtonFormField<String>(
                                  value: selClass,
                                  decoration: const InputDecoration(labelText: 'Class *', border: OutlineInputBorder()),
                                  items: availableClasses.map((d) {
                                    final yData = (d.data()['academicYears'] as Map<String, dynamic>? ?? {})[selYear] as Map<String, dynamic>? ?? {};
                                    return DropdownMenuItem(value: d.id, child: Text(yData['name'] ?? d.id));
                                  }).toList(),
                                  onChanged: (v) => setModalState(() => selClass = v),
                                  validator: (v) => v == null ? 'Required' : null,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // --- SECTION 1: General Profile ---
                      ExpansionTile(
                        initiallyExpanded: true,
                        title: const Text('1. General Profile', style: TextStyle(fontWeight: FontWeight.bold)),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              children: [
                                TextFormField(
                                  controller: nameController,
                                  enabled: !isEdit,
                                  decoration: InputDecoration(
                                    labelText: 'Full Name *',
                                    border: const OutlineInputBorder(),
                                    filled: isEdit,
                                  ),
                                  validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Expanded(
                                      child: DropdownButtonFormField<String>(
                                        value: selectedGender,
                                        decoration: const InputDecoration(labelText: 'Gender', border: OutlineInputBorder()),
                                        items: const [
                                          DropdownMenuItem(value: 'M', child: Text('Male')),
                                          DropdownMenuItem(value: 'F', child: Text('Female')),
                                        ],
                                        onChanged: (v) {
                                          if (v != null) setModalState(() => selectedGender = v);
                                        },
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      flex: 2,
                                      child: InkWell(
                                        onTap: () async {
                                          final dt = await showDatePicker(
                                            context: context,
                                            initialDate: selectedDob ?? DateTime(2015),
                                            firstDate: DateTime(2000),
                                            lastDate: DateTime.now(),
                                          );
                                          if (dt != null) setModalState(() => selectedDob = dt);
                                        },
                                        child: InputDecorator(
                                          decoration: const InputDecoration(
                                            labelText: 'Date of Birth',
                                            border: OutlineInputBorder(),
                                          ),
                                          child: Text(selectedDob != null
                                              ? '${selectedDob!.year}-${selectedDob!.month.toString().padLeft(2, '0')}-${selectedDob!.day.toString().padLeft(2, '0')}'
                                              : 'Select date'),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: schoolController,
                                  decoration: const InputDecoration(labelText: 'School Details', border: OutlineInputBorder()),
                                ),
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: confessionController,
                                  decoration: const InputDecoration(labelText: 'Father of Confession', border: OutlineInputBorder()),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),

                      // --- SECTION 2: Home Address ---
                      ExpansionTile(
                        title: const Text('2. Home Address Details', style: TextStyle(fontWeight: FontWeight.bold)),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      flex: 3,
                                      child: TextFormField(
                                        controller: streetController,
                                        decoration: const InputDecoration(
                                          labelText: 'Street Name',
                                          border: OutlineInputBorder(),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: TextFormField(
                                        controller: bldController,
                                        decoration: const InputDecoration(
                                          labelText: 'Building',
                                          border: OutlineInputBorder(),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Expanded(
                                      child: TextFormField(
                                        controller: flrController,
                                        decoration: const InputDecoration(
                                          labelText: 'Floor No',
                                          border: OutlineInputBorder(),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: TextFormField(
                                        controller: aptController,
                                        decoration: const InputDecoration(
                                          labelText: 'Apt No',
                                          border: OutlineInputBorder(),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: regionController,
                                  decoration: const InputDecoration(labelText: 'Area / Region', border: OutlineInputBorder()),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),

                      // --- SECTION 3: Family Contacts (E.164 Locked fields) ---
                      ExpansionTile(
                        title: const Text('3. Family Contacts', style: TextStyle(fontWeight: FontWeight.bold)),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: OikonomosPhoneField(
                                        labelText: 'Kid Mobile',
                                        initialValue: kidMobileController.text,
                                        onChanged: (val) => kidMobileController.text = val,
                                      ),
                                    ),
                                  ],
                                ),
                                const Divider(height: 32),
                                TextFormField(
                                  controller: fNameController,
                                  decoration: const InputDecoration(labelText: 'Father Full Name', border: OutlineInputBorder()),
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Expanded(
                                      child: OikonomosPhoneField(
                                        labelText: 'Father Mobile',
                                        initialValue: fMobileController.text,
                                        onChanged: (val) => fMobileController.text = val,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: TextFormField(
                                        controller: fJobController,
                                        decoration: const InputDecoration(labelText: 'Father Profession', border: OutlineInputBorder()),
                                      ),
                                    ),
                                  ],
                                ),
                                const Divider(height: 32),
                                TextFormField(
                                  controller: mNameController,
                                  decoration: const InputDecoration(labelText: 'Mother Full Name', border: OutlineInputBorder()),
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Expanded(
                                      child: OikonomosPhoneField(
                                        labelText: 'Mother Mobile',
                                        initialValue: mMobileController.text,
                                        onChanged: (val) => mMobileController.text = val,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: TextFormField(
                                        controller: mJobController,
                                        decoration: const InputDecoration(labelText: 'Mother Profession', border: OutlineInputBorder()),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: otherMobileController,
                                  decoration: const InputDecoration(
                                    labelText: 'Other Contact Numbers',
                                    hintText: 'Comma separated...',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),

                      // --- SECTION 4: Pastoral Notes ---
                      ExpansionTile(
                        title: const Text('4. Pastoral Notes', style: TextStyle(fontWeight: FontWeight.bold)),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: TextFormField(
                              controller: notesController,
                              decoration: const InputDecoration(
                                labelText: 'Special conditions, warnings, or notes',
                                border: OutlineInputBorder(),
                              ),
                              maxLines: 4,
                            ),
                          ),
                        ],
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
                child: const Text('Save Profile'),
              ),
            ],
          );
        },
      ),
    );

    if (confirmed == true) {
      final name = nameController.text.trim();
      final user = AuthService.instance.currentUser?.uid ?? 'unknown';

      final infoMap = {
        'fullName': name,
        'gender': selectedGender,
        'dob': selectedDob != null ? Timestamp.fromDate(selectedDob!.toUtc()) : null,
        'school': schoolController.text.trim(),
        'fatherOfConfession': confessionController.text.trim(),
      };

      final addressMap = {
        'street': streetController.text.trim(),
        'building': bldController.text.trim(),
        'floor': flrController.text.trim(),
        'apartment': aptController.text.trim(),
        'region': regionController.text.trim(),
      };

      // Ensure E.164 locked phone number entries are cleanly saved
      final contactsMap = {
        'kidMob': kidMobileController.text.trim(),
        'fatherName': fNameController.text.trim(),
        'fatherMob': fMobileController.text.trim(),
        'fatherProfession': fJobController.text.trim(),
        'motherName': mNameController.text.trim(),
        'motherMob': mMobileController.text.trim(),
        'motherProfession': mJobController.text.trim(),
        'otherMob': otherMobileController.text.trim(),
      };

      try {
        final firestore = FirebaseFirestore.instance;
        final batch = firestore.batch();

        _queueClassAssignmentUpdate(
          batch: batch,
          kidId: name,
          oldAssign: activeAssign,
          newYearId: selYear!,
          newGroupId: selGroup!,
          newClassId: selClass!,
        );

        // Map versions log transactionally
        final Map<String, dynamic> versionsLog = Map<String, dynamic>.from(data?['versions'] ?? {});
        if (isEdit) {
          final String nextVerId = 'v_${DateTime.now().millisecondsSinceEpoch}';
          final Map<String, dynamic> changes = {};

          // Simple differential logger
          final oldInfo = data?['info'] as Map<String, dynamic>? ?? {};
          final oldAddr = data?['address'] as Map<String, dynamic>? ?? {};
          final oldContacts = data?['contacts'] as Map<String, dynamic>? ?? {};

          if (oldInfo['fatherOfConfession'] != infoMap['fatherOfConfession']) {
            changes['info.fatherOfConfession'] = '${infoMap['fatherOfConfession']} (was ${oldInfo['fatherOfConfession']})';
          }
          if (oldAddr['region'] != addressMap['region']) {
            changes['address.region'] = '${addressMap['region']} (was ${oldAddr['region']})';
          }
          if (oldContacts['fatherMob'] != contactsMap['fatherMob']) {
            changes['contacts.fatherMob'] = '${contactsMap['fatherMob']} (was ${oldContacts['fatherMob']})';
          }

          if (changes.isNotEmpty) {
            versionsLog[nextVerId] = {
              'changes': changes,
              'editAt': FieldValue.serverTimestamp(),
              'editBy': AuthService.instance.currentUser?.email ?? 'unknown',
            };
          }
        }

        final Map<String, dynamic> payload = {
          'active': isActive,
          'info': infoMap,
          'address': addressMap,
          'contacts': contactsMap,
          'notes': notesController.text.trim(),
          'versions': versionsLog,
          'lastEditAt': FieldValue.serverTimestamp(),
          'lastEditBy': user,
        };

        if (!isEdit) {
          final existing = await _ref.doc(name).get();
          if (existing.exists) {
            _showSnack('A child with this full name is already registered!');
            return;
          }

          payload['createdAt'] = FieldValue.serverTimestamp() as Object;
          payload['createdBy'] = user;

          batch.set(_ref.doc(name), payload);
        } else {
          payload['createdAt'] = data?['createdAt'];
          payload['createdBy'] = data?['createdBy'] ?? 'system';

          batch.set(_ref.doc(name), payload, SetOptions(merge: true));
        }

        await batch.commit();
        if (mounted) setState(() {});
        _showSnack('Profile successfully saved.');
      } catch (e) {
        _showSnack('Save failed: $e');
      }
    }
  }

  // --- ACTIONS: EXCEL / CSV IMPORT ROSTER LOADER (WITH E.164 AUTO-NORMALIZATIONS) ---
  Future<void> _showImportWizard(BuildContext context) async {
    FileService.pickFile(
      allowedExtensions: '.xlsx,.xls,.csv',
      onPicked: (AppFile file) async {
        try {
          if (file.name.endsWith('.csv')) {
            final text = await file.readAsString();
            _startCsvMappingWizard(file.name, text);
          } else {
            final bytes = await file.readAsBytes();
            final excel = Excel.decodeBytes(bytes);
            _startExcelSheetSelector(file.name, excel);
          }
        } catch (e) {
          _showSnack('Failed to parse file: $e');
        }
      },
      onError: (err) => _showSnack(err),
    );
  }

  Future<void> _startExcelSheetSelector(String fileName, Excel excel) async {
    final sheets = excel.tables.keys.toList();
    if (sheets.isEmpty) {
      _showSnack('Excel file has no sheets.');
      return;
    }

    if (sheets.length == 1) {
      _startExcelMappingWizard(fileName, excel.tables[sheets.first]!.rows);
      return;
    }

    String selectedSheet = sheets.first;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: Text('Select Sheet: $fileName'),
          content: DropdownButton<String>(
            value: selectedSheet,
            isExpanded: true,
            items: sheets.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
            onChanged: (val) {
              if (val != null) setModalState(() => selectedSheet = val);
            },
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Next')),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      final sheet = excel.tables[selectedSheet]!;
      _startExcelMappingWizard(fileName, sheet.rows);
    }
  }

  void _startExcelMappingWizard(String fileName, List<List<Data?>> excelRows) {
    if (excelRows.isEmpty) {
      _showSnack('Selected sheet is empty.');
      return;
    }
    final rows = excelRows.map((row) {
      return row.map((cell) => cell?.value?.toString() ?? '').toList();
    }).toList();

    _launchMappingWizard(fileName, rows);
  }

  void _startCsvMappingWizard(String fileName, String csvContent) {
    final List<List<String>> rows = [];
    final lines = const LineSplitter().convert(csvContent);

    for (final line in lines) {
      if (line.trim().isEmpty) continue;
      final cols = line.split(',');
      rows.add(cols);
    }

    _launchMappingWizard(fileName, rows);
  }

  Future<void> _launchMappingWizard(String fileName, List<List<String>> rows) async {
    int headerRowIndex = 0;

    final db = _churchesRef.doc(widget.churchId);
    final ySnap = await db.collection('academicYears').get();
    final gSnap = await db.collection('serviceGroups').get();
    final cSnap = await db.collection('classes').where('active', isEqualTo: true).get();

    String? selYear = widget.academicYearId.isNotEmpty ? widget.academicYearId : null;
    String? selGroup = widget.serviceGroupId.isNotEmpty ? widget.serviceGroupId : null;
    String? selClass = widget.classId.isNotEmpty ? widget.classId : null;
    final formKey = GlobalKey<FormState>();

    List<String> getHeaders(int idx) {
      if (idx < 0 || idx >= rows.length) return [];
      return rows[idx];
    }

    final Map<String, int?> fieldMappings = {
      'fullName': null,
      'gender': null,
      'dob': null,
      'school': null,
      'fatherOfConfession': null,
      'addressStreet': null,
      'addressBuilding': null,
      'addressFloor': null,
      'addressApartment': null,
      'addressRegion': null,
      'kidMob': null,
      'fatherName': null,
      'fatherMob': null,
      'fatherProfession': null,
      'motherName': null,
      'motherMob': null,
      'motherProfession': null,
    };

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          final headers = getHeaders(headerRowIndex);
          final availableClasses = cSnap.docs.where((c) {
            final yearsMap = c.data()['academicYears'] as Map<String, dynamic>? ?? {};
            if (selYear != null && !yearsMap.containsKey(selYear)) return false;
            if (selYear != null && selGroup != null) {
              final yData = yearsMap[selYear] as Map<String, dynamic>;
              if (yData['serviceGroupId'] != selGroup) return false;
            }
            return true;
          }).toList();

          return AlertDialog(
            title: Text('Import Wizard: $fileName'),
            content: SizedBox(
              width: 800,
              height: 600,
              child: Form(
                key: formKey,
                autovalidateMode: AutovalidateMode.onUserInteraction,
                child: Column(
                  children: [
                    const Text('1. Map Incoming Students to a Target Class', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: selYear,
                            decoration: const InputDecoration(labelText: 'Academic Year *', border: OutlineInputBorder(), isDense: true),
                            items: ySnap.docs
                                .map((d) => DropdownMenuItem(value: d.id, child: Text(d.data()['displayName'] ?? d.id)))
                                .toList(),
                            onChanged: (v) => setModalState(() {
                              selYear = v;
                              selClass = null;
                            }),
                            validator: (v) => v == null ? 'Required' : null,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: selGroup,
                            decoration: const InputDecoration(labelText: 'Service Group *', border: OutlineInputBorder(), isDense: true),
                            items: gSnap.docs
                                .map((d) => DropdownMenuItem(value: d.id, child: Text(d.data()['displayName'] ?? d.id)))
                                .toList(),
                            onChanged: (v) => setModalState(() {
                              selGroup = v;
                              selClass = null;
                            }),
                            validator: (v) => v == null ? 'Required' : null,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: selClass,
                            decoration: const InputDecoration(labelText: 'Target Class *', border: OutlineInputBorder(), isDense: true),
                            items: availableClasses.map((d) {
                              final yData = (d.data()['academicYears'] as Map<String, dynamic>? ?? {})[selYear] as Map<String, dynamic>? ?? {};
                              return DropdownMenuItem(value: d.id, child: Text(yData['name'] ?? d.id));
                            }).toList(),
                            onChanged: (v) => setModalState(() => selClass = v),
                            validator: (v) => v == null ? 'Required' : null,
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 32),
                    const Text('2. Map Spreadsheet Headers', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Text('Data Headers are on Row: '),
                        const SizedBox(width: 16),
                        DropdownButton<int>(
                          value: headerRowIndex,
                          items: List.generate(
                            rows.length > 5 ? 5 : rows.length,
                            (index) => DropdownMenuItem(
                              value: index,
                              child: Text('Row ${index + 1} (${getHeaders(index).firstOrNull ?? "Empty"})'),
                            ),
                          ),
                          onChanged: (val) {
                            if (val != null) {
                              setModalState(() {
                                headerRowIndex = val;
                                fieldMappings.updateAll((key, value) => null);
                              });
                            }
                          },
                        ),
                      ],
                    ),
                    const Divider(),
                    Expanded(
                      child: ListView(
                        children: fieldMappings.keys.map((dbField) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4.0),
                            child: Row(
                              children: [
                                Expanded(
                                  flex: 2,
                                  child: Text(
                                    '$dbField ${dbField == 'fullName' ? ' *' : ''}',
                                    style: TextStyle(fontWeight: dbField == 'fullName' ? FontWeight.bold : FontWeight.normal),
                                  ),
                                ),
                                const Icon(Icons.arrow_forward),
                                const SizedBox(width: 16),
                                Expanded(
                                  flex: 3,
                                  child: DropdownButtonFormField<int?>(
                                    decoration: const InputDecoration(
                                      border: OutlineInputBorder(),
                                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                                    ),
                                    value: fieldMappings[dbField],
                                    hint: const Text('Ignore / Skip'),
                                    items: [
                                      const DropdownMenuItem<int?>(value: null, child: Text('-- Skip --')),
                                      ...List.generate(headers.length, (idx) {
                                        return DropdownMenuItem<int?>(value: idx, child: Text(headers[idx].trim()));
                                      }),
                                    ],
                                    onChanged: (val) {
                                      setModalState(() => fieldMappings[dbField] = val);
                                    },
                                    validator: (val) => dbField == 'fullName' && val == null ? 'Full Name mapping is mandatory.' : null,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
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
                child: const Text('Execute Import'),
              ),
            ],
          );
        },
      ),
    );

    if (confirmed == true) {
      _executeDataImport(rows.sublist(headerRowIndex + 1), fieldMappings, selYear!, selGroup!, selClass!);
    }
  }

  // --- ACTIONS: EXCEL / CSV IMPORT PARSING ROSTER (WITH SMART E.164 DEFAULTING MATCHERS) ---
  Future<void> _executeDataImport(
    List<List<String>> dataRows,
    Map<String, int?> fieldMappings,
    String targetYearId,
    String targetGroupId,
    String targetClassId,
  ) async {
    final firestore = FirebaseFirestore.instance;
    int successCount = 0;

    WriteBatch batch = firestore.batch();
    int ops = 0;

    for (final row in dataRows) {
      if (row.isEmpty) continue;

      final nameIdx = fieldMappings['fullName'];
      if (nameIdx == null || nameIdx >= row.length) continue;

      final name = row[nameIdx].trim();
      if (name.isEmpty) continue;

      String getMapped(String field) {
        final idx = fieldMappings[field];
        if (idx == null || idx >= row.length) return '';
        return row[idx].trim();
      }

      // --- SMART E.164 PHONES NORMALIZATION ALGORITHM ---
      String resolveAndNormalizeE164(String input) {
        String num = input.replaceAll(RegExp(r'\D'), ''); // Strip non-digits
        if (num.isEmpty) return '';
        if (num.startsWith('0')) num = num.substring(1); // Strip leading zero

        // 1. If length matches Egypt mobile formatting lengths (10 digits) with proper mobile prefixes, prepend Egypt +20
        if (num.length == 10 &&
            (num.startsWith('10') || num.startsWith('11') || num.startsWith('12') || num.startsWith('15'))) {
          return '+20$num';
        }
        // 2. If it is any other standard 10 digit length, default prepend USA +1
        if (num.length == 10) {
          return '+1$num';
        }
        // 3. Otherwise default safely prefixing Egypt dial code
        return '+20$num';
      }

      final fMobileRaw = getMapped('fatherMob');
      final mMobileRaw = getMapped('motherMob');
      final kidMobileRaw = getMapped('kidMob');

      final infoMap = {
        'fullName': name,
        'gender': getMapped('gender').isEmpty ? 'M' : getMapped('gender'),
        'dob': null,
        'school': getMapped('school'),
        'fatherOfConfession': getMapped('fatherOfConfession'),
      };

      final addressMap = {
        'street': getMapped('addressStreet'),
        'building': getMapped('addressBuilding'),
        'floor': getMapped('addressFloor'),
        'apartment': getMapped('addressApartment'),
        'region': getMapped('addressRegion'),
      };

      final contactsMap = {
        'kidMob': resolveAndNormalizeE164(kidMobileRaw),
        'fatherName': getMapped('fatherName'),
        'fatherMob': resolveAndNormalizeE164(fMobileRaw),
        'fatherProfession': getMapped('fatherProfession'),
        'motherName': getMapped('motherName'),
        'motherMob': resolveAndNormalizeE164(mMobileRaw),
        'motherProfession': getMapped('motherProfession'),
        'otherMob': '',
      };

      final activeAssign = {
        'academicYearId': targetYearId,
        'serviceGroupId': targetGroupId,
        'classId': targetClassId,
      };

      final docRef = _ref.doc(name);

      batch.set(
          docRef,
          {
            'active': true,
            'info': infoMap,
            'address': addressMap,
            'contacts': contactsMap,
            'activeAssignment': activeAssign,
            'notes': 'Imported via bulk upload.',
            'versions': {},
            'createdAt': FieldValue.serverTimestamp(),
            'createdBy': AuthService.instance.currentUser?.uid ?? 'unknown',
          },
          SetOptions(merge: true));

      final classesRef = _churchesRef.doc(widget.churchId).collection('classes');
      batch.update(classesRef.doc(targetClassId), {
        'academicYears.$targetYearId.KidIds': FieldValue.arrayUnion([name])
      });

      ops += 2;
      successCount++;

      if (ops > 450) {
        await batch.commit();
        batch = firestore.batch();
        ops = 0;
      }
    }

    if (ops > 0) {
      await batch.commit();
    }

    if (mounted) setState(() {});
    _showSnack('Import Complete: $successCount kids registered successfully.');
  }

  // --- ACTIONS: STUDENT DETAILED VIEW CARD ---
  Future<void> _showStudentDetailsDialog(
    BuildContext context,
    DocumentSnapshot<Map<String, dynamic>> doc,
    List<QueryDocumentSnapshot<Map<String, dynamic>>> groups,
    List<QueryDocumentSnapshot<Map<String, dynamic>>> classes,
  ) async {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final data = doc.data() ?? {};
    final activeAssign = data['activeAssignment'] as Map<String, dynamic>? ?? {};
    final info = data['info'] as Map<String, dynamic>? ?? {};
    final address = data['address'] as Map<String, dynamic>? ?? {};
    final contacts = data['contacts'] as Map<String, dynamic>? ?? {};
    
    final name = doc.id;
    final gender = info['gender'] ?? 'M';
    final school = info['school'] ?? 'N/A';
    final confession = info['fatherOfConfession'] ?? 'N/A';

    final street = address['street'] ?? '';
    final bld = address['building'] ?? '';
    final flr = address['floor'] ?? '';
    final apt = address['apartment'] ?? '';
    final region = address['region'] ?? '';

    final homeTel = contacts['homeTele'] ?? 'N/A';
    final kidMobile = contacts['kidMob'] ?? 'N/A';
    final fatherName = contacts['fatherName'] ?? 'N/A';
    final fMobile = contacts['fatherMob'] ?? 'N/A';
    final fatherJob = contacts['fatherProfession'] ?? 'N/A';
    final motherName = contacts['motherName'] ?? 'N/A';
    final mMobile = contacts['motherMob'] ?? 'N/A';
    final motherJob = contacts['motherProfession'] ?? 'N/A';
    final otherMob = contacts['otherMob'] ?? 'N/A';

    final notes = data['notes'] ?? '';

    final dobVal = info['dob'];
    String dobStr = 'N/A';
    if (dobVal is Timestamp) {
      final dob = dobVal.toDate();
      dobStr = '${dob.year}-${dob.month.toString().padLeft(2, '0')}-${dob.day.toString().padLeft(2, '0')}';
    }

    final isAdmin = widget.userRole == 'Admin' || widget.userRole == 'owner';
    final user = AuthService.instance.currentUser;
    bool hasEditAccess = isAdmin;

    if (!hasEditAccess && user != null) {
      final groupDoc = groups.cast<QueryDocumentSnapshot<Map<String, dynamic>>?>().firstWhere(
            (g) => g?.id == activeAssign['serviceGroupId'],
            orElse: () => null,
          );
      final groupMisters = groupDoc?.data()['misters'] as Map<String, dynamic>? ?? {};
      final userGroupRole = groupMisters[user.email];
      if (userGroupRole == 'admin') {
        hasEditAccess = true;
      }

      if (!hasEditAccess) {
        final classDoc = classes.cast<QueryDocumentSnapshot<Map<String, dynamic>>?>().firstWhere(
              (c) => c?.id == activeAssign['classId'],
              orElse: () => null,
            );
        final classYearsMap = classDoc?.data()['academicYears'] as Map<String, dynamic>? ?? {};
        if (classYearsMap.containsKey(widget.academicYearId)) {
          final classMisters = List<String>.from(classYearsMap[widget.academicYearId]['MistersIds'] ?? []);
          if (classMisters.contains(user.email)) {
            hasEditAccess = true;
          }
        }
      }
    }

    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: gender == 'F' ? Colors.pink.shade50 : Colors.blue.shade50,
              child: Icon(gender == 'F' ? Icons.girl : Icons.boy, color: gender == 'F' ? Colors.pink : Colors.blue),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(name, style: const TextStyle(fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
        content: SizedBox(
          width: 500,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildDetailSection(
                  title: 'Active Assignment',
                  icon: Icons.bookmark_outline,
                  colorScheme: colorScheme,
                  children: [
                    _buildDetailRow('Academic Year', _yearNames[activeAssign['academicYearId']] ?? activeAssign['academicYearId']?.toString() ?? 'Unassigned'),
                    _buildDetailRow('Service Group', _groupNames[activeAssign['serviceGroupId']] ?? activeAssign['serviceGroupId']?.toString() ?? 'Unassigned'),
                    _buildDetailRow('Class Group', _classNames[activeAssign['classId']] ?? activeAssign['classId']?.toString() ?? 'Unassigned'),
                  ],
                ),
                const SizedBox(height: 12),
                _buildDetailSection(
                  title: 'General Profile',
                  icon: Icons.person_outline,
                  colorScheme: colorScheme,
                  children: [
                    _buildDetailRow('Gender', gender == 'M' ? 'Male' : 'Female'),
                    _buildDetailRow('Date of Birth', dobStr),
                    _buildDetailRow('School', school),
                    _buildDetailRow('Confession Father', confession),
                  ],
                ),
                const SizedBox(height: 12),
                _buildDetailSection(
                  title: 'Home Address',
                  icon: Icons.home_outlined,
                  colorScheme: colorScheme,
                  children: [
                    _buildDetailRow('Street', street.isEmpty ? 'N/A' : street),
                    _buildDetailRow('Building', bld.isEmpty ? 'N/A' : bld),
                    _buildDetailRow('Floor', flr.isEmpty ? 'N/A' : flr),
                    _buildDetailRow('Apartment', apt.isEmpty ? 'N/A' : apt),
                    _buildDetailRow('Area/Region', region.isEmpty ? 'N/A' : region),
                  ],
                ),
                const SizedBox(height: 12),
                _buildDetailSection(
                  title: 'Family Contacts',
                  icon: Icons.contact_phone_outlined,
                  colorScheme: colorScheme,
                  children: [
                    _buildDetailRow('Home Landline', homeTel),
                    _buildDetailRow('Kid Mobile', kidMobile),
                    const Divider(height: 20),
                    _buildDetailRow('Father Name', fatherName),
                    _buildDetailRow('Father Mobile', fMobile),
                    _buildDetailRow('Father Profession', fatherJob),
                    const Divider(height: 20),
                    _buildDetailRow('Mother Name', motherName),
                    _buildDetailRow('Mother Mobile', mMobile),
                    _buildDetailRow('Mother Profession', motherJob),
                    _buildDetailRow('Other Mobiles', otherMob),
                  ],
                ),
                const SizedBox(height: 12),
                _buildDetailSection(
                  title: 'Pastoral Notes',
                  icon: Icons.notes_outlined,
                  colorScheme: colorScheme,
                  children: [
                    Text(notes.isEmpty ? 'N/A' : notes, style: theme.textTheme.bodyMedium),
                  ],
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
          if (hasEditAccess)
            FilledButton.icon(
              onPressed: () {
                Navigator.pop(context); // Close details
                _showAddEditDialog(context, doc, groups, classes); // Open edit dialog immediately!
              },
              icon: const Icon(Icons.edit_outlined, size: 16),
              label: const Text('Edit Profile'),
            ),
        ],
      ),
    );
  }

  Widget _buildDetailSection({
    required String title,
    required IconData icon,
    required ColorScheme colorScheme,
    required List<Widget> children,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withOpacity(0.3),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: colorScheme.primary),
                const SizedBox(width: 8),
                Text(title, style: TextStyle(fontWeight: FontWeight.bold, color: colorScheme.primary)),
              ],
            ),
            const Divider(),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(label, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13, color: Colors.grey)),
          ),
          Expanded(
            flex: 3,
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          ),
        ],
      ),
    );
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
