import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:excel/excel.dart';
import 'package:flutter/material.dart';
import '../widgets/phone_field.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';
import '../services/file_service.dart';

class KidsDirectoryScreen extends StatefulWidget {
  const KidsDirectoryScreen({required this.churchId, super.key});

  final String churchId;

  @override
  State<KidsDirectoryScreen> createState() => _KidsDirectoryScreenState();
}

class _KidsDirectoryScreenState extends State<KidsDirectoryScreen> {
  final Map<String, bool> _selectedRows = {};
  String _searchQuery = '';

  final CollectionReference<Map<String, dynamic>> _churchesRef =
      FirebaseFirestore.instance.collection('churches');

  CollectionReference<Map<String, dynamic>> get _ref =>
      _churchesRef.doc(widget.churchId).collection('kids');

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
          // Filter student list by search query
          final filteredDocs = docs.where((doc) {
            final data = doc.data();
            final current = data['current'] ?? {};
            
            final name = doc.id.toLowerCase(); // Full Name is the Document ID!
            final school = (current['school'] ?? '').toString().toLowerCase();
            final address = (current['addressArea'] ?? '').toString().toLowerCase();
            final fatherMobile = (current['fatherMobile'] ?? '').toString();
            final motherMobile = (current['motherMobile'] ?? '').toString();
            final query = _searchQuery.toLowerCase().trim();

            return name.contains(query) ||
                school.contains(query) ||
                address.contains(query) ||
                fatherMobile.contains(query) ||
                motherMobile.contains(query);
          }).toList();

          final selectedCount = _selectedRows.values.where((v) => v).length;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Title & Action Buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    AppTranslation.translate('kids', lang),
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
                    ? const Center(child: Text('No students registered.'))
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
                                  columns: const [
                                    DataColumn(label: Text('Select')),
                                    DataColumn(label: Text('Photo')),
                                    DataColumn(label: Text('Full Name (Key)')),
                                    DataColumn(label: Text('Gender')),
                                    DataColumn(label: Text('Birthday')),
                                    DataColumn(label: Text('Father of Confession')),
                                    DataColumn(label: Text('Father Mobile')),
                                    DataColumn(label: Text('Mother Mobile')),
                                    DataColumn(label: Text('Area')),
                                    DataColumn(label: Text('Actions')),
                                  ],
                                  rows: filteredDocs.map((doc) {
                                    final data = doc.data();
                                    final kidNameId = doc.id; // Full Name Key
                                    final current = data['current'] ?? {};
                                    final gender = current['gender'] ?? 'M';
                                    final confession = current['confessionFather'] ?? '';
                                    final fMobile = current['fatherMobile'] ?? '';
                                    final fCode = current['fatherMobileCode'] ?? '';
                                    final mMobile = current['motherMobile'] ?? '';
                                    final mCode = current['motherMobileCode'] ?? '';
                                    final area = current['addressArea'] ?? '';
                                    final photoBase64 = current['photoBase64']?.toString() ?? '';

                                    final dobVal = current['dob'];
                                    DateTime? dob;
                                    if (dobVal is Timestamp) dob = dobVal.toDate();

                                    final isChecked = _selectedRows[kidNameId] ?? false;

                                    return DataRow(
                                      selected: isChecked,
                                      cells: [
                                        DataCell(
                                          Checkbox(
                                            value: isChecked,
                                            onChanged: (val) {
                                              setState(() {
                                                _selectedRows[kidNameId] = val ?? false;
                                              });
                                            },
                                          ),
                                        ),
                                        // Image circular container
                                        DataCell(
                                          CircleAvatar(
                                            radius: 18,
                                            backgroundImage: photoBase64.isNotEmpty
                                                ? MemoryImage(const Base64Decoder().convert(photoBase64.split(',').last))
                                                : null,
                                            backgroundColor: gender == 'F'
                                                ? Colors.pink.shade50
                                                : Colors.blue.shade50,
                                            child: photoBase64.isEmpty
                                                ? Icon(
                                                    gender == 'F' ? Icons.girl : Icons.boy,
                                                    size: 18,
                                                    color: gender == 'F' ? Colors.pink : Colors.blue,
                                                  )
                                                : null,
                                          ),
                                        ),
                                        DataCell(Text(kidNameId, style: const TextStyle(fontWeight: FontWeight.bold))),
                                        DataCell(Text(gender)),
                                        DataCell(Text(dob != null ? dob.toLocal().toString().substring(0, 10) : 'N/A')),
                                        DataCell(Text(confession)),
                                        DataCell(Text(fMobile.isNotEmpty ? '$fCode $fMobile' : '')),
                                        DataCell(Text(mMobile.isNotEmpty ? '$mCode $mMobile' : '')),
                                        DataCell(Text(area)),
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
                                                onPressed: () => _deleteSingle(context, kidNameId),
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
      // CSV Headers
      csvLines.add('Full Name,Gender,Birthday,School,Father of Confession,Street,Building,Floor,Apartment,Area,Home Tele,Father Mobile,Mother Mobile');

      for (final doc in docs) {
        if (_selectedRows[doc.id] == true) {
          final data = doc.data()!;
          final current = data['current'] ?? {};
          final name = doc.id;
          final gender = current['gender'] ?? 'M';
          final school = current['school'] ?? '';
          final confession = current['confessionFather'] ?? '';
          final street = current['addressStreet'] ?? '';
          final bld = current['addressBuilding'] ?? '';
          final flr = current['addressFloor'] ?? '';
          final apt = current['addressApartment'] ?? '';
          final area = current['addressArea'] ?? '';
          final homeTel = current['homeTele'] ?? '';
          final rawFMobile = current['fatherMobile'] ?? '';
          final String fMobile = rawFMobile.toString().isNotEmpty
              ? (rawFMobile.toString().startsWith('+') ? '\t$rawFMobile' : '\t+$rawFMobile')
              : '';

          final rawMMobile = current['motherMobile'] ?? '';
          final String mMobile = rawMMobile.toString().isNotEmpty
              ? (rawMMobile.toString().startsWith('+') ? '\t$rawMMobile' : '\t+$rawMMobile')
              : '';

          final dobVal = current['dob'];
          DateTime? dob;
          if (dobVal is Timestamp) dob = dobVal.toDate();
          final dobStr = dob != null ? dob.toLocal().toString().substring(0, 10) : '';

          csvLines.add('"$name","$gender","$dobStr","$school","$confession","$street","$bld","$flr","$apt","$area","$homeTel","$fMobile","$mMobile"');
        }
      }

      final csvContent = csvLines.join('\n');
      FileService.saveFile(
        content: csvContent,
        fileName: 'Oikonomos_Students_Roster.csv',
      );

      _showSnack('Roster exported successfully!');
    } catch (e) {
      _showSnack('CSV Export failed: $e');
    }
  }

  Future<void> _deleteSingle(BuildContext context, String kidNameId) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Student?'),
            content: Text('Are you sure you want to delete student "$kidNameId"? This cannot be undone.'),
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
      await _ref.doc(kidNameId).delete();
    }
  }

