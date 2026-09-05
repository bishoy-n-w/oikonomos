import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({
    required this.churchId,
    required this.academicYearId,
    required this.userEmail,
    required this.userRole,
    super.key,
  });

  final String churchId;
  final String academicYearId;
  final String userEmail;
  final String userRole;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final lang = AppSettings.language.value;
    final isAdmin = userRole == 'Admin';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Welcome Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppTranslation.translate('welcome', lang),
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    AppTranslation.translate('subtitle', lang),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
              // User Role badge
              Chip(
                avatar: const Icon(Icons.verified_user_outlined, size: 16),
                label: Text(userRole.toUpperCase()),
                backgroundColor: isAdmin
                    ? colorScheme.primaryContainer
                    : colorScheme.surfaceVariant,
              ),
            ],
          ),
          const SizedBox(height: 24),

          // --- ADMIN-ONLY JOIN REQUESTS APPROVAL PANEL ---
          if (isAdmin) _buildJoinRequestsPanel(context, theme, colorScheme),

          const SizedBox(height: 12),

          // Core Stats Grid
          GridView.count(
            crossAxisCount: MediaQuery.of(context).size.width > 900 ? 3 : 1,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 2.2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              _buildStatCard(
                context,
                title: AppTranslation.translate('total_kids', lang),
                stream: FirebaseFirestore.instance
                    .collection('churches')
                    .doc(churchId)
                    .collection('kids')
                    .snapshots(),
                icon: Icons.child_care,
                color: colorScheme.primary,
                backgroundColor: colorScheme.primaryContainer.withValues(alpha: 0.3),
              ),
              _buildStatCard(
                context,
                title: AppTranslation.translate('active_servants', lang),
                stream: FirebaseFirestore.instance
                    .collection('churches')
                    .doc(churchId)
                    .collection('misters')
                    .snapshots(),
                icon: Icons.people,
                color: colorScheme.secondary,
                backgroundColor: colorScheme.secondaryContainer.withValues(alpha: 0.3),
              ),
              _buildStatCard(
                context,
                title: AppTranslation.translate('class_groups', lang),
                stream: FirebaseFirestore.instance
                    .collection('churches')
                    .doc(churchId)
                    .collection('classes')
                    .snapshots(),
                icon: Icons.school,
                color: colorScheme.tertiary,
                backgroundColor: colorScheme.tertiaryContainer.withValues(alpha: 0.3),
              ),
            ],
          ),
          const SizedBox(height: 32),

          // Action Shortcuts Section
          Text(
            AppTranslation.translate('quick_tasks', lang),
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  context,
                  title: AppTranslation.translate('take_attendance', lang),
                  subtitle: AppTranslation.translate('log_attendance_desc', lang),
                  icon: Icons.co_present,
                  color: colorScheme.primary,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildActionCard(
                  context,
                  title: AppTranslation.translate('log_visit', lang),
                  subtitle: AppTranslation.translate('log_visit_desc', lang),
                  icon: Icons.home,
                  color: colorScheme.secondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // --- SUB-VIEW: Pending Join Requests Panel ---
  Widget _buildJoinRequestsPanel(BuildContext context, ThemeData theme, ColorScheme colorScheme) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('churches')
          .doc(churchId)
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

      // 1. Create a Teacher (Servant) record under misters keyed by their validated Email
      final misterRef = firestore
          .collection('churches')
          .doc(churchId)
          .collection('misters')
          .doc(email);

      batch.set(misterRef, {
        'displayName': name,
        'mobile': '',
        'phone': '',
        'countryCode': '+1',
        'churchRole': 'Teacher', // Teacher by default
        'active': true, // Auto-active upon approval!
        'authUid': email,
        'createdAt': FieldValue.serverTimestamp(),
      });

      // 2. Delete their joinRequest document
      final requestRef = firestore
          .collection('churches')
          .doc(churchId)
          .collection('joinRequests')
          .doc(email);

      batch.delete(requestRef);

      await batch.commit();

      _showSnack(context, '$name approved successfully!');
    } catch (e) {
      _showSnack(context, 'Approval failed: $e');
    }
  }

  Future<void> _rejectJoinRequest(String email) async {
    try {
      await FirebaseFirestore.instance
          .collection('churches')
          .doc(churchId)
          .collection('joinRequests')
          .doc(email)
          .delete();
    } catch (_) {}
  }

  Widget _buildStatCard(
    BuildContext context, {
    required String title,
    required Stream<QuerySnapshot> stream,
    required IconData icon,
    required Color color,
    required Color backgroundColor,
  }) {
    final theme = Theme.of(context);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: backgroundColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 32, color: color),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  StreamBuilder<QuerySnapshot>(
                    stream: stream,
                    builder: (context, snapshot) {
                      final count = snapshot.hasData ? snapshot.data!.docs.length : 0;
                      return Text(
                        snapshot.connectionState == ConnectionState.waiting
                            ? '...'
                            : '$count',
                        style: theme.textTheme.headlineLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.onSurface,
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    final theme = Theme.of(context);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Use the sidebar navigation to open "$title".')),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Row(
            children: [
              Icon(icon, size: 40, color: color),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios, size: 16),
            ],
          ),
        ),
      ),
    );
  }

  void _showSnack(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
