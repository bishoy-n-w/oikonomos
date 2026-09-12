// ignore_for_file: unnecessary_underscores, deprecated_member_use, use_build_context_synchronously
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';
import '../services/auth_service.dart';

class ServiceGroupsScreen extends StatefulWidget {
  const ServiceGroupsScreen({
    required this.churchId, 
    required this.userRole,
    super.key
  });

  final String churchId;
  final String userRole;

  @override
  State<ServiceGroupsScreen> createState() => _ServiceGroupsScreenState();
}

class _ServiceGroupsScreenState extends State<ServiceGroupsScreen> {
  String _searchQuery = '';
  String _statusFilter = 'All'; // 'All', 'Active', 'Inactive'
  String? _selectedChurchFilter; // Filter by Church Name
  String? _selectedGradeFilter; // Filter by Grade Name
  String _adminSearchQuery = ''; // Search by Admin Name/Email

  final CollectionReference<Map<String, dynamic>> _churchesRef =
      FirebaseFirestore.instance.collection('churches');

  CollectionReference<Map<String, dynamic>> get _groupsRef =>
      _churchesRef.doc(widget.churchId).collection('serviceGroups');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final lang = AppSettings.language.value;
    final isRtl = AppSettings.isRtl();
    final isAdmin = widget.userRole == 'Admin' || widget.userRole == 'owner';

    // Top filter of churches applies: If empty, we can cross-query collectionGroup for all churches!
    final isAllChurchesSelected = widget.churchId.isEmpty;
    final serviceGroupsStream = isAllChurchesSelected
        ? FirebaseFirestore.instance.collectionGroup('serviceGroups').snapshots()
        : _groupsRef.snapshots();

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: serviceGroupsStream,
      builder: (context, snapshot) {
        if (snapshot.hasError) return Center(child: Text('Error: ${snapshot.error}'));
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());

        final rawDocs = snapshot.data!.docs;

