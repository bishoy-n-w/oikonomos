import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({
    required this.churchId,
    required this.academicYearId,
    super.key,
  });

  final String churchId;
  final String academicYearId;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final lang = AppSettings.language.value;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Welcome Header
          Row(
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
            ],
          ),
          const SizedBox(height: 32),

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
}
