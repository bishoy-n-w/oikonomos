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
  final CollectionReference<Map<String, dynamic>> _churchesRef =
      FirebaseFirestore.instance.collection('churches');

  CollectionReference<Map<String, dynamic>> get _ref =>
      _churchesRef.doc(widget.churchId).collection('classes');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final lang = AppSettings.language.value;
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
              const Text(
                'Classes',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 28),
              ),
              if (isAdmin)
                FilledButton.icon(
                  onPressed: () => _showCreateEditClassDialog(context, null),
                  icon: const Icon(Icons.add),
                  label: const Text('Create Class'),
                ),
            ],
          ),
          const SizedBox(height: 24),

          // 2. Class Cards Grid Board
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
                if (classDocs.isEmpty) {
                  return const Center(child: Text('No classes registered.'));
                }

                return GridView.builder(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: MediaQuery.of(context).size.width > 1200
                        ? 3
                        : (MediaQuery.of(context).size.width > 800 ? 2 : 1),
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    childAspectRatio: 1.1,
                  ),
                  itemCount: classDocs.length,
                  itemBuilder: (context, index) {
                    final classDoc = classDocs[index];
                    final classData = classDoc.data();
                    final classId = classDoc.id;
                    final current = classData['current'] ?? {};
                    final className = current['name'] ?? classId;
                    final active = classData['active'] ?? true;

                    // Student lists (List of full names)
                    final List<String> studentNames = List<String>.from(current['currentKidIds'] ?? []);
                    // Teacher list (List of emails)
                    final List<String> servantEmails = List<String>.from(current['servantEmails'] ?? []);

                    return Card(
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(
                          color: active ? colorScheme.outlineVariant : colorScheme.error.withValues(alpha: 0.3),
                          width: active ? 1 : 1.5,
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Card Header: Class Name & Admin Edits
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Row(
                                    children: [
                                      Icon(
                                        Icons.school_outlined,
                                        color: active ? colorScheme.primary : colorScheme.error,
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          className,
                                          style: theme.textTheme.titleMedium?.copyWith(
                                            fontWeight: FontWeight.bold,
                                            color: active ? colorScheme.onSurface : colorScheme.error,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (isAdmin)
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.edit_outlined, size: 18),
                                        onPressed: () => _showCreateEditClassDialog(context, classDoc),
                                        tooltip: 'Edit Class Info',
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.delete_outline, size: 18),
                                        color: colorScheme.error,
                                        onPressed: () => _deleteClass(classId, className),
                                        tooltip: 'Delete Class',
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                            const Divider(height: 20),

                            // Section 1: Assigned Teachers (Chips)
                            Text(
                              'Assigned Teachers (${servantEmails.length})',
                              style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 6),
                            SizedBox(
                              height: 32,
                              child: servantEmails.isEmpty
                                  ? const Text('No teachers assigned.', style: TextStyle(fontSize: 12, color: Colors.grey))
                                  : ListView.separated(
                                      scrollDirection: Axis.horizontal,
                                      itemCount: servantEmails.length,
                                      separatorBuilder: (_, __) => const SizedBox(width: 6),
                                      itemBuilder: (context, idx) {
                                        return Chip(
                                          label: Text(servantEmails[idx], style: const TextStyle(fontSize: 10)),
                                          padding: EdgeInsets.zero,
                                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                          backgroundColor: colorScheme.secondaryContainer.withValues(alpha: 0.5),
                                        );
                                      },
                                    ),
                            ),
                            const SizedBox(height: 12),

                            // Section 2: Enrolled Students
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Enrolled Students (${studentNames.length})',
                                  style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.bold),
                                ),
                                if (isAdmin && studentNames.isNotEmpty)
                                  const Tooltip(
                                    message: 'Quick-move students by clicking the swap icon next to their names.',
                                    child: Icon(Icons.info_outline, size: 14, color: Colors.grey),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Expanded(
                              child: studentNames.isEmpty
                                  ? const Center(child: Text('No students enrolled yet.', style: TextStyle(fontSize: 12, color: Colors.grey)))
                                  : ListView.separated(
                                      itemCount: studentNames.length,
                                      separatorBuilder: (_, __) => const SizedBox(height: 4),
                                      itemBuilder: (context, idx) {
                                        final kidName = studentNames[idx];
                                        return Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                          decoration: BoxDecoration(
                                            color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(kidName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                              if (isAdmin)
                                                // 2-Click Quick Swapper Button!
                                                PopupMenuButton<String>(
                                                  icon: Icon(Icons.swap_horiz, size: 16, color: colorScheme.primary),
                                                  tooltip: 'Move to another Class',
                                                  onSelected: (targetClassId) =>
                                                      _moveStudentBetweenClasses(kidName, classId, targetClassId),
                                                  itemBuilder: (context) {
                                                    return classDocs
                                                        .where((doc) => doc.id != classId)
                                                        .map((doc) {
                                                      final name = doc.data()['current']?['name'] ?? doc.id;
                                                      return PopupMenuItem<String>(
                                                        value: doc.id,
                                                        child: Text('Move to: $name', style: const TextStyle(fontSize: 12)),
                                                      );
                                                    }).toList();
                                                  },
                                                ),
                                            ],
                                          ),
                                        );
                                      },
                                    ),
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
      ),
    );
  }

  // --- ACTIONS: ATOMIC QUICK-MOVE TRANSACTION ---

  Future<void> _moveStudentBetweenClasses(String kidName, String sourceClassId, String targetClassId) async {
    final firestore = FirebaseFirestore.instance;
    final batch = firestore.batch();

    final sourceRef = _ref.doc(sourceClassId);
    final targetRef = _ref.doc(targetClassId);

    try {
      // 1. Fetch current array lists
      final sourceSnap = await sourceRef.get();
      final targetSnap = await targetRef.get();

      if (!sourceSnap.exists || !targetSnap.exists) return;

      final List<String> sourceKids = List<String>.from(sourceSnap.data()?['current']?['currentKidIds'] ?? []);
      final List<String> targetKids = List<String>.from(targetSnap.data()?['current']?['currentKidIds'] ?? []);

      // 2. Perform atomic switch in arrays
      sourceKids.remove(kidName);
      if (!targetKids.contains(kidName)) {
        targetKids.add(kidName);
      }

      // 3. Batch commit to Firestore
      batch.update(sourceRef, {'current.currentKidIds': sourceKids});
      batch.update(targetRef, {'current.currentKidIds': targetKids});

      await batch.commit();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Successfully moved "$kidName" directly to Class!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Swapping student failed: $e')),
        );
      }
    }
  }

  // --- ACTIONS: CREATE & EDIT DIALOG (WITH CHIP MULTI-SELECTORS) ---

  Future<void> _showCreateEditClassDialog(
    BuildContext context,
    DocumentSnapshot<Map<String, dynamic>>? classDoc,
  ) async {
    final isEdit = classDoc != null;
    final data = classDoc?.data();
    final current = data?['current'] ?? {};
    final classId = classDoc?.id ?? '';

    final nameController = TextEditingController(text: current['name']);
    bool isActive = data?['active'] ?? true;

    // Load current arrays
    List<String> selectedKids = List<String>.from(current['currentKidIds'] ?? []);
    List<String> selectedServants = List<String>.from(current['servantEmails'] ?? []);

    final formKey = GlobalKey<FormState>();

    // Fetch lists from database for autocomplete selections
    final kidsSnap = await _churchesRef.doc(widget.churchId).collection('kids').get();
    final servantsSnap = await _churchesRef.doc(widget.churchId).collection('misters').get();
    final classesSnap = await _ref.get();

    // Map: Map each Kid's Name to their current Class Name (if any) IN THE CURRENT ACADEMIC YEAR
    final Map<String, String> kidToClassMap = {};
    final Map<String, List<String>> servantToClassesMap = {};
    for (final doc in classesSnap.docs) {
      final cYears = doc.data()['academicYears'] as Map<String, dynamic>? ?? {};
      if (!cYears.containsKey(widget.academicYearId)) continue;
      
      final cYearData = cYears[widget.academicYearId] as Map<String, dynamic>;
      final cName = cYearData['name'] ?? doc.id;
      
      // Map Kids (excluding current class)
      if (doc.id != classId) {
        final List<dynamic> kIds = cYearData['KidIds'] ?? [];
        for (final kidName in kIds) {
          kidToClassMap[kidName.toString()] = cName.toString();
        }
      }
      
      // Map Servants (including current class so we know their full load)
      final Map<String, dynamic> cMisters = cYearData['Misters'] ?? {};
      for (final email in cMisters.keys) {
        servantToClassesMap.putIfAbsent(email, () => []).add(cName.toString());
      }
    }

    // Filters for autocomplete lists
    // 1. Servant Emails
    final List<String> allServantEmails = servantsSnap.docs.map((doc) => doc.id).toList();

    // 2. Kids: A child can ONLY belong to one class at a time!
    // Therefore, filter out any child who is already enrolled in another active class.
    final List<String> unassignedKidNames = kidsSnap.docs
        .map((doc) => doc.id)
        .where((name) => !kidToClassMap.containsKey(name))
        .toList();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: Text(isEdit ? 'Modify Class Settings' : 'Create New Class Group'),
          content: SizedBox(
            width: 520,
            child: Form(
              key: formKey,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
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
                    const SizedBox(height: 20),

                    // Selector A: Servants (Teachers) Roster
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Assign Servants (Teachers)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        IconButton(
                          icon: const Icon(Icons.list_alt, size: 20),
                          tooltip: 'Open Servants Roster List',
                          onPressed: () async {
                            final List<String>? selected = await showDialog<List<String>>(
                              context: context,
                              builder: (_) => _ServantsSelectorDialog(
                                allServants: servantsSnap.docs,
                                initialSelected: selectedServants,
                                servantToClassesMap: servantToClassesMap,
                              ),
                            );
                            if (selected != null) {
                              setModalState(() {
                                selectedServants = selected;
                              });
                            }
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Autocomplete<String>(
                      optionsBuilder: (textValue) {
                        if (textValue.text.isEmpty) return const Iterable<String>.empty();
                        return allServantEmails.where((e) =>
                            e.toLowerCase().contains(textValue.text.toLowerCase()) &&
                            !selectedServants.contains(e));
                      },
                      onSelected: (email) {
                        setModalState(() {
                          selectedServants.add(email);
                        });
                      },
                      fieldViewBuilder: (context, textController, focusNode, onFieldSubmitted) {
                        // GOOGLE-STYLE INSTANT CLEARANCE logic
                        // Clear textController immediately inside onSelected
                        focusNode.addListener(() {
                          if (!focusNode.hasFocus) {
                            textController.clear();
                          }
                        });
                        return TextFormField(
                          controller: textController,
                          focusNode: focusNode,
                          onChanged: (text) {
                            // Clear input box if email fully selected
                            if (selectedServants.contains(text.trim())) {
                              textController.clear();
                            }
                          },
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            hintText: 'Type email or name to assign...',
                            prefixIcon: Icon(Icons.search, size: 20),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: selectedServants.map((email) {
                        return InputChip(
                          label: Text(email, style: const TextStyle(fontSize: 11)),
                          onDeleted: () {
                            setModalState(() {
                              selectedServants.remove(email);
                            });
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 20),

                    // Selector B: Kids (Students) Roster
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Enroll Kids (Students)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        IconButton(
                          icon: const Icon(Icons.list_alt, size: 20),
                          tooltip: 'Open Student Roster List',
                          onPressed: () async {
                            final List<String>? selected = await showDialog<List<String>>(
                              context: context,
                              builder: (_) => _KidsSelectorDialog(
                                allKids: kidsSnap.docs,
                                initialSelected: selectedKids,
                                kidToClassMap: kidToClassMap,
                              ),
                            );
                            if (selected != null) {
                              setModalState(() {
                                selectedKids = selected;
                              });
                            }
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Autocomplete<String>(
                      optionsBuilder: (textValue) {
                        if (textValue.text.isEmpty) return const Iterable<String>.empty();
                        // ONLY get kids who are NOT already assigned to any other class!
                        return unassignedKidNames.where((name) =>
                            name.toLowerCase().contains(textValue.text.toLowerCase()) &&
                            !selectedKids.contains(name));
                      },
                      onSelected: (kidName) {
                        setModalState(() {
                          selectedKids.add(kidName);
                        });
                      },
                      fieldViewBuilder: (context, textController, focusNode, onFieldSubmitted) {
                        // GOOGLE-STYLE INSTANT CLEARANCE logic
                        focusNode.addListener(() {
                          if (!focusNode.hasFocus) {
                            textController.clear();
                          }
                        });
                        return TextFormField(
                          controller: textController,
                          focusNode: focusNode,
                          onChanged: (text) {
                            if (selectedKids.contains(text.trim())) {
                              textController.clear();
                            }
                          },
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            hintText: 'Type child name to enroll...',
                            prefixIcon: Icon(Icons.search, size: 20),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: selectedKids.map((name) {
                        return InputChip(
                          label: Text(name, style: const TextStyle(fontSize: 11)),
                          onDeleted: () {
                            setModalState(() {
                              selectedKids.remove(name);
                            });
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 20),

                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Active Class'),
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
              child: const Text('Save Class'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      final className = nameController.text.trim();

      final payload = {
        'active': isActive,
        'current': {
          'name': className,
          'currentKidIds': selectedKids,
          'servantEmails': selectedServants,
        }
      };

      try {
        if (!isEdit) {
          final docRef = _ref.doc();
          await docRef.set({
            ...payload,
            'createdAt': FieldValue.serverTimestamp(),
          });
        } else {
          await _ref.doc(classDoc.id).set(payload, SetOptions(merge: true));
        }
      } catch (e) {
        _showSnack('Class save failed: $e');
      }
    }
  }

  Future<void> _deleteClass(String classId, String className) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Class?'),
            content: Text('Are you sure you want to delete "$className"? Historical student assignments will be preserved.'),
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
      await _ref.doc(classId).delete();
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}

// =============================================================================
// SUB-DIALOG 1: KidsSelectorDialog (With Multi-Select & Search Filter)
// =============================================================================
class _KidsSelectorDialog extends StatefulWidget {
  const _KidsSelectorDialog({
    required this.allKids,
    required this.initialSelected,
    required this.kidToClassMap,
  });

  final List<QueryDocumentSnapshot<Map<String, dynamic>>> allKids;
  final List<String> initialSelected;
  final Map<String, String> kidToClassMap;

  @override
  State<_KidsSelectorDialog> createState() => _KidsSelectorDialogState();
}

class _KidsSelectorDialogState extends State<_KidsSelectorDialog> {
  final List<String> _selected = [];
  String _searchQuery = '';
  String _filterStatus = 'all'; // 'all', 'unassigned'

  @override
  void initState() {
    super.initState();
    _selected.addAll(widget.initialSelected);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    // Filter roster lists
    final filteredKids = widget.allKids.where((doc) {
      final name = doc.id;
      final currentClass = widget.kidToClassMap[name] ?? '';
      
      final matchesSearch = name.toLowerCase().contains(_searchQuery.toLowerCase().trim());
      
      if (_filterStatus == 'unassigned') {
        return matchesSearch && currentClass.isEmpty;
      }
      return matchesSearch;
    }).toList();

    return AlertDialog(
      title: const Text('Enroll Kids (Students) Roster Selector'),
      content: SizedBox(
        width: 600,
        height: 500,
        child: Column(
          children: [
            // Row search & filters
            Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(
                      labelText: 'Search Kid Name',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (text) => setState(() => _searchQuery = text),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    border: Border.all(color: colorScheme.outline),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _filterStatus,
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('All Kids', style: TextStyle(fontSize: 13))),
                        DropdownMenuItem(value: 'unassigned', child: Text('Unassigned Only', style: TextStyle(fontSize: 13))),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _filterStatus = val);
                        }
                      },
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Scrollable Student Table
            Expanded(
              child: Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(color: colorScheme.outlineVariant),
                ),
                clipBehavior: Clip.antiAlias,
                child: ListView.separated(
                  itemCount: filteredKids.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final doc = filteredKids[index];
                    final kidName = doc.id;
                    final currentClass = widget.kidToClassMap[kidName] ?? '';
                    final isChecked = _selected.contains(kidName);
                    final isEnrolledHere = widget.initialSelected.contains(kidName);
                    final isAssignedToOther = currentClass.isNotEmpty && !isEnrolledHere;

                    return ListTile(
                      dense: true,
                      leading: Checkbox(
                        value: isChecked,
                        // Block selection if child is already assigned to a DIFFERENT class!
                        onChanged: isAssignedToOther
                            ? null
                            : (val) {
                                setState(() {
                                  if (val == true) {
                                    _selected.add(kidName);
                                  } else {
                                    _selected.remove(kidName);
                                  }
                                });
                              },
                      ),
                      title: Text(
                        kidName,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: isAssignedToOther ? Colors.grey : colorScheme.onSurface,
                        ),
                      ),
                      subtitle: Text(
                        isAssignedToOther
                            ? 'Enrolled: $currentClass'
                            : (isEnrolledHere ? 'Enrolled in this Class' : 'Unassigned (Available)'),
                        style: TextStyle(
                          fontSize: 11,
                          color: isAssignedToOther
                              ? Colors.red
                              : (isEnrolledHere ? colorScheme.primary : Colors.green),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _selected),
          child: Text('Add Selected (${_selected.length})'),
        ),
      ],
    );
  }
}

// =============================================================================
// SUB-DIALOG 2: ServantsSelectorDialog (With Multi-Select & Search Filter)
// =============================================================================
class _ServantsSelectorDialog extends StatefulWidget {
  const _ServantsSelectorDialog({
    required this.allServants,
    required this.initialSelected,
    required this.servantToClassesMap,
  });

  final List<QueryDocumentSnapshot<Map<String, dynamic>>> allServants;
  final List<String> initialSelected;
  final Map<String, List<String>> servantToClassesMap;

  @override
  State<_ServantsSelectorDialog> createState() => _ServantsSelectorDialogState();
}

class _ServantsSelectorDialogState extends State<_ServantsSelectorDialog> {
  final List<String> _selected = [];
  String _searchQuery = '';
  String _filterStatus = 'all'; // 'all', 'unassigned'

  @override
  void initState() {
    super.initState();
    _selected.addAll(widget.initialSelected);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    // Filter servants lists
    final filteredServants = widget.allServants.where((doc) {
      final email = doc.id;
      final assignedClasses = widget.servantToClassesMap[email] ?? [];
      final name = (doc.data()['displayName'] ?? '').toString();
      
      final matchesSearch = name.toLowerCase().contains(_searchQuery.toLowerCase().trim()) ||
          email.toLowerCase().contains(_searchQuery.toLowerCase().trim());
      
      if (_filterStatus == 'unassigned') {
        return matchesSearch && assignedClasses.isEmpty;
      }
      return matchesSearch;
    }).toList();

    return AlertDialog(
      title: const Text('Assign Servants (Teachers) Roster Selector'),
      content: SizedBox(
        width: 600,
        height: 500,
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(
                      labelText: 'Search Name or Email',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (text) => setState(() => _searchQuery = text),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    border: Border.all(color: colorScheme.outline),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _filterStatus,
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('All Servants', style: TextStyle(fontSize: 13))),
                        DropdownMenuItem(value: 'unassigned', child: Text('Unassigned Only', style: TextStyle(fontSize: 13))),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _filterStatus = val);
                        }
                      },
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Scrollable Servants list
            Expanded(
              child: Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(color: colorScheme.outlineVariant),
                ),
                clipBehavior: Clip.antiAlias,
                child: ListView.separated(
                  itemCount: filteredServants.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final doc = filteredServants[index];
                    final email = doc.id;
                    final displayName = doc.data()['displayName'] ?? 'Servant';
                    final assignedClasses = widget.servantToClassesMap[email] ?? [];
                    final isChecked = _selected.contains(email);

                    return ListTile(
                      dense: true,
                      leading: Checkbox(
                        value: isChecked,
                        onChanged: (val) {
                          setState(() {
                            if (val == true) {
                              _selected.add(email);
                            } else {
                              _selected.remove(email);
                            }
                          });
                        },
                      ),
                      title: Text(displayName, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(email, style: theme.textTheme.bodySmall),
                          const SizedBox(height: 2),
                          Text(
                            assignedClasses.isNotEmpty
                                ? 'Assigned to: ${assignedClasses.join(", ")}'
                                : 'Unassigned (Available)',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: assignedClasses.isNotEmpty ? colorScheme.primary : Colors.green,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _selected),
          child: Text('Assign Selected (${_selected.length})'),
        ),
      ],
    );
  }
}
