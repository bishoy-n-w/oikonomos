import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/translations.dart';
import '../services/app_settings.dart';

class ChurchesScreen extends StatefulWidget {
  const ChurchesScreen({super.key});

  @override
  State<ChurchesScreen> createState() => _ChurchesScreenState();
}

class _ChurchesScreenState extends State<ChurchesScreen> {
  final CollectionReference<Map<String, dynamic>> _churchesRef =
      FirebaseFirestore.instance.collection('churches');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final lang = AppSettings.language.value;

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                AppTranslation.translate('churches_config', lang),
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              FilledButton.icon(
                onPressed: () => _showAddChurchWizard(context),
                icon: const Icon(Icons.add),
                label: Text(AppTranslation.translate('add', lang)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: _churchesRef.snapshots(),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Center(child: Text('Error: ${snapshot.error}'));
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }

                final docs = snapshot.data!.docs;
                if (docs.isEmpty) {
                  return const Center(child: Text('No churches registered yet.'));
                }

                return ListView.separated(
                  itemCount: docs.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 16),
                  itemBuilder: (context, index) {
                    final doc = docs[index];
                    final data = doc.data();
                    final churchId = doc.id;
                    final displayName = data['displayName'] ?? churchId;
                    final activeYearId = data['activeAcademicYearId'] ?? '';

                    return Card(
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: colorScheme.outlineVariant),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    CircleAvatar(
                                      backgroundColor: colorScheme.primaryContainer,
                                      foregroundColor: colorScheme.onPrimaryContainer,
                                      child: const Icon(Icons.church),
                                    ),
                                    const SizedBox(width: 16),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          displayName,
                                          style: theme.textTheme.titleMedium?.copyWith(
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        Text(
                                          'ID: $churchId',
                                          style: theme.textTheme.bodySmall,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                Row(
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.edit_outlined),
                                      onPressed: () => _showEditChurchDialog(context, doc),
                                      tooltip: 'Edit Church',
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline),
                                      color: colorScheme.error,
                                      onPressed: () => _deleteChurch(context, churchId),
                                      tooltip: 'Delete Church',
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const Divider(height: 24),
                            // Expanded Academic Years Timeline section
                            _buildAcademicYearsTimeline(context, churchId, activeYearId),
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
      ),
    );
  }