        // Since we may be querying across all churches (collectionGroup), we should resolve parent church displayNames reactively
        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: _churchesRef.snapshots(),
          builder: (context, churchesSnap) {
            if (!churchesSnap.hasData) return const Center(child: CircularProgressIndicator());

            final churchDocs = churchesSnap.data!.docs;
            final Map<String, String> churchNames = {};
            final Map<String, Map<String, dynamic>> churchGrades = {};

            for (final doc in churchDocs) {
              churchNames[doc.id] = doc.data()['displayName'] ?? doc.id;
              churchGrades[doc.id] = doc.data()['grades'] as Map<String, dynamic>? ?? {};
            }

            // Dynamically gather unique options for column header popup filters
            final List<String> uniqueChurchesInTable = [];
            final List<String> uniqueGradesInTable = [];

            for (final doc in rawDocs) {
              // Extract parent church ID from path (churches/churchId/serviceGroups/groupId)
              final pathSegments = doc.reference.path.split('/');
              final parentChurchId = pathSegments.length > 1 ? pathSegments[1] : widget.churchId;
              final chName = churchNames[parentChurchId] ?? parentChurchId;

              if (!uniqueChurchesInTable.contains(chName)) {
                uniqueChurchesInTable.add(chName);
              }

              final gradesMap = churchGrades[parentChurchId] ?? {};
              gradesMap.forEach((k, v) {
                if (v is Map && v['serviceGroupId'] == doc.id) {
                  final gName = v['name']?.toString() ?? 'Grade $k';
                  if (!uniqueGradesInTable.contains(gName)) {
                    uniqueGradesInTable.add(gName);
                  }
                }
              });
            }

            final filteredDocs = rawDocs.where((doc) {
              final data = doc.data();
              final name = (data['displayName'] ?? '').toString().toLowerCase();
              final active = data['active'] ?? true;
              final mistersMap = data['misters'] as Map<String, dynamic>? ?? {};

              final pathSegments = doc.reference.path.split('/');
              final parentChurchId = pathSegments.length > 1 ? pathSegments[1] : widget.churchId;
              final chName = churchNames[parentChurchId] ?? parentChurchId;

              // 1. Status Filter
              if (_statusFilter == 'Active' && !active) return false;
              if (_statusFilter == 'Inactive' && active) return false;

              // 2. Church Filter
              if (_selectedChurchFilter != null && chName != _selectedChurchFilter) return false;

              // 3. Group Name Filter
              if (_searchQuery.isNotEmpty && !name.contains(_searchQuery.toLowerCase().trim())) return false;

              // 4. Admin Search Filter
              final admins = mistersMap.entries.where((e) => e.value == 'admin').map((e) => e.key.toLowerCase()).toList();
              if (_adminSearchQuery.isNotEmpty) {
                final match = admins.any((email) => email.contains(_adminSearchQuery.toLowerCase().trim()));
                if (!match) return false;
              }

              // 5. Assigned Grades Filter
              final gradesMap = churchGrades[parentChurchId] ?? {};
              final assignedGrades = <String>[];
              gradesMap.forEach((k, v) {
                if (v is Map && v['serviceGroupId'] == doc.id) {
                  assignedGrades.add(v['name']?.toString() ?? 'Grade $k');
                }
              });
              if (_selectedGradeFilter != null && !assignedGrades.contains(_selectedGradeFilter)) {
                return false;
              }

              return true;
            }).toList();

            return Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        AppTranslation.translate('service_groups', lang),
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 28),
                      ),
                      if (isAdmin)
                        FilledButton.icon(
                          onPressed: () => _showAddGroupDialog(context),
                          icon: const Icon(Icons.add),
                          label: const Text('Add Group'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Header Filtering Matrix list DataTable
                  Expanded(
                    child: filteredDocs.isEmpty
                        ? const Center(child: Text('No service groups registered matching header filters.'))
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
                                        // Column 1: Status (Header Filter popup)
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
                                        // Column 2: Church (Header Filter popup)
                                        DataColumn(
                                          label: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Text('Church'),
                                              PopupMenuButton<String?>(
                                                icon: const Icon(Icons.filter_list, size: 16),
                                                tooltip: 'Filter Church',
                                                onSelected: (val) {
                                                  setState(() {
                                                    _selectedChurchFilter = val;
                                                  });
                                                },
                                                itemBuilder: (context) => [
                                                  const PopupMenuItem<String?>(value: null, child: Text('All Churches')),
                                                  ...uniqueChurchesInTable.map((chName) {
                                                    return PopupMenuItem<String?>(value: chName, child: Text(chName));
                                                  }),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                        // Column 3: Group Name (Inline Search in Header)
                                        DataColumn(
                                          label: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Text('Group Name'),
                                              const SizedBox(width: 4),
                                              SizedBox(
                                                width: 110,
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
                                        // Column 4: Admins (Inline Search in Header)
                                        DataColumn(
                                          label: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Text('Admins'),
                                              const SizedBox(width: 4),
                                              SizedBox(
                                                width: 90,
                                                child: TextField(
                                                  decoration: const InputDecoration(
                                                    hintText: 'Admin...',
                                                    border: InputBorder.none,
                                                    isDense: true,
                                                    contentPadding: EdgeInsets.zero,
                                                  ),
                                                  style: const TextStyle(fontSize: 12),
                                                  onChanged: (val) {
                                                    setState(() {
                                                      _adminSearchQuery = val;
                                                    });
                                                  },
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const DataColumn(label: Text('Servants (Count)')),
                                        // Column 5: Assigned Grades (Header Filter popup)
                                        DataColumn(
                                          label: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Text('Assigned Grades'),
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
                                                  ...uniqueGradesInTable.map((gName) {
                                                    return PopupMenuItem<String?>(value: gName, child: Text(gName));
                                                  }),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                        const DataColumn(label: Text('Actions')),
                                      ],
                                      rows: filteredDocs.map((doc) {
                                        final data = doc.data();
                                        final active = data['active'] ?? true;
                                        final displayName = data['displayName'] ?? doc.id;
                                        final mistersMap = data['misters'] as Map<String, dynamic>? ?? {};

                                        final pathSegments = doc.reference.path.split('/');
                                        final parentChurchId = pathSegments.length > 1 ? pathSegments[1] : widget.churchId;
                                        final chName = churchNames[parentChurchId] ?? parentChurchId;

                                        final admins = mistersMap.entries.where((e) => e.value == 'admin').map((e) => e.key).toList();
                                        final servantsCount = mistersMap.entries.where((e) => e.value == 'servant').length;

                                        final assignedGrades = <String>[];
                                        final gradesMap = churchGrades[parentChurchId] ?? {};
                                        gradesMap.forEach((k, v) {
                                          if (v is Map && v['serviceGroupId'] == doc.id) {
                                            assignedGrades.add(v['name']?.toString() ?? 'Grade $k');
                                          }
                                        });

                                        return DataRow(
                                          cells: [
                                            DataCell(
                                              Icon(
                                                active ? Icons.check_circle : Icons.cancel,
                                                color: active ? Colors.green : Colors.red,
                                              ),
                                            ),
                                            DataCell(Text(chName)),
                                            DataCell(Text(displayName, style: const TextStyle(fontWeight: FontWeight.bold))),
                                            DataCell(Text(admins.isEmpty ? 'None' : admins.join(', '))),
                                            DataCell(Text('$servantsCount Servants')),
                                            DataCell(
                                              Wrap(
                                                spacing: 4,
                                                children: assignedGrades.map((g) => Chip(label: Text(g, style: const TextStyle(fontSize: 10)))).toList(),
                                              ),
                                            ),
                                            DataCell(
                                              Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  IconButton(
                                                    icon: const Icon(Icons.edit_outlined),
                                                    onPressed: isAdmin ? () => _showEditGroupDialog(context, doc) : null,
                                                  ),
                                                  IconButton(
                                                    icon: const Icon(Icons.delete_outline),
                                                    color: colorScheme.error,
                                                    onPressed: isAdmin ? () => _deleteGroup(context, doc) : null,
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

  // --- ACTIONS: ADD GROUP ---
  Future<void> _showAddGroupDialog(BuildContext context) async {
    final nameCtrl = TextEditingController();
    bool isActive = true;
    String? selectedChurchId = widget.churchId.isNotEmpty ? widget.churchId : null;
    final formKey = GlobalKey<FormState>();

    // Fetch churches list to populate selection if "All" is active in top filter
    final churchesSnap = await _churchesRef.get();
    final churches = churchesSnap.docs;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          return AlertDialog(
            title: const Text('Add Service Group'),
            content: SizedBox(
              width: 450,
              child: Form(
                key: formKey,
                autovalidateMode: AutovalidateMode.onUserInteraction,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Church Selector (Locked if widget.churchId is selected)
                      DropdownButtonFormField<String?>(
                        value: selectedChurchId,
                        decoration: const InputDecoration(labelText: 'Church *', border: OutlineInputBorder()),
                        items: churches.map((c) {
                          return DropdownMenuItem<String?>(
                            value: c.id,
                            child: Text(c.data()['displayName'] ?? c.id),
                          );
                        }).toList(),
                        onChanged: widget.churchId.isNotEmpty 
                            ? null // Locked if church filter is active!
                            : (v) => setModalState(() => selectedChurchId = v),
                        validator: (v) => v == null ? 'Required' : null,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: nameCtrl,
                        decoration: const InputDecoration(labelText: 'Group Name *', border: OutlineInputBorder()),
                        validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                      ),
                      const SizedBox(height: 8),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Active Status'),
                        value: isActive,
                        onChanged: (v) => setModalState(() => isActive = v),
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
                child: const Text('Create'),
              ),
            ],
          );
        }
      ),
    );

    if (confirmed == true && selectedChurchId != null) {
      await _churchesRef.doc(selectedChurchId).collection('serviceGroups').add({
        'displayName': nameCtrl.text.trim(),
        'active': isActive,
        'misters': {},
        'createdAt': FieldValue.serverTimestamp(),
        'createdBy': AuthService.instance.currentUser?.uid,
      });
      _showSnack('Service Group created successfully!');
    }
  }

  // --- ACTIONS: EDIT GROUP WITH MULTI-SELECT CHIPS ---
  Future<void> _showEditGroupDialog(
    BuildContext context,
    DocumentSnapshot<Map<String, dynamic>> groupDoc,
  ) async {
    final data = groupDoc.data()!;
    final nameCtrl = TextEditingController(text: data['displayName']);
    bool isActive = data['active'] ?? true;

    // Load full names to display on chips instead of raw email keys!
    final mistersSnap = await _churchesRef.doc(widget.churchId).collection('misters').get();
    final Map<String, String> emailToName = {};
    for (final d in mistersSnap.docs) {
      emailToName[d.id] = d.data()['displayName'] ?? d.id;
    }

    final Map<String, String> localMisters = Map<String, String>.from(data['misters'] ?? {});

    final formKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          final admins = localMisters.entries.where((e) => e.value == 'admin').map((e) => e.key).toList();
          final servants = localMisters.entries.where((e) => e.value == 'servant').map((e) => e.key).toList();

          return AlertDialog(
            title: Text('Edit Group: ${groupDoc.id}'),
            content: SizedBox(
              width: 600,
              height: 500,
              child: Form(
                key: formKey,
                autovalidateMode: AutovalidateMode.onUserInteraction,
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextFormField(
                        controller: nameCtrl,
                        decoration: const InputDecoration(labelText: 'Service Group Name *', border: OutlineInputBorder()),
                        validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Active Status'),
                        value: isActive,
                        onChanged: (val) => setModalState(() => isActive = val),
                      ),
                      const Divider(height: 32),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Group Admins', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline),
                            onPressed: () => _showServantSelector(context, localMisters, 'admin', setModalState),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: admins.map((email) {
                          final displayName = emailToName[email] ?? email;
                          return Chip(
                            label: Text(displayName),
                            deleteIcon: const Icon(Icons.close, size: 14),
                            onDeleted: () => setModalState(() => localMisters.remove(email)),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Servants', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline),
                            onPressed: () => _showServantSelector(context, localMisters, 'servant', setModalState),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: servants.map((email) {
                          final displayName = emailToName[email] ?? email;
                          return Chip(
                            label: Text(displayName),
                            deleteIcon: const Icon(Icons.close, size: 14),
                            onDeleted: () => setModalState(() => localMisters.remove(email)),
                          );
                        }).toList(),
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
                child: const Text('Save Group'),
              ),
            ],
          );
        },
      ),
    );

    if (confirmed == true) {
      await groupDoc.reference.update({
        'displayName': nameCtrl.text.trim(),
        'active': isActive,
        'misters': localMisters,
      });
      _showSnack('Service Group successfully updated.');
    }
  }

  // --- POPUP SERVANT MULTI-SELECT MATRIX (WITH SEARCH BY NAME & GROUP) ---
  Future<void> _showServantSelector(
    BuildContext context,
    Map<String, String> currentMisters,
    String targetRole,
    void Function(void Function()) parentSetState,
  ) async {
    final mistersSnap = await _churchesRef.doc(widget.churchId).collection('misters').where('active', isEqualTo: true).get();
    final allMisters = mistersSnap.docs;

    final groupsSnap = await _groupsRef.get();
    final allGroups = groupsSnap.docs;

    // Resolve mappings for search queries
    final Map<String, List<String>> servantGroupNames = {};
    for (final group in allGroups) {
      final mData = group.data()['misters'] as Map<String, dynamic>? ?? {};
      for (final email in mData.keys) {
        servantGroupNames.putIfAbsent(email, () => []).add(group.data()['displayName'] ?? group.id);
      }
    }

    String dlgSearchName = '';
    String dlgSearchGroup = '';
    final List<String> selectedEmails = [];

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          final filteredServants = allMisters.where((m) {
            final email = m.id;
            final name = (m.data()['displayName'] ?? '').toString().toLowerCase();
            final groupsMatched = servantGroupNames[email] ?? [];
            final groupsMatchedStr = groupsMatched.join(' ').toLowerCase();

            if (dlgSearchName.isNotEmpty && !name.contains(dlgSearchName.toLowerCase().trim())) return false;
            if (dlgSearchGroup.isNotEmpty && !groupsMatchedStr.contains(dlgSearchGroup.toLowerCase().trim())) return false;

            return true;
          }).toList();

          return AlertDialog(
            title: Text('Assign Servants as ${targetRole.toUpperCase()}'),
            content: SizedBox(
              width: 500,
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
                    ],
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: ListView.separated(
                      itemCount: filteredServants.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final m = filteredServants[index];
                        final email = m.id;
                        final name = m.data()['displayName'] ?? email;
                        final groupsAssigned = servantGroupNames[email] ?? [];

                        final hasThisRole = currentMisters[email] == targetRole;
                        final isSelected = selectedEmails.contains(email) || hasThisRole;

                        return CheckboxListTile(
                          dense: true,
                          title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('Email: $email  •  Groups: ${groupsAssigned.isEmpty ? "None" : groupsAssigned.join(", ")}'),
                          value: isSelected,
                          onChanged: hasThisRole ? null : (val) {
                            setModalState(() {
                              if (val == true) {
                                selectedEmails.add(email);
                              } else {
                                selectedEmails.remove(email);
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
                    for (final email in selectedEmails) {
                      currentMisters[email] = targetRole;
                    }
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

  Future<void> _deleteGroup(BuildContext context, DocumentSnapshot<Map<String, dynamic>> doc) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Service Group?'),
            content: Text('Are you sure you want to delete "${doc.id}"? This will delete the service group. This action is permanent.'),
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
      _showSnack('Service Group successfully deleted.');
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
