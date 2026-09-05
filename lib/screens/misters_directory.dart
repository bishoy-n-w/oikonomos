import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:excel/excel.dart';
import 'package:flutter/material.dart';
import '../widgets/phone_field.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';
import '../services/file_service.dart';

class MistersDirectoryScreen extends StatefulWidget {
  const MistersDirectoryScreen({
    required this.churchId,
    required this.userRole,
    super.key,
  });

  final String churchId;
  final String userRole;

  @override
  State<MistersDirectoryScreen> createState() => _MistersDirectoryScreenState();
}

class _MistersDirectoryScreenState extends State<MistersDirectoryScreen> {
  final Map<String, bool> _selectedRows = {};
  String _searchQuery = '';
  bool _selectAll = false;

  final CollectionReference<Map<String, dynamic>> _mistersRef =
      FirebaseFirestore.instance.collection('churches');

  CollectionReference<Map<String, dynamic>> get _ref =>
      _mistersRef.doc(widget.churchId).collection('misters');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final lang = AppSettings.language.value;
    final isRtl = AppSettings.isRtl();

    if (widget.churchId.isEmpty) {
      return Center(
        child: Text(AppTranslation.translate('church', lang)),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: _ref.snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(child: Text('Database Error: ${snapshot.error}'));
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final docs = snapshot.data!.docs;
          // Filter list by search query
          final filteredDocs = docs.where((doc) {
            final data = doc.data();
            final name = (data['displayName'] ?? '').toString().toLowerCase();
            final email = doc.id.toLowerCase(); // Email is the document ID key!
            final mobile = (data['phone'] ?? data['mobile'] ?? '').toString().toLowerCase();
            final query = _searchQuery.toLowerCase().trim();

            return name.contains(query) || email.contains(query) || mobile.contains(query);
          }).toList();

          final selectedCount = _selectedRows.values.where((v) => v).length;
          final isAdmin = widget.userRole == 'Admin';

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Title & Header Actions
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    AppTranslation.translate('servants', lang),
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => _showImportWizard(context),
                        icon: const Icon(Icons.file_upload_outlined),
                        label: const Text('Import Excel / CSV'),
                      ),
                      FilledButton.icon(
                        onPressed: () => _showAddEditDialog(context, null),
                        icon: const Icon(Icons.add),
                        label: Text(AppTranslation.translate('add', lang)),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Pending Join Requests Panel
              if (isAdmin) _buildJoinRequestsPanel(context, theme, colorScheme),

              // 2. Search & Bulk Actions Bar
              Card(
                elevation: 0,
                color: colorScheme.surfaceContainerLow,
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
                            prefixIcon: const Icon(Icons.search, size: 20),
                            border: InputBorder.none,
                          ),
                          onChanged: (text) {
                            setState(() {
                              _searchQuery = text;
                            });
                          },
                        ),
                      ),
                      if (selectedCount > 0) ...[
                        const SizedBox(width: 16),
                        Text(
                          '$selectedCount selected',
                          style: TextStyle(
                            color: colorScheme.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(width: 16),
                        FilledButton.tonalIcon(
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
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 3. DataTable Grid
              Expanded(
                child: filteredDocs.isEmpty
                    ? const Center(child: Text('No servants found.'))
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
                                  columns: [
                                    DataColumn(
                                      label: Row(
                                        children: [
                                          Checkbox(
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
                                          const SizedBox(width: 8),
                                          const Text('Select All', style: TextStyle(fontWeight: FontWeight.bold)),
                                        ],
                                      ),
                                    ),
                                    const DataColumn(label: Text('Full Name', style: TextStyle(fontWeight: FontWeight.bold))),
                                    const DataColumn(label: Text('Email (Key)', style: TextStyle(fontWeight: FontWeight.bold))),
                                    const DataColumn(label: Text('Mobile', style: TextStyle(fontWeight: FontWeight.bold))),
                                    const DataColumn(label: Text('Access Role', style: TextStyle(fontWeight: FontWeight.bold))),
                                    const DataColumn(label: Text('Status', style: TextStyle(fontWeight: FontWeight.bold))),
                                    const DataColumn(label: Text('Actions', style: TextStyle(fontWeight: FontWeight.bold))),
                                  ],
                                  rows: filteredDocs.map((doc) {
                                    final data = doc.data();
                                    final emailId = doc.id; // Primary Key
                                    final displayName = data['displayName'] ?? '';
                                    final mobile = data['phone'] ?? data['mobile'] ?? '';
                                    final countryCode = data['countryCode'] ?? '';
                                    final role = data['churchRole'] ?? 'Teacher';
                                    final active = data['active'] ?? true;
                                    final isChecked = _selectedRows[emailId] ?? false;

                                    final String mobileFormatted = countryCode.isNotEmpty
                                        ? '$countryCode $mobile'
                                        : mobile.toString();

                                    return DataRow(
                                      selected: isChecked,
                                      cells: [
                                        DataCell(
                                          Checkbox(
                                            value: isChecked,
                                            onChanged: (val) {
                                              setState(() {
                                                _selectedRows[emailId] = val ?? false;
                                                if (!val!) _selectAll = false;
                                              });
                                            },
                                          ),
                                        ),
                                        DataCell(Text(displayName, style: const TextStyle(fontWeight: FontWeight.bold))),
                                        DataCell(SelectableText(emailId)),
                                        DataCell(Text(mobileFormatted)),
                                        DataCell(
                                          Chip(
                                            label: Text(role.toString().toUpperCase()),
                                            padding: EdgeInsets.zero,
                                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                            backgroundColor: role == 'admin'
                                                ? colorScheme.primaryContainer
                                                : colorScheme.surfaceVariant,
                                          ),
                                        ),
                                        DataCell(
                                          Icon(
                                            active ? Icons.check_circle : Icons.cancel,
                                            color: active ? Colors.green : Colors.red,
                                            size: 20,
                                          ),
                                        ),
                                        DataCell(
                                          Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              IconButton(
                                                icon: const Icon(Icons.edit_outlined, size: 18),
                                                onPressed: () => _showAddEditDialog(context, doc),
                                              ),
                                              IconButton(
                                                icon: const Icon(Icons.delete_outline, size: 18),
                                                color: colorScheme.error,
                                                onPressed: () => _deleteSingle(context, emailId),
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
          );
        },
      ),
    );
  }

  // --- ACTIONS: EXPORT & DELETE ---

  void _exportSelectedToCsv(List<DocumentSnapshot<Map<String, dynamic>>> docs) {
    try {
      final List<String> csvLines = [];
      // CSV Headers (Unified Mobile column, no Country Code!)
      csvLines.add('Full Name,Email,Mobile,Role,Active');

      for (final doc in docs) {
        if (_selectedRows[doc.id] == true) {
          final data = doc.data()!;
          final email = doc.id;
          final name = data['displayName'] ?? '';
          
          final rawMobile = data['mobile'] ?? data['phone'] ?? '';
          // Prefix with tab '\t' inside the CSV to force Excel/Sheets to preserve the leading '+'
          final String mobile = rawMobile.toString().startsWith('+')
              ? '\t$rawMobile'
              : '\t+$rawMobile';

          final role = data['churchRole'] ?? 'Teacher';
          final active = data['active'] ?? true;

          csvLines.add('"$name","$email","$mobile","$role","$active"');
        }
      }

      final csvContent = csvLines.join('\n');
      FileService.saveFile(
        content: csvContent,
        fileName: 'Oikonomos_Servants_Roster.csv',
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Roster exported successfully!')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('CSV Export failed: $e')),
      );
    }
  }

  Future<void> _deleteSingle(BuildContext context, String emailId) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Servant?'),
            content: Text('Are you sure you want to delete servant "$emailId"? This cannot be undone.'),
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

    if (confirmed) {
      await _ref.doc(emailId).delete();
    }
  }

  Future<void> _deleteSelected(List<DocumentSnapshot<Map<String, dynamic>>> docs) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Selected Servants?'),
            content: const Text('Are you sure you want to delete all checked servants? This cannot be undone.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Delete All'),
              ),
            ],
          ),
        ) ??
        false;

    if (confirmed) {
      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      for (final doc in docs) {
        if (_selectedRows[doc.id] == true) {
          batch.delete(doc.reference);
        }
      }

      await batch.commit();
      setState(() {
        _selectedRows.clear();
        _selectAll = false;
      });
    }
  }

  // --- EDIT & ADD SINGLE DIALOG ---

  Future<void> _showAddEditDialog(
    BuildContext context,
    DocumentSnapshot<Map<String, dynamic>>? doc,
  ) async {
    final theme = Theme.of(context);

    final isEdit = doc != null;
    final data = doc?.data();

    final nameController = TextEditingController(text: data?['displayName']);
    final emailController = TextEditingController(text: doc?.id);
    
    final String initialMobile = (data?['mobile'] != null && data!['mobile'].toString().isNotEmpty)
        ? data['mobile'].toString()
        : (data?['phone'] ?? '').toString();
    final mobileController = TextEditingController(text: initialMobile);

    String selectedRole = data?['churchRole'] ?? 'Teacher';
    bool isActive = data?['active'] ?? true;

    final formKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: Text(isEdit ? 'Edit Servant Profile' : 'Register New Servant'),
          content: SizedBox(
            width: 420,
            child: Form(
              key: formKey,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: nameController,
                      decoration: const InputDecoration(
                        labelText: 'Full Name *',
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Full name is required';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: emailController,
                      enabled: !isEdit, // Email is the Key, cannot be edited!
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Google Email Address *',
                        border: OutlineInputBorder(),
                        hintText: 'e.g. servant@gmail.com',
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Email is required';
                        }
                        final emailReg = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
                        if (!emailReg.hasMatch(value.trim().toLowerCase())) {
                          return 'Invalid email format';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    OikonomosPhoneField(
                      initialValue: mobileController.text,
                      labelText: 'Mobile Number *',
                      required: true,
                      onChanged: (e164Value) {
                        setModalState(() {
                          mobileController.text = e164Value;
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: selectedRole,
                      decoration: const InputDecoration(
                        labelText: 'Access Permissions',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'Teacher', child: Text('Teacher')),
                        DropdownMenuItem(value: 'Admin', child: Text('Admin')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() => selectedRole = val);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Active Servant'),
                      value: isActive,
                      onChanged: (val) => setModalState(() => isActive = val),
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
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      final name = nameController.text.trim();
      final email = emailController.text.trim().toLowerCase();
      final mobile = mobileController.text.trim(); // Complete E.164 string!

      final payload = {
        'displayName': name,
        'mobile': mobile,
        'churchRole': selectedRole,
        'active': isActive,
        'authUid': email, // Binds key
      };

      try {
        if (!isEdit) {
          // Check key uniqueness
          final existing = await _ref.doc(email).get();
          if (existing.exists) {
            _showSnack('A servant with this email is already registered!');
            return;
          }
          await _ref.doc(email).set({
            ...payload,
            'createdAt': FieldValue.serverTimestamp(),
          });
        } else {
          await _ref.doc(email).set(payload, SetOptions(merge: true));
        }
      } catch (e) {
        _showSnack('Save failed: $e');
      }
    }
  }

  // --- CORE EXCEL/CSV IMPORT WIZARD ---

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
      _showSnack('This Excel file has no tabs/sheets.');
      return;
    }

    String selectedSheet = sheets.first;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Text('Excel Import: Choose Tab'),
          content: DropdownButtonFormField<String>(
            initialValue: selectedSheet,
            decoration: const InputDecoration(
              labelText: 'Select Excel Tab',
              border: OutlineInputBorder(),
            ),
            items: sheets.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (val) {
              if (val != null) {
                setModalState(() => selectedSheet = val);
              }
            },
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Next'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      final sheet = excel.tables[selectedSheet]!;
      _startExcelMappingWizard(fileName, sheet.rows);
    }
  }

  Future<void> _startExcelMappingWizard(String fileName, List<List<Data?>> rows) async {
    if (rows.isEmpty) {
      _showSnack('The selected sheet is completely empty.');
      return;
    }

    // Convert excel rows to string lists
    final List<List<String>> stringRows = rows.map((row) {
      return row.map((cell) => cell?.value?.toString().trim() ?? '').toList();
    }).toList();

    _launchMappingWizard(fileName, stringRows);
  }

  Future<void> _startCsvMappingWizard(String fileName, String csvText) async {
    final List<List<String>> rows = csvText
        .split('\n')
        .map((line) => line
            .split(',')
            .map((cell) => cell.trim().replaceAll('"', ''))
            .toList())
        .where((row) => row.isNotEmpty && row.any((c) => c.isNotEmpty))
        .toList();

    if (rows.isEmpty) {
      _showSnack('The uploaded CSV file is empty.');
      return;
    }

    _launchMappingWizard(fileName, rows);
  }

  Future<void> _launchMappingWizard(String fileName, List<List<String>> rows) async {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    int headerRowIndex = 0; // Default Row 1 (0-based index)
    
    // Choose headers list
    List<String> getHeaders(int idx) {
      if (idx >= rows.length) return [];
      return rows[idx].asMap().map((i, val) => MapEntry(i, val.isNotEmpty ? val : 'Column ${i + 1}')).values.toList();
    }

    List<String> currentHeaders = getHeaders(headerRowIndex);
    
    // Mapping configurations (Database Field -> Excel Column Index)
    int? mappedNameIdx;
    int? mappedEmailIdx;
    int? mappedMobileIdx;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          currentHeaders = getHeaders(headerRowIndex);
          return AlertDialog(
            title: Text('Import Map: $fileName'),
            content: SizedBox(
              width: 500,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '1. Select Header Row',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<int>(
                      initialValue: headerRowIndex,
                      decoration: const InputDecoration(
                        labelText: 'Row containing column names',
                        border: OutlineInputBorder(),
                      ),
                      items: List.generate(
                        rows.length > 10 ? 10 : rows.length,
                        (index) => DropdownMenuItem(value: index, child: Text('Row ${index + 1}')),
                      ),
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            headerRowIndex = val;
                            currentHeaders = getHeaders(headerRowIndex);
                            // Reset mappings as headers changed
                            mappedNameIdx = null;
                            mappedEmailIdx = null;
                            mappedMobileIdx = null;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      '2. Map Fields to Excel Columns',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    // Map Display Name
                    DropdownButtonFormField<int>(
                      value: mappedNameIdx,
                      decoration: const InputDecoration(
                        labelText: 'Map "Full Name" Field *',
                        border: OutlineInputBorder(),
                      ),
                      items: currentHeaders.asMap().entries.map((e) {
                        return DropdownMenuItem(value: e.key, child: Text(e.value));
                      }).toList(),
                      onChanged: (val) => setModalState(() => mappedNameIdx = val),
                    ),
                    const SizedBox(height: 12),
                    // Map Email (Key)
                    DropdownButtonFormField<int>(
                      value: mappedEmailIdx,
                      decoration: const InputDecoration(
                        labelText: 'Map "Email (Key)" Field *',
                        border: OutlineInputBorder(),
                      ),
                      items: currentHeaders.asMap().entries.map((e) {
                        return DropdownMenuItem(value: e.key, child: Text(e.value));
                      }).toList(),
                      onChanged: (val) => setModalState(() => mappedEmailIdx = val),
                    ),
                    const SizedBox(height: 12),
                    // Map Mobile
                    DropdownButtonFormField<int>(
                      value: mappedMobileIdx,
                      decoration: const InputDecoration(
                        labelText: 'Map "Mobile" Field *',
                        border: OutlineInputBorder(),
                      ),
                      items: currentHeaders.asMap().entries.map((e) {
                        return DropdownMenuItem(value: e.key, child: Text(e.value));
                      }).toList(),
                      onChanged: (val) => setModalState(() => mappedMobileIdx = val),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Import Now'),
              ),
            ],
          );
        },
      ),
    );

    if (confirmed == true) {
      if (mappedNameIdx == null || mappedEmailIdx == null || mappedMobileIdx == null) {
        _showSnack('Mapping all three required fields (* Name, Email, Mobile) is mandatory.');
        return;
      }

      // Execute high speed import batch
      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      final dataRows = rows.sublist(headerRowIndex + 1);
      int importedCount = 0;
      int skippedCount = 0;

      for (final row in dataRows) {
        if (row.length <= mappedNameIdx! || row.length <= mappedEmailIdx! || row.length <= mappedMobileIdx!) {
          continue; // Skip malformed row
        }

        final name = row[mappedNameIdx!].trim();
        final email = row[mappedEmailIdx!].trim().toLowerCase();
        final mobile = OikonomosPhoneField.parseImportedPhone(row[mappedMobileIdx!]);

        // Validation filter
        if (name.isEmpty || email.isEmpty || !email.contains('@') || mobile.isEmpty) {
          skippedCount++;
          continue;
        }

        final payload = {
          'displayName': name,
          'mobile': mobile,
          'churchRole': 'Teacher',
          'active': true,
          'authUid': email,
          'createdAt': FieldValue.serverTimestamp(),
        };

        batch.set(_ref.doc(email), payload, SetOptions(merge: true));
        importedCount++;
      }

      try {
        await batch.commit();
        _showSnack('Successfully imported $importedCount records! (Skipped $skippedCount invalid rows).');
      } catch (e) {
        _showSnack('Bulk import transaction failed: $e');
      }
    }
  }

  // --- SUB-VIEW: Pending Join Requests Panel ---
  Widget _buildJoinRequestsPanel(BuildContext context, ThemeData theme, ColorScheme colorScheme) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('churches')
          .doc(widget.churchId)
          .collection('joinRequests')
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return const SizedBox.shrink(); // No pending requests, hide completely!
        }

        final docs = snapshot.data!.docs;

        return Card(
          margin: const EdgeInsets.only(bottom: 24),
          color: Colors.orange.shade50,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Colors.orange.shade200, width: 1.5),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.notification_important, color: Colors.orange),
                    const SizedBox(width: 10),
                    Text(
                      'Pending Servant Join Requests (${docs.length})',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Colors.orange.shade900,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: docs.length,
                  separatorBuilder: (_, __) => const Divider(height: 16),
                  itemBuilder: (context, index) {
                    final doc = docs[index];
                    final rData = doc.data();
                    final applicantName = rData['displayName'] ?? 'New Servant';
                    final applicantEmail = doc.id; // Email key

                    return Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              applicantName,
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            Text(
                              applicantEmail,
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            FilledButton.tonal(
                              style: FilledButton.styleFrom(
                                backgroundColor: Colors.green.shade100,
                                foregroundColor: Colors.green.shade900,
                              ),
                              onPressed: () => _approveJoinRequest(context, applicantName, applicantEmail),
                              child: const Text('Approve', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                            ),
                            const SizedBox(width: 8),
                            TextButton(
                              style: TextButton.styleFrom(foregroundColor: theme.colorScheme.error),
                              onPressed: () => _rejectJoinRequest(applicantEmail),
                              child: const Text('Reject', style: TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // --- ACTIONS: APPROVE & REJECT JOIN REQUESTS ---

  Future<void> _approveJoinRequest(BuildContext context, String name, String email) async {
    try {
      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      // 1. Create a Teacher (Servant) record under misters keyed by verified Email (No Country Code, No Phone Redundancy!)
      final misterRef = firestore
          .collection('churches')
          .doc(widget.churchId)
          .collection('misters')
          .doc(email);

      batch.set(misterRef, {
        'displayName': name,
        'mobile': '',
        'churchRole': 'Teacher', // Teacher by default
        'active': true, // Auto-active upon approval!
        'authUid': email,
        'createdAt': FieldValue.serverTimestamp(),
      });

      // 2. Delete their joinRequest document
      final requestRef = firestore
          .collection('churches')
          .doc(widget.churchId)
          .collection('joinRequests')
          .doc(email);

      batch.delete(requestRef);

      await batch.commit();

      _showSnack('$name approved successfully!');
    } catch (e) {
      _showSnack('Approval failed: $e');
    }
  }

  Future<void> _rejectJoinRequest(String email) async {
    try {
      await FirebaseFirestore.instance
          .collection('churches')
          .doc(widget.churchId)
          .collection('joinRequests')
          .doc(email)
          .delete();
    } catch (_) {}
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
