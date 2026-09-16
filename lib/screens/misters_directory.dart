// ignore_for_file: unnecessary_underscores, deprecated_member_use, use_build_context_synchronously
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';
import '../services/auth_service.dart';

class MistersDirectoryScreen extends StatefulWidget {
  const MistersDirectoryScreen({
    required this.churchId,
    required this.academicYearId,
    required this.serviceGroupId,
    required this.classId,
    required this.userRole,
    super.key,
  });

  final String churchId;
  final String academicYearId;
  final String serviceGroupId;
  final String classId;
  final String userRole;

  @override
  State<MistersDirectoryScreen> createState() => _MistersDirectoryScreenState();
}

class _MistersDirectoryScreenState extends State<MistersDirectoryScreen> {
  String _searchQuery = '';
  String _statusFilter = 'All'; // 'All', 'Active', 'Inactive'
  String? _selectedRoleFilter; // Column Header ChurchRole filter
  String _phoneFilter = ''; // Column Header Phone filter
  String _addressFilter = ''; // Column Header Address filter
  String? _selectedJobFilter; // Column Header Job filter

  final CollectionReference<Map<String, dynamic>> _churchesRef =
      FirebaseFirestore.instance.collection('churches');

  CollectionReference<Map<String, dynamic>> get _ref =>
      _churchesRef.doc(widget.churchId).collection('misters');

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

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: _ref.snapshots(),
      builder: (context, mistersSnapshot) {
        if (mistersSnapshot.hasError) return Center(child: Text('Error: ${mistersSnapshot.error}'));
        if (!mistersSnapshot.hasData) return const Center(child: CircularProgressIndicator());

        final allMisters = mistersSnapshot.data!.docs;

        // Fetch Service Groups and Classes to resolve assignments
        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: _churchesRef.doc(widget.churchId).collection('serviceGroups').snapshots(),
          builder: (context, groupsSnapshot) {
            if (!groupsSnapshot.hasData) return const Center(child: CircularProgressIndicator());
            final allGroups = groupsSnapshot.data!.docs;

            return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: _churchesRef.doc(widget.churchId).collection('classes').snapshots(),
              builder: (context, classesSnapshot) {
                if (!classesSnapshot.hasData) return const Center(child: CircularProgressIndicator());
                final allClasses = classesSnapshot.data!.docs;

                // Resolve cross-referencing assignments for ALL misters
                final Map<String, List<String>> misterAdminInGroups = {};
                final Map<String, List<String>> misterServantInGroups = {};
                final Map<String, List<String>> misterServantInClasses = {};

                for (final g in allGroups) {
                  final gName = g.data()['displayName'] ?? g.id;
                  final mData = g.data()['misters'] as Map<String, dynamic>? ?? {};
                  mData.forEach((email, role) {
                    if (role == 'admin') {
                      misterAdminInGroups.putIfAbsent(email, () => []).add(gName);
                    } else if (role == 'servant') {
                      misterServantInGroups.putIfAbsent(email, () => []).add(gName);
                    }
                  });
                }

                for (final c in allClasses) {
                  final data = c.data();
                  final yearsMap = data['academicYears'] as Map<String, dynamic>? ?? {};
                  if (widget.academicYearId.isNotEmpty && yearsMap.containsKey(widget.academicYearId)) {
                    final yrData = yearsMap[widget.academicYearId] as Map<String, dynamic>;
                    final className = yrData['name'] ?? c.id;
                    final mistersList = List.from(yrData['MistersIds'] ?? []);
                    for (final email in mistersList) {
                      misterServantInClasses.putIfAbsent(email.toString(), () => []).add(className);
                    }
                  }
                }

                // Dynamically gather unique options for column header filters
                final List<String> uniqueJobsInTable = [];
                for (final d in allMisters) {
                  final personal = d.data()['personalInfo'] as Map<String, dynamic>? ?? {};
                  final j = (personal['job'] ?? '').toString().trim();
                  if (j.isNotEmpty && !uniqueJobsInTable.contains(j)) {
                    uniqueJobsInTable.add(j);
                  }
                }

                final filteredMisters = allMisters.where((doc) {
                  final emailId = doc.id;
                  final data = doc.data();
                  final active = data['active'] ?? true;
                  final name = (data['displayName'] ?? '').toString().toLowerCase();
                  final churchRole = data['churchRole'] ?? 'viewer';

                  // Apply local status filter
                  if (_statusFilter == 'Active' && !active) return false;
                  if (_statusFilter == 'Inactive' && active) return false;

                  // Apply local column header role filter
                  if (_selectedRoleFilter != null && churchRole != _selectedRoleFilter) return false;

                  // Apply global top-level filters dynamically to filter rows with robust zero-crash fallbacks!
                  if (widget.serviceGroupId.isNotEmpty) {
                    final groupDoc = allGroups.cast<QueryDocumentSnapshot<Map<String, dynamic>>?>().firstWhere(
                          (d) => d?.id == widget.serviceGroupId,
                          orElse: () => null,
                        );
                    if (groupDoc == null) return false;
                    final groupName = groupDoc.data()['displayName'] ?? groupDoc.id;

                    final isAssignedAdmin = misterAdminInGroups[emailId]?.contains(groupName) ?? false;
                    final isAssignedServant = misterServantInGroups[emailId]?.contains(groupName) ?? false;

                    if (!isAssignedAdmin && !isAssignedServant) return false;
                  }

                  if (widget.classId.isNotEmpty) {
                    final classDoc = allClasses.cast<QueryDocumentSnapshot<Map<String, dynamic>>?>().firstWhere(
                          (d) => d?.id == widget.classId,
                          orElse: () => null,
                        );
                    if (classDoc == null) return false;
                    final yearsMap = classDoc.data()['academicYears'] as Map<String, dynamic>? ?? {};
                    final yrData = yearsMap[widget.academicYearId] as Map<String, dynamic>? ?? {};
                    final className = yrData['name'] ?? classDoc.id;

                    final isAssignedInClass = misterServantInClasses[emailId]?.contains(className) ?? false;
                    if (!isAssignedInClass) return false;
                  }

                  final personal = data['personalInfo'] as Map<String, dynamic>? ?? {};
                  final phone = (personal['phone'] ?? '').toString();
                  final job = (personal['job'] ?? '').toString();
                  final address = (personal['address'] ?? '').toString();

                  // Apply deep column header filtering matrix parameters
                  if (_phoneFilter.isNotEmpty && !phone.contains(_phoneFilter.trim())) {
                    return false;
                  }
                  if (_addressFilter.isNotEmpty && !address.toLowerCase().contains(_addressFilter.toLowerCase().trim())) {
                    return false;
                  }
                  if (_selectedJobFilter != null && job != _selectedJobFilter) {
                    return false;
                  }

                  // Apply local search filter by Name/Email
                  final query = _searchQuery.toLowerCase().trim();
                  return name.contains(query) ||
                      emailId.contains(query) ||
                      phone.contains(query) ||
                      job.toLowerCase().contains(query) ||
                      address.toLowerCase().contains(query);
                }).toList();

                return Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 1. Header Action
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            AppTranslation.translate('servants', lang),
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 28),
                          ),
                          if (isAdmin)
                            FilledButton.icon(
                              onPressed: () => _showAddEditMisterDialog(context, null),
                              icon: const Icon(Icons.add),
                              label: const Text('Add Servant'),
                            ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // 2. DataTable Grid List
                      Expanded(
                        child: filteredMisters.isEmpty
                            ? const Center(child: Text('No servants registered matching filters.'))
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
                                            // Status Filter Header
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
                                            // Name Inline Search Header
                                            DataColumn(
                                              label: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const Text('Full Name'),
                                                  const SizedBox(width: 4),
                                                  SizedBox(
                                                    width: 120,
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
                                            // Church Role Filter Header
                                            DataColumn(
                                              label: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const Text('Access Role'),
                                                  PopupMenuButton<String?>(
                                                    icon: const Icon(Icons.filter_list, size: 16),
                                                    tooltip: 'Filter Role',
                                                    onSelected: (val) {
                                                      setState(() {
                                                        _selectedRoleFilter = val;
                                                      });
                                                    },
                                                    itemBuilder: (context) => [
                                                      const PopupMenuItem<String?>(value: null, child: Text('All Roles')),
                                                      const PopupMenuItem<String?>(value: 'admin', child: Text('Admin (Coordinator)')),
                                                      const PopupMenuItem<String?>(value: 'viewer', child: Text('Viewer (Teacher)')),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                            const DataColumn(label: Text('Admin in Groups')),
                                            const DataColumn(label: Text('Servant in Groups')),
                                            const DataColumn(label: Text('Servant in Classes')),
                                            const DataColumn(label: Text('Email (Key)')),
                                            // Deep Header Filtering Matrix: Phone Inline Search
                                            DataColumn(
                                              label: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const Text('Phone'),
                                                  const SizedBox(width: 4),
                                                  SizedBox(
                                                    width: 100,
                                                    child: TextField(
                                                      decoration: const InputDecoration(
                                                        hintText: 'Phone...',
                                                        border: InputBorder.none,
                                                        isDense: true,
                                                        contentPadding: EdgeInsets.zero,
                                                      ),
                                                      style: const TextStyle(fontSize: 12),
                                                      onChanged: (val) {
                                                        setState(() {
                                                          _phoneFilter = val;
                                                        });
                                                      },
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            const DataColumn(label: Text('Date of Birth')),
                                            // Deep Header Filtering Matrix: Job Dropdown Popup
                                            DataColumn(
                                              label: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const Text('Job'),
                                                  PopupMenuButton<String?>(
                                                    icon: const Icon(Icons.filter_list, size: 16),
                                                    tooltip: 'Filter Job',
                                                    onSelected: (val) {
                                                      setState(() {
                                                        _selectedJobFilter = val;
                                                      });
                                                    },
                                                    itemBuilder: (context) => [
                                                      const PopupMenuItem<String?>(value: null, child: Text('All Jobs')),
                                                      ...uniqueJobsInTable.map((j) => PopupMenuItem<String?>(value: j, child: Text(j))),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                            // Deep Header Filtering Matrix: Address Inline Search
                                            DataColumn(
                                              label: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const Text('Address'),
                                                  const SizedBox(width: 4),
                                                  SizedBox(
                                                    width: 110,
                                                    child: TextField(
                                                      decoration: const InputDecoration(
                                                        hintText: 'Addr...',
                                                        border: InputBorder.none,
                                                        isDense: true,
                                                        contentPadding: EdgeInsets.zero,
                                                      ),
                                                      style: const TextStyle(fontSize: 12),
                                                      onChanged: (val) {
                                                        setState(() {
                                                          _addressFilter = val;
                                                        });
                                                      },
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            const DataColumn(label: Text('Actions')),
                                          ],
                                          rows: filteredMisters.map((doc) {
                                            final emailId = doc.id;
                                            final data = doc.data();
                                            final active = data['active'] ?? true;
                                            final name = data['displayName'] ?? emailId;
                                            final churchRole = data['churchRole'] ?? 'viewer';

                                            final personal = data['personalInfo'] as Map<String, dynamic>? ?? {};
                                            final phone = personal['phone'] ?? '';
                                            final job = personal['job'] ?? '';
                                            final address = personal['address'] ?? '';

                                            String dobStr = '';
                                            final dobVal = personal['dob'];
                                            if (dobVal is Timestamp) {
                                              final dt = dobVal.toDate();
                                              dobStr = '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
                                            }

                                            final adminGrps = misterAdminInGroups[emailId] ?? [];
                                            final servantGrps = misterServantInGroups[emailId] ?? [];
                                            final servantClasses = misterServantInClasses[emailId] ?? [];

                                            // Access control: User can edit if Admin/Owner OR if it is their OWN profile!
                                            final isSelf = AuthService.instance.currentUser?.email == emailId;
                                            final hasEditAccess = isAdmin || isSelf;

                                            return DataRow(
                                              cells: [
                                                DataCell(
                                                  Icon(
                                                    active ? Icons.check_circle : Icons.cancel,
                                                    color: active ? Colors.green : Colors.red,
                                                  ),
                                                ),
                                                DataCell(Text(name, style: const TextStyle(fontWeight: FontWeight.bold))),
                                                DataCell(Text(churchRole == 'admin' ? 'Admin' : 'Viewer')),
                                                DataCell(
                                                  Wrap(
                                                    spacing: 4,
                                                    children: adminGrps.map((g) => Chip(label: Text(g, style: const TextStyle(fontSize: 10)))).toList(),
                                                  ),
                                                ),
                                                DataCell(
                                                  Wrap(
                                                    spacing: 4,
                                                    children: servantGrps.map((g) => Chip(label: Text(g, style: const TextStyle(fontSize: 10)))).toList(),
                                                  ),
                                                ),
                                                DataCell(
                                                  Wrap(
                                                    spacing: 4,
                                                    children: servantClasses.map((c) => Chip(label: Text(c, style: const TextStyle(fontSize: 10)))).toList(),
                                                  ),
                                                ),
                                                DataCell(Text(emailId)),
                                                DataCell(Text(phone)),
                                                DataCell(Text(dobStr)),
                                                DataCell(Text(job)),
                                                DataCell(Text(address)),
                                                DataCell(
                                                  Row(
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      if (hasEditAccess) ...[
                                                        IconButton(
                                                          icon: const Icon(Icons.edit_outlined, size: 18),
                                                          onPressed: () => _showAddEditMisterDialog(context, doc),
                                                        ),
                                                        if (isAdmin) // Deletion strictly restricted to Admins/Owners!
                                                          IconButton(
                                                            icon: const Icon(Icons.delete_outline, size: 18),
                                                            color: colorScheme.error,
                                                            onPressed: () => _deleteMister(context, doc),
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
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  // --- ACTIONS: ADD & EDIT SERVANT POPUP DIALOG (WITH SELF-SERVICE ACCESS BOUNDS) ---
  Future<void> _showAddEditMisterDialog(
    BuildContext context,
    DocumentSnapshot<Map<String, dynamic>>? misterDoc,
  ) async {
    final isEdit = misterDoc != null;
    final emailId = misterDoc?.id ?? '';
    final data = misterDoc?.data() ?? {};
    final personal = data['personalInfo'] as Map<String, dynamic>? ?? {};

    final emailCtrl = TextEditingController(text: emailId);
    final nameCtrl = TextEditingController(text: data['displayName']);
    final phoneCtrl = TextEditingController(text: personal['phone']);
    final jobCtrl = TextEditingController(text: personal['job']);
    final addressCtrl = TextEditingController(text: personal['address']);
    final notesCtrl = TextEditingController(text: personal['notes']);

    bool isActive = data['active'] ?? true;
    String selectedRole = data['churchRole'] ?? 'viewer';
    String selectedGender = personal['gender'] ?? 'M';

    DateTime? selectedDob;
    final dobVal = personal['dob'];
    if (dobVal is Timestamp) selectedDob = dobVal.toDate();

    final formKey = GlobalKey<FormState>();

    // Self-Service Access Constraint Check:
    // If they are NOT a Church Admin, but are editing their own profile:
    // Lock down "active" status and "churchRole" dropdowns!
    final isSelf = AuthService.instance.currentUser?.email == emailId;
    final isAdmin = widget.userRole == 'Admin' || widget.userRole == 'owner';
    final isRoleLocked = isEdit && isSelf && !isAdmin;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: Text(isEdit ? 'Edit Servant Profile' : 'Register New Servant'),
          content: SizedBox(
            width: 600,
            child: Form(
              key: formKey,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // --- 1. SYSTEM SECURITY RULES ---
                    ExpansionTile(
                      initiallyExpanded: true,
                      title: const Text('Access Permissions (Admin Only)', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.teal)),
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            children: [
                              TextFormField(
                                controller: emailCtrl,
                                enabled: !isEdit,
                                decoration: const InputDecoration(labelText: 'Google Email Key *', border: OutlineInputBorder()),
                                validator: (v) {
                                  if (v == null || v.trim().isEmpty) return 'Required';
                                  final email = v.trim();
                                  // Validate standard Google Gmail formats
                                  final match = RegExp(r'^[a-zA-Z0-9._%+-]+@gmail\.com$').hasMatch(email) ||
                                                RegExp(r'^[a-zA-Z0-9._%+-]+@valeo\.com$').hasMatch(email); // Mock testing domains
                                  if (!match && !email.contains('@')) return 'Must be a valid Google Account email';
                                  return null;
                                },
                              ),
                              const SizedBox(height: 12),
                              IgnorePointer(
                                ignoring: isRoleLocked,
                                child: Opacity(
                                  opacity: isRoleLocked ? 0.5 : 1.0,
                                  child: DropdownButtonFormField<String>(
                                    value: selectedRole,
                                    decoration: const InputDecoration(labelText: 'Church Role *', border: OutlineInputBorder()),
                                    items: const [
                                      DropdownMenuItem(value: 'admin', child: Text('Admin (Coordinator)')),
                                      DropdownMenuItem(value: 'viewer', child: Text('Viewer (Teacher)')),
                                    ],
                                    onChanged: (v) {
                                      if (v != null) setModalState(() => selectedRole = v);
                                    },
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              IgnorePointer(
                                ignoring: isRoleLocked,
                                child: Opacity(
                                  opacity: isRoleLocked ? 0.5 : 1.0,
                                  child: SwitchListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: const Text('Active Account Status'),
                                    value: isActive,
                                    onChanged: (v) => setModalState(() => isActive = v),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // --- 2. PERSONAL INFO ---
                    ExpansionTile(
                      initiallyExpanded: true,
                      title: const Text('Personal Details (Editable by Self)', style: TextStyle(fontWeight: FontWeight.bold)),
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            children: [
                              TextFormField(
                                controller: nameCtrl,
                                decoration: const InputDecoration(labelText: 'Full Name *', border: OutlineInputBorder()),
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
                                          initialDate: selectedDob ?? DateTime(1990),
                                          firstDate: DateTime(1940),
                                          lastDate: DateTime.now(),
                                        );
                                        if (dt != null) setModalState(() => selectedDob = dt);
                                      },
                                      child: InputDecorator(
                                        decoration: const InputDecoration(labelText: 'Date of Birth', border: OutlineInputBorder()),
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
                                controller: phoneCtrl,
                                decoration: const InputDecoration(labelText: 'Mobile Phone', border: OutlineInputBorder()),
                                keyboardType: TextInputType.phone,
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: jobCtrl,
                                decoration: const InputDecoration(labelText: 'Job / Profession', border: OutlineInputBorder()),
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: addressCtrl,
                                decoration: const InputDecoration(labelText: 'Home Address', border: OutlineInputBorder()),
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: notesCtrl,
                                decoration: const InputDecoration(labelText: 'Pastoral Notes', border: OutlineInputBorder()),
                                maxLines: 3,
                              ),
                            ],
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
        ),
      ),
    );

    if (confirmed == true) {
      final email = emailCtrl.text.trim();
      final user = AuthService.instance.currentUser?.uid ?? 'unknown';

      // Assemble personalInfo structure with schema lifecycle tracers
      final personalInfoMap = {
        'phone': phoneCtrl.text.trim(),
        'gender': selectedGender,
        'dob': selectedDob != null ? Timestamp.fromDate(selectedDob!) : null,
        'job': jobCtrl.text.trim(),
        'address': addressCtrl.text.trim(),
        'notes': notesCtrl.text.trim(),
        'lastEditAt': FieldValue.serverTimestamp(),
        'lastEditBy': user,
      };

      if (!isEdit) {
        personalInfoMap['createdAt'] = FieldValue.serverTimestamp() as Object;
        personalInfoMap['createdBy'] = user;
      } else {
        personalInfoMap['createdAt'] = personal['createdAt'];
        personalInfoMap['createdBy'] = personal['createdBy'] ?? 'system';
      }

      final payload = {
        'active': isActive,
        'email': email,
        'displayName': nameCtrl.text.trim(),
        'churchRole': selectedRole,
        'personalInfo': personalInfoMap,
        'lastEditAt': FieldValue.serverTimestamp(),
        'lastEditBy': user,
      };

      if (!isEdit) {
        payload['authUid'] = '';
        payload['createdAt'] = FieldValue.serverTimestamp() as Object;
        payload['createdBy'] = user;
        
        await _ref.doc(email).set(payload);
      } else {
        payload['authUid'] = data['authUid'] ?? '';
        payload['createdAt'] = data['createdAt'];
        payload['createdBy'] = data['createdBy'] ?? 'system';

        await _ref.doc(email).update(payload);
      }

      _showSnack('Servant profile successfully saved.');
    }
  }

  // --- ACTIONS: DELETE SERVANT CORE ---
  Future<void> _deleteMister(BuildContext context, DocumentSnapshot<Map<String, dynamic>> doc) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Servant Account?'),
            content: Text('Are you sure you want to permanently delete "${doc.id}"? This action cannot be undone.'),
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
      _showSnack('Account successfully deleted.');
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
