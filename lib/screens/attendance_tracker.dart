import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class AttendanceTrackerScreen extends StatefulWidget {
  const AttendanceTrackerScreen({
    required this.churchId,
    required this.academicYearId,
    super.key,
  });

  final String churchId;
  final String academicYearId;

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

  CollectionReference<Map<String, dynamic>> get _eventsRef =>
      FirebaseFirestore.instance
          .collection('churches')
          .doc(widget.churchId)
          .collection('academicYears')
          .doc(widget.academicYearId)
          .collection('attendanceEvents');

  CollectionReference<Map<String, dynamic>> get _kidsRef =>
      FirebaseFirestore.instance
          .collection('churches')
          .doc(widget.churchId)
          .collection('kids');

  @override
  Widget build(BuildContext context) {
    if (widget.churchId.isEmpty || widget.academicYearId.isEmpty) {
      return const Center(
        child: Text('Select a church and an academic year in the top bar.'),
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
              stream: _eventsRef.orderBy('eventDate', descending: true).snapshots(),
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

  // --- VIEW 2: Interactive Attendance Sheet ---
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

        // Interactive Kids Checklist Roll
        Expanded(
          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: _kidsRef.where('active', isEqualTo: true).snapshots(),
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return Center(child: Text('Error: ${snapshot.error}'));
              }
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }

              final docs = snapshot.data!.docs;
              if (docs.isEmpty) {
                return const Center(child: Text('No active kids enrolled in this church.'));
              }

              return ListView.separated(
                padding: const EdgeInsets.all(24),
                itemCount: docs.length,
                separatorBuilder: (context, index) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final doc = docs[index];
                  final data = doc.data();
                  final kidId = doc.id;
                  final fullName = data['current']?['fullName'] ?? kidId;
                  final gender = data['current']?['gender'] ?? 'M';

                  final currentStatus = _statuses[kidId] ?? 'absent';
                  final currentNote = _notesByKid[kidId] ?? '';

                  return Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: colorScheme.outlineVariant),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        children: [
                          // Kid Avatar representation
                          CircleAvatar(
                            backgroundColor: gender == 'F'
                                ? Colors.pink.shade100
                                : Colors.blue.shade100,
                            foregroundColor: gender == 'F'
                                ? Colors.pink
                                : Colors.blue,
                            child: Icon(gender == 'F' ? Icons.girl : Icons.boy),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            flex: 2,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  fullName,
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'ID: $kidId',
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),

                          // Individual Notes field
                          Expanded(
                            flex: 3,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16.0),
                              child: TextFormField(
                                initialValue: currentNote,
                                decoration: const InputDecoration(
                                  hintText: 'Add note (e.g. sick, came late)',
                                  isDense: true,
                                  border: UnderlineInputBorder(),
                                ),
                                onChanged: (text) {
                                  _notesByKid[kidId] = text;
                                },
                              ),
                            ),
                          ),

                          // Interactive status segmented toggle
                          SegmentedButton<String>(
                            segments: const [
                              ButtonSegment(
                                value: 'present',
                                label: Text('Present'),
                                icon: Icon(Icons.check_circle_outline, size: 16),
                              ),
                              ButtonSegment(
                                value: 'absent',
                                label: Text('Absent'),
                                icon: Icon(Icons.cancel_outlined, size: 16),
                              ),
                              ButtonSegment(
                                value: 'excused',
                                label: Text('Excused'),
                                icon: Icon(Icons.help_outline, size: 16),
                              ),
                            ],
                            selected: {currentStatus},
                            onSelectionChanged: (value) {
                              setState(() {
                                _statuses[kidId] = value.first;
                              });
                            },
                            style: SegmentedButton.styleFrom(
                              selectedBackgroundColor: currentStatus == 'present'
                                  ? Colors.green.shade100
                                  : (currentStatus == 'absent'
                                      ? Colors.red.shade100
                                      : Colors.orange.shade100),
                              selectedForegroundColor: currentStatus == 'present'
                                  ? Colors.green
                                  : (currentStatus == 'absent'
                                      ? Colors.red
                                      : Colors.orange),
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
    );
  }

  // --- CONTROLLER ACTIONS & UTILITIES ---

  Future<void> _pickEventDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _eventDate,
      firstDate: DateTime(1900),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() {
        _eventDate = picked;
      });
    }
  }

  void _startNewEvent(DocumentSnapshot<Map<String, dynamic>>? eventDoc) {
    if (eventDoc == null) {
      // Create mode
      setState(() {
        _editingEventId = null;
        _titleController.text = 'Sunday School Class';
        _eventDate = DateTime.now();
        _eventType = 'Sunday School';
        _statuses = {};
        _notesByKid = {};
        _isTakingAttendance = true;
      });
    } else {
      // Edit mode
      final data = eventDoc.data()!;
      final dateVal = data['eventDate'];
      DateTime parsed = DateTime.now();
      if (dateVal is Timestamp) {
        parsed = dateVal.toDate();
      }

      setState(() {
        _editingEventId = eventDoc.id;
        _titleController.text = data['title'] ?? 'Sunday School';
        _eventDate = parsed;
        _eventType = data['type'] ?? 'Sunday School';
        
        final rawStatuses = Map<String, dynamic>.from(data['statuses'] ?? {});
        _statuses = rawStatuses.map((k, v) => MapEntry(k, v.toString()));

        final rawNotes = Map<String, dynamic>.from(data['notesByKid'] ?? {});
        _notesByKid = rawNotes.map((k, v) => MapEntry(k, v.toString()));

        _isTakingAttendance = true;
      });
    }
  }

  Future<void> _saveAttendance() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter an event title.')),
      );
      return;
    }

    // Build standard payload
    final payload = <String, dynamic>{
      'title': title,
      'type': _eventType,
      'eventDate': Timestamp.fromDate(_eventDate.toUtc()),
      'statuses': _statuses,
      'notesByKid': _notesByKid,
      'takenAt': FieldValue.serverTimestamp(),
    };

    try {
      if (_editingEventId == null) {
        // Create in Firestore
        await _eventsRef.add({
          ...payload,
          'createdAt': FieldValue.serverTimestamp(),
        });
      } else {
        // Edit in Firestore
        await _eventsRef.doc(_editingEventId).set(
              payload,
              SetOptions(merge: true),
            );
      }
      setState(() {
        _isTakingAttendance = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Attendance logged successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save log: $e')),
        );
      }
    }
  }

  Future<void> _deleteEvent(String eventId) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Log?'),
            content: Text('Are you sure you want to delete "$eventId"?'),
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
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Delete failed: $e')),
          );
        }
      }
    }
  }
}