  Future<void> _deleteSelected(List<DocumentSnapshot<Map<String, dynamic>>> docs) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Selected Students?'),
            content: const Text('Are you sure you want to delete all checked student records? This cannot be undone.'),
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
      });
    }
  }

  // --- CRM EDIT & ADD SINGLE DIALOG ---

  Future<void> _showAddEditDialog(
    BuildContext context,
    DocumentSnapshot<Map<String, dynamic>>? doc,
  ) async {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final isEdit = doc != null;
    final current = doc?.data()?['current'] ?? {};

    // Form controllers
    final nameController = TextEditingController(text: doc?.id);
    final schoolController = TextEditingController(text: current['school']);
    final confessionController = TextEditingController(text: current['confessionFather']);

    // Address sub-controllers
    final streetController = TextEditingController(text: current['addressStreet']);
    final bldController = TextEditingController(text: current['addressBuilding']);
    final flrController = TextEditingController(text: current['addressFloor']);
    final aptController = TextEditingController(text: current['addressApartment']);
    final areaController = TextEditingController(text: current['addressArea']);

    // Phone sub-controllers
    final homeTelController = TextEditingController(text: current['homeTele']);
    final kidMobileController = TextEditingController(text: current['kidMobile']);
    final fNameController = TextEditingController(text: current['fatherName']);
    final fMobileController = TextEditingController(text: current['fatherMobile']);
    final fJobController = TextEditingController(text: current['fatherJob']);
    final mNameController = TextEditingController(text: current['motherName']);
    final mMobileController = TextEditingController(text: current['motherMobile']);
    final mJobController = TextEditingController(text: current['motherJob']);
    final otherMobileController = TextEditingController(text: (current['otherMobiles'] is List) ? (current['otherMobiles'] as List).join(', ') : '');

    final notesController = TextEditingController(text: current['notes']);

    // State properties
    String selectedGender = current['gender'] ?? 'M';
    String? photoBase64 = current['photoBase64'];
    DateTime? selectedDob;
    final dobVal = current['dob'];
    if (dobVal is Timestamp) selectedDob = dobVal.toDate();

    String kidCode = current['kidMobileCode'] ?? '+1';
    String fatherCode = current['fatherMobileCode'] ?? '+1';
    String motherCode = current['motherMobileCode'] ?? '+1';

    final formKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: Text(isEdit ? 'Edit Student Profile' : 'Onboard New Student'),
          content: SizedBox(
            width: 580,
            child: Form(
              key: formKey,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // --- SECTION 1: General Profile ---
                    ExpansionTile(
                      initiallyExpanded: true,
                      title: const Text('1. General Student Profile', style: TextStyle(fontWeight: FontWeight.bold)),
                      children: [
                        Row(
                          children: [
                            // Photo Picker with automatic Base64 Compressor
                            InkWell(
                              onTap: () async {
                                FileService.pickFile(
                                  allowedExtensions: 'image/*',
                                  onPicked: (AppFile file) async {
                                    try {
                                      final compressed = await FileService.compressImage(file);
                                      setModalState(() => photoBase64 = compressed);
                                    } catch (e) {
                                      _showSnack('Compression failed: $e');
                                    }
                                  },
                                );
                              },
                              child: CircleAvatar(
                                radius: 36,
                                backgroundImage: photoBase64 != null && photoBase64!.isNotEmpty
                                    ? MemoryImage(const Base64Decoder().convert(photoBase64!.split(',').last))
                                    : null,
                                backgroundColor: colorScheme.surfaceContainerHigh,
                                child: photoBase64 == null
                                    ? const Icon(Icons.add_a_photo_outlined, size: 24)
                                    : null,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                children: [
                                  TextFormField(
                                    controller: nameController,
                                    enabled: !isEdit, // Key!
                                    decoration: const InputDecoration(
                                      labelText: 'Full Name (Name is Key) *',
                                      border: OutlineInputBorder(),
                                    ),
                                    validator: (value) {
                                      if (value == null || value.trim().isEmpty) {
                                        return 'Full name is required';
                                      }
                                      return null;
                                    },
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                initialValue: selectedGender,
                                decoration: const InputDecoration(
                                  labelText: 'Gender',
                                  border: OutlineInputBorder(),
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'M', child: Text('Male')),
                                  DropdownMenuItem(value: 'F', child: Text('Female')),
                                ],
                                onChanged: (val) {
                                  if (val != null) {
                                    setModalState(() => selectedGender = val);
                                  }
                                },
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(double.infinity, 54),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                ),
                                onPressed: () async {
                                  final picked = await showDatePicker(
                                    context: context,
                                    initialDate: selectedDob ?? DateTime(2015),
                                    firstDate: DateTime(1900),
                                    lastDate: DateTime.now(),
                                  );
                                  if (picked != null) {
                                    setModalState(() => selectedDob = picked);
                                  }
                                },
                                icon: const Icon(Icons.cake_outlined),
                                label: Text(
                                  selectedDob != null
                                      ? selectedDob!.toLocal().toString().substring(0, 10)
                                      : 'Select Birthday',
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
                                controller: schoolController,
                                decoration: const InputDecoration(
                                  labelText: 'School Details',
                                  border: OutlineInputBorder(),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: confessionController,
                                decoration: const InputDecoration(
                                  labelText: 'Father of Confession',
                                  border: OutlineInputBorder(),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    // --- SECTION 2: Home Address ---
                    ExpansionTile(
                      title: const Text('2. Home Address Details', style: TextStyle(fontWeight: FontWeight.bold)),
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
                              flex: 2,
                              child: TextFormField(
                                controller: bldController,
                                decoration: const InputDecoration(
                                  labelText: 'Bld Name/No',
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
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextFormField(
                                controller: areaController,
                                decoration: const InputDecoration(
                                  labelText: 'Area / City',
                                  border: OutlineInputBorder(),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    // --- SECTION 3: Parent Contacts & Mobiles ---
                    ExpansionTile(
                      title: const Text('3. Pastoral & Family Contacts', style: TextStyle(fontWeight: FontWeight.bold)),
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: homeTelController,
                                keyboardType: TextInputType.phone,
                                decoration: const InputDecoration(
                                  labelText: 'Home Telephone',
                                  border: OutlineInputBorder(),
                                ),
                                validator: (value) {
                                  if (value == null || value.trim().isEmpty) return null;
                                  final digits = value.replaceAll(RegExp(r'\D'), '');
                                  if (digits.length < 5 || digits.length > 15) {
                                    return 'Must be 5-15 digits';
                                  }
                                  return null;
                                },
                              ),
                            ),
                            Expanded(
                              child: OikonomosPhoneField(
                                initialValue: kidMobileController.text,
                                labelText: 'Kid Mobile',
                                onChanged: (e164Value) {
                                  setModalState(() {
                                    kidMobileController.text = e164Value;
                                  });
                                },
                              ),
                            ),
                          ],
                        ),
                        const Divider(height: 24),
                        // Father Contacts
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: fNameController,
                                decoration: const InputDecoration(
                                  labelText: 'Father Full Name',
                                  border: OutlineInputBorder(),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextFormField(
                                controller: fJobController,
                                decoration: const InputDecoration(
                                  labelText: 'Father Profession',
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
                              child: OikonomosPhoneField(
                                initialValue: fMobileController.text,
                                labelText: 'Father Mobile',
                                onChanged: (e164Value) {
                                  setModalState(() {
                                    fMobileController.text = e164Value;
                                  });
                                },
                              ),
                            ),
                          ],
                        ),
                        const Divider(height: 24),
                        // Mother Contacts
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: mNameController,
                                decoration: const InputDecoration(
                                  labelText: 'Mother Full Name',
                                  border: OutlineInputBorder(),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextFormField(
                                controller: mJobController,
                                decoration: const InputDecoration(
                                  labelText: 'Mother Profession',
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
                              child: OikonomosPhoneField(
                                initialValue: mMobileController.text,
                                labelText: 'Mother Mobile',
                                onChanged: (e164Value) {
                                  setModalState(() {
                                    mMobileController.text = e164Value;
                                  });
                                },
                              ),
                            ),
                          ],
                        ),
                        const Divider(height: 24),
                        TextFormField(
                          controller: otherMobileController,
                          decoration: const InputDecoration(
                            labelText: 'Other Mobiles (comma separated list)',
                            border: OutlineInputBorder(),
                            hintText: 'e.g. +2012345, +1437633',
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) return null;
                            final list = value.split(',');
                            for (final item in list) {
                              final digits = item.trim().replaceAll(RegExp(r'\D'), '');
                              if (digits.isNotEmpty && (digits.length < 7 || digits.length > 15)) {
                                return 'Each phone number must be 7-15 digits';
                              }
                            }
                            return null;
                          },
                        ),
                      ],
                    ),

                    // --- SECTION 4: Pastoral Notes ---
                    ExpansionTile(
                      title: const Text('4. Additional Notes', style: TextStyle(fontWeight: FontWeight.bold)),
                      children: [
                        TextFormField(
                          controller: notesController,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: 'Pastoral notes / medical conditions / warnings',
                            border: OutlineInputBorder(),
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
              child: const Text('Save Profile'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      final name = nameController.text.trim();
      if (name.isEmpty) {
        _showSnack('Full Name is a mandatory field.');
        return;
      }

      // Pack clean numbers
      String stripPhone(String num) => num.replaceAll(RegExp(r'\D'), '');

      final otherMobiles = otherMobileController.text
          .split(',')
          .map((e) => e.trim().replaceAll(RegExp(r'\D'), ''))
          .where((e) => e.isNotEmpty)
          .toList();

      final currentMap = {
        'fullName': name,
        'gender': selectedGender,
        'photoBase64': photoBase64 ?? '',
        'dob': selectedDob != null ? Timestamp.fromDate(selectedDob!.toUtc()) : null,
        'school': schoolController.text.trim(),
        'confessionFather': confessionController.text.trim(),
        // Address Maps
        'addressStreet': streetController.text.trim(),
        'addressBuilding': bldController.text.trim(),
        'addressFloor': flrController.text.trim(),
        'addressApartment': aptController.text.trim(),
        'addressArea': areaController.text.trim(),
        // Contact Phones
        'homeTele': stripPhone(homeTelController.text),
        'kidMobile': stripPhone(kidMobileController.text),
        'kidMobileCode': kidCode,
        'fatherName': fNameController.text.trim(),
        'fatherMobile': stripPhone(fMobileController.text),
        'fatherMobileCode': fatherCode,
        'fatherJob': fJobController.text.trim(),
        'motherName': mNameController.text.trim(),
        'motherMobile': stripPhone(mMobileController.text),
        'motherMobileCode': motherCode,
        'motherJob': mJobController.text.trim(),
        'otherMobiles': otherMobiles,
        'notes': notesController.text.trim(),
      };

      try {
        final firestore = FirebaseFirestore.instance;
        final batch = firestore.batch();

        if (!isEdit) {
          // Check Key uniqueness
          final existing = await _ref.doc(name).get();
          if (existing.exists) {
            _showSnack('A child with this full name is already registered!');
            return;
          }
          
          batch.set(_ref.doc(name), {
            'active': true,
            'current': currentMap,
            'createdAt': FieldValue.serverTimestamp(),
          });
        } else {
          batch.set(_ref.doc(name), {
            'current': currentMap,
          }, SetOptions(merge: true));
        }

        await batch.commit();
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
    int? mappedGenderIdx;
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
                            // Reset mappings
                            mappedNameIdx = null;
                            mappedGenderIdx = null;
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
                    // Map Name
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
                    // Map Gender
                    DropdownButtonFormField<int>(
                      value: mappedGenderIdx,
                      decoration: const InputDecoration(
                        labelText: 'Map "Gender" Field',
                        border: OutlineInputBorder(),
                      ),
                      items: currentHeaders.asMap().entries.map((e) {
                        return DropdownMenuItem(value: e.key, child: Text(e.value));
                      }).toList(),
                      onChanged: (val) => setModalState(() => mappedGenderIdx = val),
                    ),
                    const SizedBox(height: 12),
                    // Map Mobile
                    DropdownButtonFormField<int>(
                      value: mappedMobileIdx,
                      decoration: const InputDecoration(
                        labelText: 'Map "Parent Mobile" Field',
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
      if (mappedNameIdx == null) {
        _showSnack('Mapping "Full Name" (The unique primary key) is mandatory.');
        return;
      }

      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      final dataRows = rows.sublist(headerRowIndex + 1);
      int importedCount = 0;
      int skippedCount = 0;

      for (final row in dataRows) {
        if (row.length <= mappedNameIdx!) continue;

        final name = row[mappedNameIdx!].trim();
        if (name.isEmpty) {
          skippedCount++;
          continue;
        }

        // Optional Gender resolution
        String gender = 'M';
        if (mappedGenderIdx != null && row.length > mappedGenderIdx!) {
          final rawGen = row[mappedGenderIdx!].trim().toUpperCase();
          if (rawGen.startsWith('F') || rawGen.contains('GIRL') || rawGen == 'أنثى') {
            gender = 'F';
          }
        }

        // Optional Parent Mobile resolution
        String mobile = '';
        if (mappedMobileIdx != null && row.length > mappedMobileIdx!) {
          mobile = OikonomosPhoneField.parseImportedPhone(row[mappedMobileIdx!]);
        }

        final currentMap = {
          'fullName': name,
          'gender': gender,
          'photoBase64': '',
          'dob': null,
          'school': '',
          'confessionFather': '',
          'addressStreet': '',
          'addressBuilding': '',
          'addressFloor': '',
          'addressApartment': '',
          'addressArea': '',
          'homeTele': '',
          'kidMobile': '',
          'kidMobileCode': '+1',
          'fatherName': '',
          'fatherMobile': mobile,
          'fatherMobileCode': '+1',
          'fatherJob': '',
          'motherName': '',
          'motherMobile': '',
          'motherMobileCode': '+1',
          'motherJob': '',
          'otherMobiles': <String>[],
          'notes': 'Imported via Excel sheet.',
        };

        batch.set(_ref.doc(name), {
          'active': true,
          'current': currentMap,
          'createdAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));

        importedCount++;
      }

      try {
        await batch.commit();
        _showSnack('Successfully imported $importedCount children! (Skipped $skippedCount empty names).');
      } catch (e) {
        _showSnack('Bulk import transaction failed: $e');
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
