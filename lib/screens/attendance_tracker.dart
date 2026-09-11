// ignore_for_file: unnecessary_underscores, deprecated_member_use, use_build_context_synchronously
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';

class AttendanceTrackerScreen extends StatefulWidget {
  const AttendanceTrackerScreen({
    required this.churchId,
    required this.academicYearId,
    required this.classId,
    required this.serviceGroupId,
    super.key,
  });

  final String churchId;
  final String academicYearId;
  final String classId;
  final String serviceGroupId;

  @override
  State<AttendanceTrackerScreen> createState() => _AttendanceTrackerScreenState();
}

class _AttendanceTrackerScreenState extends State<AttendanceTrackerScreen> {
  bool _isTakingAttendance = false;
  String? _editingEventId;

  // Current Form state
  final _titleController = TextEditingController(text: 'Sunday School');
  DateTime _eventDate = DateTime.now();
  String _eventType = 'Sunday School';

  // Active taking attendance map state
  Map<String, String> _statuses = {}; // kidId -> 'present' | 'absent' | 'excused'
  Map<String, String> _notesByKid = {}; // kidId -> note text

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  // Attendance Events live under the specific selected class
  CollectionReference<Map<String, dynamic>> get _eventsRef =>
      FirebaseFirestore.instance
          .collection('churches')
          .doc(widget.churchId)
          .collection('classes')
          .doc(widget.classId)
          .collection('attendanceEvents');

  CollectionReference<Map<String, dynamic>> get _kidsRef =>
      FirebaseFirestore.instance
          .collection('churches')
          .doc(widget.churchId)
          .collection('kids');

  DocumentReference<Map<String, dynamic>> get _classRef =>
      FirebaseFirestore.instance
          .collection('churches')
          .doc(widget.churchId)
          .collection('classes')
          .doc(widget.classId);

  @override
  Widget build(BuildContext context) {
    final lang = AppSettings.language.value;

    if (widget.churchId.isEmpty || widget.academicYearId.isEmpty) {
      return Center(
        child: Text(AppTranslation.translate('church', lang)),
      );
    }

    if (widget.classId.isEmpty) {
      return Center(
        child: Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
          ),
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.filter_list_alt, size: 64, color: Theme.of(context).colorScheme.outlineVariant),
                const SizedBox(height: 16),
                Text(
                  'Select a Class Group',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Please select a specific Class in the top-right filters\nto log or view classroom attendance logs.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_isTakingAttendance) {
      return _buildAttendanceSheet();
    }

    return _buildEventsList();
  }

