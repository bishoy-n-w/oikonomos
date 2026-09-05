import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class GoogleDriveShareField extends StatefulWidget {
  const GoogleDriveShareField({
    required this.churchId,
    required this.label,
    required this.onChanged,
    this.initialEmails = const [],
    this.hint = 'Add people...',
    super.key,
  });

  final String churchId;
  final String label;
  final String hint;
  final List<String> initialEmails;
  final ValueChanged<List<String>> onChanged;

  @override
  State<GoogleDriveShareField> createState() => _GoogleDriveShareFieldState();
}

class _GoogleDriveShareFieldState extends State<GoogleDriveShareField> {
  late List<String> _selectedEmails;
  final FocusNode _textFieldFocusNode = FocusNode();
  final TextEditingController _textController = TextEditingController();
  List<Map<String, String>> _allMisters = [];

  // Strict email regex validation
  static final RegExp _emailRegex = RegExp(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,253}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,253}[a-zA-Z0-9])?)*$",
  );

  @override
  void initState() {
    super.initState();
    _selectedEmails = List<String>.from(widget.initialEmails);
    _loadMistersFromFirestore();
  }

  @override
  void dispose() {
    _textFieldFocusNode.dispose();
    _textController.dispose();
    super.dispose();
  }

  // Fetch registered servants to use for suggestions
  Future<void> _loadMistersFromFirestore() async {
    if (widget.churchId.isEmpty) return;
    try {
      final snap = await FirebaseFirestore.instance
          .collection('churches')
          .doc(widget.churchId)
          .collection('misters')
          .get();

      if (mounted) {
        setState(() {
          _allMisters = snap.docs.map((doc) {
            final data = doc.data();
            return {
              'uid': doc.id,
              'displayName': (data['displayName'] ?? '').toString(),
              'email': (data['authUid'] ?? '').toString(),
            };
          }).toList();
        });
      }
    } catch (_) {}
  }

  void _addEmailToken(String rawEmail) {
    final email = rawEmail.trim().toLowerCase();
    if (email.isEmpty) return;

    // Validate email format
    if (!_emailRegex.hasMatch(email)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('"$email" is not a valid email address format.'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
      return;
    }

    if (!_selectedEmails.contains(email)) {
      setState(() {
        _selectedEmails.add(email);
        _textController.clear();
      });
      widget.onChanged(_selectedEmails);
    } else {
      _textController.clear();
    }
  }

  void _removeEmailToken(String email) {
    setState(() {
      _selectedEmails.remove(email);
    });
    widget.onChanged(_selectedEmails);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6.0, left: 4.0),
          child: Text(
            widget.label,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        RawAutocomplete<Map<String, String>>(
          textEditingController: _textController,
          focusNode: _textFieldFocusNode,
          optionsBuilder: (TextEditingValue textEditingValue) {
            final query = textEditingValue.text.toLowerCase().trim();
            if (query.isEmpty) {
              return const Iterable<Map<String, String>>.empty();
            }
            return _allMisters.where((mister) {
              final name = mister['displayName']!.toLowerCase();
              final email = mister['email']!.toLowerCase();
              // Don't suggest already selected emails
              return (name.contains(query) || email.contains(query)) &&
                  !_selectedEmails.contains(email);
            });
          },
          onSelected: (Map<String, String> selection) {
            final email = selection['email']!;
            _addEmailToken(email);
          },
          fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
            return Focus(
              onFocusChange: (hasFocus) {
                if (!hasFocus) {
                  // If we lose focus, try to convert any remaining text to a chip
                  _addEmailToken(controller.text);
                }
              },
              child: InkWell(
                onTap: () => focusNode.requestFocus(),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  constraints: const BoxConstraints(minHeight: 56),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: focusNode.hasFocus
                          ? colorScheme.primary
                          : colorScheme.outline,
                      width: focusNode.hasFocus ? 2 : 1,
                    ),
                    color: focusNode.hasFocus
                        ? colorScheme.surfaceContainerLowest
                        : colorScheme.surface,
                  ),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      // Render selected email Chips
                      ..._selectedEmails.map((email) {
                        // Find if this email belongs to an existing mister to show their name
                        final mister = _allMisters.firstWhere(
                          (m) => m['email']!.toLowerCase() == email,
                          orElse: () => {'displayName': email, 'email': email},
                        );
                        final displayLabel = mister['displayName']!;

                        return InputChip(
                          label: Text(displayLabel),
                          tooltip: email,
                          avatar: CircleAvatar(
                            backgroundColor: colorScheme.secondaryContainer,
                            foregroundColor: colorScheme.onSecondaryContainer,
                            child: Text(
                              displayLabel.isNotEmpty
                                  ? displayLabel[0].toUpperCase()
                                  : '@',
                              style: const TextStyle(fontSize: 10),
                            ),
                          ),
                          onDeleted: () => _removeEmailToken(email),
                          deleteIconColor: colorScheme.onSurfaceVariant,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        );
                      }),
                      // Text input field for typing or searching
                      IntrinsicWidth(
                        child: TextField(
                          controller: controller,
                          focusNode: focusNode,
                          keyboardType: TextInputType.emailAddress,
                          decoration: InputDecoration(
                            hintText: _selectedEmails.isEmpty ? widget.hint : '',
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                          onSubmitted: (text) {
                            _addEmailToken(text);
                            // Keep focus active so they can type the next email
                            focusNode.requestFocus();
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
          optionsViewBuilder: (context, onSelected, options) {
            return Align(
              alignment: Alignment.topLeft,
              child: Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(12),
                shadowColor: colorScheme.shadow.withValues(alpha: 0.1),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 250, maxWidth: 420),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    shrinkWrap: true,
                    itemCount: options.length,
                    separatorBuilder: (context, index) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final option = options.elementAt(index);
                      final name = option['displayName']!;
                      final email = option['email']!;

                      return ListTile(
                        dense: true,
                        leading: CircleAvatar(
                          child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?'),
                        ),
                        title: Text(
                          name,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        subtitle: Text(email),
                        onTap: () => onSelected(option),
                      );
                    },
                  ),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 4),
        Text(
          'Press Enter, Space, or Comma after typing to confirm custom emails.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
            fontSize: 10,
          ),
        ),
      ],
    );
  }
}