  // --- SUB-VIEW: Academic Years Timeline Layout ---
  Widget _buildAcademicYearsTimeline(BuildContext context, String churchId, String activeYearId) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Theme(
      data: theme.copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        title: Row(
          children: [
            const Icon(Icons.timeline, size: 20),
            const SizedBox(width: 8),
            Text(
              'Academic Years Timeline',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: colorScheme.secondary,
              ),
            ),
          ],
        ),
        subtitle: Text(
          activeYearId.isNotEmpty ? 'Active Year: $activeYearId' : 'No active year set',
          style: theme.textTheme.bodySmall,
        ),
        children: [
          StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: _churchesRef
                .doc(churchId)
                .collection('academicYears')
                .orderBy('startDate', descending: true)
                .snapshots(),
            builder: (context, snapshot) {
              if (!snapshot.hasData) {
                return const LinearProgressIndicator();
              }
              final docs = snapshot.data!.docs;
              if (docs.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text('No academic years registered.'),
                );
              }

              return Column(
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 12.0),
                      child: TextButton.icon(
                        onPressed: () => _showAddAcademicYearDialog(context, churchId),
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Add Academic Year', style: TextStyle(fontSize: 12)),
                      ),
                    ),
                  ),
                  ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: docs.length,
                    itemBuilder: (context, index) {
                      final doc = docs[index];
                      final data = doc.data();
                      final yearId = doc.id;
                      final displayName = data['displayName'] ?? yearId;
                      final isActive = activeYearId == yearId;

                      final startVal = data['startDate'];
                      DateTime? startDate;
                      if (startVal is Timestamp) {
                        startDate = startVal.toDate();
                      }

                      final String startFormatted = startDate != null
                          ? '${_getMonthName(startDate.month)} ${startDate.year}'
                          : 'N/A';

                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Left Timeline circles and lines
                          Column(
                            children: [
                              Container(
                                width: 24,
                                height: 24,
                                decoration: BoxDecoration(
                                  color: isActive
                                      ? colorScheme.primary
                                      : colorScheme.outlineVariant,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: colorScheme.surface,
                                    width: 2,
                                  ),
                                ),
                                child: Icon(
                                  isActive ? Icons.check : Icons.circle_outlined,
                                  size: 14,
                                  color: colorScheme.surface,
                                ),
                              ),
                              if (index < docs.length - 1)
                                Container(
                                  width: 2,
                                  height: 48,
                                  color: colorScheme.outlineVariant,
                                ),
                            ],
                          ),
                          const SizedBox(width: 16),
                          // Middle text metadata
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(top: 2.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    displayName,
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.bold,
                                      color: isActive
                                          ? colorScheme.primary
                                          : colorScheme.onSurface,
                                    ),
                                  ),
                                  Text(
                                    'Starts: $startFormatted (1-Year Term)',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          // Right action buttons
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (!isActive)
                                TextButton(
                                  onPressed: () => _setActiveYear(churchId, yearId),
                                  child: const Text('Set Active', style: TextStyle(fontSize: 12)),
                                ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, size: 18),
                                color: colorScheme.error,
                                onPressed: () => _deleteAcademicYear(churchId, yearId),
                              ),
                            ],
                          ),
                        ],
                      );
                    },
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  // --- ACTIONS & DIALOGS ---

  Future<void> _showAddChurchWizard(BuildContext context) async {
    final nameController = TextEditingController();
    String selectedMonth = '9'; // September by default
    int selectedYear = DateTime.now().year;

    final years = List<int>.generate(15, (index) => DateTime.now().year - 5 + index);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Text('Create New Church & Active Year'),
          content: SizedBox(
            width: 450,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Step 1: Church Profile',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(
                      labelText: 'Church Name *',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Step 2: Initialize First Academic Year (1-Year Term)',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: selectedMonth,
                          decoration: const InputDecoration(
                            labelText: 'Start Month',
                            border: OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(value: '1', child: Text('Jan')),
                            DropdownMenuItem(value: '2', child: Text('Feb')),
                            DropdownMenuItem(value: '3', child: Text('Mar')),
                            DropdownMenuItem(value: '4', child: Text('Apr')),
                            DropdownMenuItem(value: '5', child: Text('May')),
                            DropdownMenuItem(value: '6', child: Text('Jun')),
                            DropdownMenuItem(value: '7', child: Text('Jul')),
                            DropdownMenuItem(value: '8', child: Text('Aug')),
                            DropdownMenuItem(value: '9', child: Text('Sep')),
                            DropdownMenuItem(value: '10', child: Text('Oct')),
                            DropdownMenuItem(value: '11', child: Text('Nov')),
                            DropdownMenuItem(value: '12', child: Text('Dec')),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setModalState(() => selectedMonth = val);
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<int>(
                          initialValue: selectedYear,
                          decoration: const InputDecoration(
                            labelText: 'Start Year',
                            border: OutlineInputBorder(),
                          ),
                          items: years
                              .map((y) => DropdownMenuItem(value: y, child: Text('$y')))
                              .toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setModalState(() => selectedYear = val);
                            }
                          },
                        ),
                      ),
                    ],
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
              child: const Text('Create Church'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      final name = nameController.text.trim();
      if (name.isEmpty) return;

      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      // Auto-generate Church ID
      final churchDocRef = firestore.collection('churches').doc();

      // Calculate Year ID
      final monthInt = int.parse(selectedMonth);
      final yearId = 'AY_$selectedYear';

      // Reconstruct start and end dates
      final startDate = DateTime(selectedYear, monthInt, 1);
      final endDate = DateTime(selectedYear + 1, monthInt, 1).subtract(const Duration(days: 1));

      // 1. Create Church Document
      batch.set(churchDocRef, {
        'displayName': name,
        'active': true,
        'activeAcademicYearId': yearId,
        'createdAt': FieldValue.serverTimestamp(),
      });

      // 2. Create the first Academic Year Subcollection document
      final yearDocRef = churchDocRef.collection('academicYears').doc(yearId);
      batch.set(yearDocRef, {
        'displayName': 'Academic Year $selectedYear/${selectedYear + 1}',
        'active': true,
        'startDate': Timestamp.fromDate(startDate),
        'endDate': Timestamp.fromDate(endDate),
      });

      try {
        await batch.commit();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Church and Academic Year initialized!')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Initialization failed: $e')),
          );
        }
      }
    }
  }

  Future<void> _showAddAcademicYearDialog(BuildContext context, String churchId) async {
    String selectedMonth = '9'; // Sept by default
    int selectedYear = DateTime.now().year;

    final years = List<int>.generate(15, (index) => DateTime.now().year - 5 + index);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Text('Add Academic Year (1-Year Term)'),
          content: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: selectedMonth,
                  decoration: const InputDecoration(
                    labelText: 'Start Month',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: '1', child: Text('Jan')),
                    DropdownMenuItem(value: '2', child: Text('Feb')),
                    DropdownMenuItem(value: '3', child: Text('Mar')),
                    DropdownMenuItem(value: '4', child: Text('Apr')),
                    DropdownMenuItem(value: '5', child: Text('May')),
                    DropdownMenuItem(value: '6', child: Text('Jun')),
                    DropdownMenuItem(value: '7', child: Text('Jul')),
                    DropdownMenuItem(value: '8', child: Text('Aug')),
                    DropdownMenuItem(value: '9', child: Text('Sep')),
                    DropdownMenuItem(value: '10', child: Text('Oct')),
                    DropdownMenuItem(value: '11', child: Text('Nov')),
                    DropdownMenuItem(value: '12', child: Text('Dec')),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setModalState(() => selectedMonth = val);
                    }
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<int>(
                  value: selectedYear,
                  decoration: const InputDecoration(
                    labelText: 'Start Year',
                    border: OutlineInputBorder(),
                  ),
                  items: years
                      .map((y) => DropdownMenuItem(value: y, child: Text('$y')))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setModalState(() => selectedYear = val);
                    }
                  },
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      final monthInt = int.parse(selectedMonth);
      final yearId = 'AY_$selectedYear';

      final startDate = DateTime(selectedYear, monthInt, 1);
      final endDate = DateTime(selectedYear + 1, monthInt, 1).subtract(const Duration(days: 1));

      try {
        await _churchesRef.doc(churchId).collection('academicYears').doc(yearId).set({
          'displayName': 'Academic Year $selectedYear/${selectedYear + 1}',
          'active': false,
          'startDate': Timestamp.fromDate(startDate),
          'endDate': Timestamp.fromDate(endDate),
        });
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to add year: $e')),
          );
        }
      }
    }
  }

  Future<void> _showEditChurchDialog(
    BuildContext context,
    DocumentSnapshot<Map<String, dynamic>> churchDoc,
  ) async {
    final controller = TextEditingController(text: churchDoc.data()?['displayName']);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit Church'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Church Name',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final newName = controller.text.trim();
      if (newName.isNotEmpty) {
        await _churchesRef.doc(churchDoc.id).set({
          'displayName': newName,
        }, SetOptions(merge: true));
      }
    }
  }

  Future<void> _setActiveYear(String churchId, String yearId) async {
    try {
      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      // 1. Update activeAcademicYearId in parent Church document
      batch.update(_churchesRef.doc(churchId), {
        'activeAcademicYearId': yearId,
      });

      // 2. Fetch all years to toggle active flags
      final yearsSnap = await _churchesRef.doc(churchId).collection('academicYears').get();
      for (final doc in yearsSnap.docs) {
        batch.update(doc.reference, {
          'active': doc.id == yearId,
        });
      }

      await batch.commit();
    } catch (_) {}
  }

  Future<void> _deleteChurch(BuildContext context, String churchId) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Church?'),
            content: Text('Are you sure you want to delete "$churchId" and all its structural configs?'),
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
      await _churchesRef.doc(churchId).delete();
    }
  }

  Future<void> _deleteAcademicYear(String churchId, String yearId) async {
    await _churchesRef.doc(churchId).collection('academicYears').doc(yearId).delete();
  }

  String _getMonthName(int month) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    if (month >= 1 && month <= 12) {
      return months[month - 1];
    }
    return 'N/A';
  }
}