  // --- VIEW 1: Attendance Events History List ---
  Widget _buildEventsList() {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Attendance Logs',
                style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              FilledButton.icon(
                onPressed: () => _startNewEvent(null),
                icon: const Icon(Icons.add),
                label: const Text('New Attendance Event'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: _eventsRef
                  .where('academicYearId', isEqualTo: widget.academicYearId)
                  .orderBy('eventDate', descending: true)
                  .snapshots(),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Center(child: Text('Error: ${snapshot.error}'));
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }

                final docs = snapshot.data!.docs;
                if (docs.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.co_present, size: 64, color: colorScheme.outlineVariant),
                        const SizedBox(height: 16),
                        Text(
                          'No attendance logs recorded yet.',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => _startNewEvent(null),
                          child: const Text('Record your first event'),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  itemCount: docs.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final doc = docs[index];
                    final data = doc.data();
                    final title = data['title'] ?? 'Sunday School';
                    final dateVal = data['eventDate'];
                    DateTime? parsedDate;
                    if (dateVal is Timestamp) {
                      parsedDate = dateVal.toDate();
                    }

                    final Map<String, dynamic> statuses =
                        Map<String, dynamic>.from(data['statuses'] ?? {});
                    final total = statuses.length;
                    final presents =
                        statuses.values.where((v) => v == 'present').length;

                    return Card(
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: colorScheme.outlineVariant),
                      ),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        leading: CircleAvatar(
                          backgroundColor: colorScheme.primaryContainer,
                          foregroundColor: colorScheme.onPrimaryContainer,
                          child: const Icon(Icons.class_),
                        ),
                        title: Text(
                          title,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4.0),
                          key: ValueKey(doc.id),
                          child: Text(
                            'Date: ${parsedDate?.toLocal().toString().substring(0, 10) ?? 'N/A'}  •  Enrolled: $total  •  Presents: $presents',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.edit),
                              tooltip: 'Edit Attendance',
                              onPressed: () => _startNewEvent(doc),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline),
                              color: colorScheme.error,
                              tooltip: 'Delete Event',
                              onPressed: () => _deleteEvent(doc.id),
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

  // --- VIEW 2: Interactive Attendance Sheet Checklist ---
  Widget _buildAttendanceSheet() {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(
      children: [
        // Event Header Bar
        Container(
          padding: const EdgeInsets.all(20),
          color: colorScheme.surfaceContainerLow,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back),
                    onPressed: () => setState(() => _isTakingAttendance = false),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _editingEventId == null
                        ? 'New Attendance Event'
                        : 'Edit Attendance Log',
                    style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const Spacer(),
                  FilledButton.icon(
                    onPressed: _saveAttendance,
                    icon: const Icon(Icons.save),
                    label: const Text('Save Log'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 16,
                runSpacing: 16,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  SizedBox(
                    width: 240,
                    child: TextField(
                      controller: _titleController,
                      decoration: const InputDecoration(
                        labelText: 'Event Title',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  InkWell(
                    onTap: _pickEventDate,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        border: Border.all(color: colorScheme.outline),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.calendar_month, size: 18),
                          const SizedBox(width: 8),
                          Text(
                            _eventDate.toLocal().toString().substring(0, 10),
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        // Interactive Roster Checklist (Only fetch Class Enrolled KidIds!)
        Expanded(
          child: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
            stream: _classRef.snapshots(),
            builder: (context, classSnapshot) {
              if (classSnapshot.hasError) {
                return Center(child: Text('Error: ${classSnapshot.error}'));
              }
              if (!classSnapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }

              final classData = classSnapshot.data!.data();
              final yearsMap = classData?['academicYears'] as Map<String, dynamic>? ?? {};
              final yearData = yearsMap[widget.academicYearId] as Map<String, dynamic>? ?? {};
              final List<String> enrolledKidIds = List<String>.from(yearData['KidIds'] ?? []);

              if (enrolledKidIds.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32.0),
                    child: Text('No students are currently enrolled in this class for the active academic year.\nGo to the Classes Kanban board to enroll students.', textAlign: TextAlign.center),
                  ),
                );
              }

              // Load all active kids, then filter locally for class roster
              return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: _kidsRef.where('active', isEqualTo: true).snapshots(),
                builder: (context, kidsSnapshot) {
                  if (kidsSnapshot.hasError) {
                    return Center(child: Text('Error: ${kidsSnapshot.error}'));
                  }
                  if (!kidsSnapshot.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  // Keep only kids listed in the class's current term roster
                  final kidsDocs = kidsSnapshot.data!.docs
                      .where((doc) => enrolledKidIds.contains(doc.id))
                      .toList();

                  if (kidsDocs.isEmpty) {
                    return const Center(child: Text('Class students not found or archived in Kids Directory.'));
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.all(24),
                    itemCount: kidsDocs.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final doc = kidsDocs[index];
                      final kidId = doc.id;
                      final current = doc.data()['current'] ?? {};
                      final fullName = current['fullName'] ?? kidId;
                      final area = current['addressArea'] ?? 'N/A';

                      final status = _statuses[kidId] ?? 'absent';
                      final note = _notesByKid[kidId] ?? '';

                      return Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: status == 'present'
                                ? Colors.green.shade300
                                : (status == 'excused' ? Colors.orange.shade300 : colorScheme.outlineVariant),
                          ),
                        ),
                        color: status == 'present'
                            ? Colors.green.shade50
                            : (status == 'excused' ? Colors.orange.shade50 : null),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      fullName,
                                      style: theme.textTheme.titleMedium?.copyWith(
                                        fontWeight: FontWeight.bold,
                                        color: status == 'present' ? Colors.green.shade900 : null,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text('Area: $area', style: theme.textTheme.bodySmall),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                flex: 4,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    _buildStatusChip(
                                      label: 'Present',
                                      selected: status == 'present',
                                      color: Colors.green,
                                      onTap: () => setState(() => _statuses[kidId] = 'present'),
                                    ),
                                    const SizedBox(width: 8),
                                    _buildStatusChip(
                                      label: 'Absent',
                                      selected: status == 'absent',
                                      color: Colors.red,
                                      onTap: () => setState(() => _statuses[kidId] = 'absent'),
                                    ),
                                    const SizedBox(width: 8),
                                    _buildStatusChip(
                                      label: 'Excused',
                                      selected: status == 'excused',
                                      color: Colors.orange,
                                      onTap: () => setState(() => _statuses[kidId] = 'excused'),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              IconButton(
                                icon: Icon(note.isNotEmpty ? Icons.comment : Icons.comment_outlined, size: 20),
                                color: note.isNotEmpty ? colorScheme.primary : null,
                                tooltip: note.isNotEmpty ? 'Edit note: $note' : 'Add Note',
                                onPressed: () => _showAddNoteDialog(context, kidId, fullName, note),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStatusChip({
    required String label,
    required bool selected,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? color.withOpacity(0.2) : Colors.transparent,
          border: Border.all(color: selected ? color : Colors.grey.shade400),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? color : Colors.grey.shade700,
            fontWeight: selected ? FontWeight.bold : FontWeight.normal,
            fontSize: 12,
          ),
        ),
      ),
    );
  }

  // --- ACTIONS: START TAKING ATTENDANCE ---
  void _startNewEvent(DocumentSnapshot<Map<String, dynamic>>? eventDoc) {
    if (eventDoc == null) {
      // Create new clean state
      _editingEventId = null;
      _titleController.text = 'Sunday School Lesson';
      _eventDate = DateTime.now();
      _statuses = {};
      _notesByKid = {};
    } else {
      // Load existing state for edit
      final data = eventDoc.data()!;
      _editingEventId = eventDoc.id;
      _titleController.text = data['title'] ?? '';
      final parsedDate = data['eventDate'];
      if (parsedDate is Timestamp) {
        _eventDate = parsedDate.toDate();
      }
      _statuses = Map<String, String>.from(data['statuses'] ?? {});
      _notesByKid = Map<String, String>.from(data['notesByKid'] ?? {});
    }

    setState(() {
      _isTakingAttendance = true;
    });
  }

  // --- ACTIONS: SAVE ATTENDANCE ---
  Future<void> _saveAttendance() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      _showSnack('Please provide an event title.');
      return;
    }

    final payload = {
      'title': title,
      'type': _eventType,
      'eventDate': Timestamp.fromDate(_eventDate),
      'statuses': _statuses,
      'notesByKid': _notesByKid,
      'academicYearId': widget.academicYearId,
      'takenAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };

    try {
      if (_editingEventId == null) {
        // Create new
        await _eventsRef.add({
          ...payload,
          'createdAt': FieldValue.serverTimestamp(),
        });
      } else {
        // Edit existing
        await _eventsRef.doc(_editingEventId).update(payload);
      }

      _showSnack('Attendance log successfully committed.');
      setState(() {
        _isTakingAttendance = false;
      });
    } catch (e) {
      _showSnack('Failed to save attendance log: $e');
    }
  }

  // --- ACTIONS: DELETE EVENT ---
  Future<void> _deleteEvent(String eventId) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Log?'),
            content: const Text('Are you sure you want to delete this attendance log permanently?'),
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
      try {
        await _eventsRef.doc(eventId).delete();
        _showSnack('Log deleted.');
      } catch (e) {
        _showSnack('Failed to delete log: $e');
      }
    }
  }

  // --- ACTIONS: PICK EVENT DATE ---
  Future<void> _pickEventDate() async {
    final selected = await showDatePicker(
      context: context,
      initialDate: _eventDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (selected != null) {
      setState(() {
        _eventDate = selected;
      });
    }
  }

  // --- ACTIONS: ADD NOTE FOR SPECIFIC STUDENT ---
  Future<void> _showAddNoteDialog(
    BuildContext context,
    String kidId,
    String fullName,
    String currentNote,
  ) async {
    final noteController = TextEditingController(text: currentNote);

    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: Text('Remarks: $fullName'),
            content: TextFormField(
              controller: noteController,
              decoration: const InputDecoration(
                labelText: 'Add remark notes (e.g. sick, came late)',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Save Notes'),
              ),
            ],
          ),
        ) ??
        false;

    if (confirmed) {
      setState(() {
        final txt = noteController.text.trim();
        if (txt.isEmpty) {
          _notesByKid.remove(kidId);
        } else {
          _notesByKid[kidId] = txt;
        }
      });
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
