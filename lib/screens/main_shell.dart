// ignore_for_file: unnecessary_underscores, deprecated_member_use, use_build_context_synchronously
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';
import '../services/global_filter_controller.dart';
import 'dashboard_screen.dart';
import 'kids_directory.dart';
import 'misters_directory.dart';
import 'attendance_tracker.dart';
import 'classes_screen.dart';
import 'service_groups_screen.dart';
import 'class_assignments_screen.dart';
import 'home_visits_tab.dart';
import 'churches_screen.dart';
import '../constants.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;
  late final GlobalFilterController _filterController;

  CollectionReference<Map<String, dynamic>> get _churchesRef =>
      FirebaseFirestore.instance.collection('churches');

  @override
  void initState() {
    super.initState();
    _filterController = GlobalFilterController();
  }

  @override
  void dispose() {
    _filterController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final lang = AppSettings.language.value;
    final isRtl = AppSettings.isRtl();
    final user = AuthService.instance.currentUser;
    final email = user?.email ?? '';

    if (user == null || email.isEmpty) {
      return const Scaffold(
        body: Center(child: Text('Unauthorized session. Please sign in again.')),
      );
    }

    // --- ACCESS CONTROL GUARD GATE ---
    // 1. First, check if the logged-in user is registered as a Global Owner in the root collection
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('global_admins')
          .doc(user.uid)
          .snapshots(),
      builder: (context, globalAdminSnapshot) {
        final isGlobalAdmin = globalAdminSnapshot.hasData && globalAdminSnapshot.data!.exists;

        // Ensure we don't try to query misters collection if no church is selected yet by the filter controller
        return AnimatedBuilder(
          animation: _filterController,
          builder: (context, _) {
            if (_filterController.isLoading) {
              return const Scaffold(body: Center(child: CircularProgressIndicator()));
            }

            final churchId = _filterController.selectedChurchId;
            if (churchId == null) {
              // No churches exist in the database or none active
              if (isGlobalAdmin) {
                 return _buildAuthorizedView(context, isGlobalAdmin, 'owner', theme, colorScheme, lang, isRtl);
              }
              return const Scaffold(body: Center(child: Text('No active churches found.')));
            }

            // 2. Second, listen to their church-specific servant profile document (keyed by verified Email)
            return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
              stream: _churchesRef
                  .doc(churchId)
                  .collection('misters')
                  .doc(email)
                  .snapshots(),
              builder: (context, authSnapshot) {
                final isCheckingAuth = authSnapshot.connectionState == ConnectionState.waiting ||
                    globalAdminSnapshot.connectionState == ConnectionState.waiting;

                // They are authorized if they are a Database Global Owner OR if they are registered as active locally!
                final misterData = authSnapshot.data?.data();
                final isAuthorized = isGlobalAdmin ||
                    (authSnapshot.hasData && authSnapshot.data!.exists && (misterData?['active'] ?? false) == true);       

                if (isCheckingAuth) {
                  return const Scaffold(
                    body: Center(child: CircularProgressIndicator()),
                  );
                }

                // If the user is NOT authorized (unapproved / new sign-in), show the Join Request Wizard
                if (!isAuthorized) {
                  return _buildJoinRequestShell(context, user, email, theme, colorScheme, lang, isRtl, churchId);
                }

                final userRole = isGlobalAdmin ? 'owner' : (misterData?['churchRole'] ?? 'viewer');

                return _buildAuthorizedView(context, isGlobalAdmin, userRole, theme, colorScheme, lang, isRtl);
              },
            );
          }
        );
      },
    );
  }

  Widget _buildAuthorizedView(
    BuildContext context, 
    bool isGlobalAdmin, 
    String userRole,
    ThemeData theme, 
    ColorScheme colorScheme, 
    String lang, 
    bool isRtl
  ) {
      final user = AuthService.instance.currentUser!;
      final email = user.email!;
      final churchId = _filterController.selectedChurchId ?? '';
      final yearId = _filterController.selectedAcademicYearId ?? '';
      
      final List<Widget> screens = [
        DashboardScreen(
          churchId: churchId,
          academicYearId: yearId,
          userEmail: email,
          userRole: userRole,
        ),
        KidsDirectoryScreen(
          churchId: churchId,
          academicYearId: yearId,
          serviceGroupId: _filterController.selectedServiceGroupId ?? '',
          classId: _filterController.selectedClassId ?? '',
          userUid: user.uid,
          userRole: userRole,
        ),
        MistersDirectoryScreen(
          churchId: churchId,
          userRole: userRole,
        ),
        AttendanceTrackerScreen(
          churchId: churchId,
          academicYearId: yearId,
        ),
        ClassesScreen(
          churchId: churchId,
          userRole: userRole,
        ),
        ServiceGroupsScreen(
          churchId: churchId,
        ),
        ClassAssignmentsScreen(
          churchId: churchId,
          academicYearId: yearId,
        ),
        Padding(
          padding: const EdgeInsets.all(24.0),
          child: HomeVisitsTab(
            churchId: churchId,
            academicYearId: yearId,
          ),
        ),
        const ChurchesScreen(),
      ];

      return Scaffold(
        appBar: AppBar(
          titleSpacing: 0,
          title: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: Image.asset(
                    'assets/icon.png',
                    width: 36,
                    height: 32,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) =>
                        const Icon(Icons.admin_panel_settings, size: 32),
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  'Oikonomos',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: colorScheme.primary,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            _buildGlobalFilters(colorScheme),
            const SizedBox(width: 16),
            _buildProfileMenu(colorScheme, theme.textTheme, lang),
            const SizedBox(width: 16),
          ],
        ),
        body: Row(
          textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
          children: [
            // Sidebar Navigation
            NavigationRail(
              selectedIndex: _selectedIndex,
              labelType: NavigationRailLabelType.all,
              backgroundColor: colorScheme.surfaceContainerLow,
              indicatorColor: colorScheme.primaryContainer,
              onDestinationSelected: (int index) {
                setState(() {
                  _selectedIndex = index;
                });
              },
              destinations: [
                NavigationRailDestination(
                  icon: const Icon(Icons.dashboard_outlined),
                  selectedIcon: const Icon(Icons.dashboard),
                  label: Text(AppTranslation.translate('dashboard', lang)),
                ),
                NavigationRailDestination(
                  icon: const Icon(Icons.child_care_outlined),
                  selectedIcon: const Icon(Icons.child_care),
                  label: Text(AppTranslation.translate('kids', lang)),
                ),
                NavigationRailDestination(
                  icon: const Icon(Icons.people_outline),
                  selectedIcon: const Icon(Icons.people),
                  label: Text(AppTranslation.translate('servants', lang)),
                ),
                NavigationRailDestination(
                  icon: const Icon(Icons.co_present_outlined),
                  selectedIcon: const Icon(Icons.co_present),
                  label: Text(AppTranslation.translate('attendance', lang)),
                ),
                NavigationRailDestination(
                  icon: const Icon(Icons.class_outlined),
                  selectedIcon: const Icon(Icons.class_),
                  label: Text(AppTranslation.translate('classes', lang)),
                ),
                NavigationRailDestination(
                  icon: const Icon(Icons.group_work_outlined),
                  selectedIcon: const Icon(Icons.group_work),
                  label: Text(AppTranslation.translate('service_groups', lang)),
                ),
                NavigationRailDestination(
                  icon: const Icon(Icons.assignment_outlined),
                  selectedIcon: const Icon(Icons.assignment),
                  label: Text(AppTranslation.translate('class_assignments', lang)),
                ),
                NavigationRailDestination(
                  icon: const Icon(Icons.home_outlined),
                  selectedIcon: const Icon(Icons.home),
                  label: Text(AppTranslation.translate('home_visits', lang)),
                ),
                NavigationRailDestination(
                  icon: const Icon(Icons.church_outlined),
                  selectedIcon: const Icon(Icons.church),
                  label: Text(AppTranslation.translate('churches_config', lang)),
                ),
              ],
            ),
            const VerticalDivider(thickness: 1, width: 1),
            // Main Body Screen
            Expanded(
              child: Container(
                color: colorScheme.surface,
                child: Column(
                  children: [
                    Expanded(
                      child: screens[_selectedIndex],
                    ),
                    const Divider(height: 1, thickness: 1),
                    SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Oikonomos Admin System',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                                fontSize: 10,
                              ),
                            ),
                            Text(
                              'v${AppVersion.current}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
  }

  // --- SUB-VIEW: Unapproved Join Request Interface ---
  Widget _buildJoinRequestShell(
    BuildContext context,
    User user,
    String email,
    ThemeData theme,
    ColorScheme colorScheme,
    String lang,
    bool isRtl,
    String fallbackChurchId,
  ) {
    // Local state for the UI dropdown since they don't have access to the main shell
    String reqChurchId = _filterController.selectedChurchId ?? fallbackChurchId;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Oikonomos Access Portal'),
        actions: [
          _buildProfileMenu(colorScheme, theme.textTheme, lang),
          const SizedBox(width: 16),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
              stream: _churchesRef
                  .doc(reqChurchId)
                  .collection('joinRequests')
                  .doc(email)
                  .snapshots(),
              builder: (context, requestSnapshot) {
                final hasRequested = requestSnapshot.hasData && requestSnapshot.data!.exists;

                return Card(
                  elevation: 4,
                  shadowColor: colorScheme.shadow.withValues(alpha: 0.1),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(color: colorScheme.outlineVariant),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(32.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: hasRequested
                                ? Colors.orange.shade50
                                : colorScheme.primaryContainer.withValues(alpha: 0.3),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            hasRequested ? Icons.pending_actions : Icons.lock_person_outlined,
                            size: 48,
                            color: hasRequested ? Colors.orange : colorScheme.primary,
                          ),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          hasRequested ? 'Request Pending Approval' : 'Access Authorization Required',
                          style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          hasRequested
                              ? 'Your request to join this Sunday School is currently under review by coordinators. Please contact your church admin to approve your email:\n\n$email'
                              : 'Hello ${user.displayName ?? "Servant"}! Your account is signed in, but you are not registered as an active servant in Oikonomos yet. Select your Church below to submit a join request:',
                          style: theme.textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 24),

                        // Church selector dropdown
                        if (!hasRequested) ...[
                          StatefulBuilder(
                            builder: (context, setLocalState) {
                              return DropdownButtonFormField<String>(
                                value: reqChurchId,
                                decoration: const InputDecoration(
                                  labelText: 'Select Sunday School Church',
                                  border: OutlineInputBorder(),
                                ),
                                items: _filterController.churches.map((c) {
                                  return DropdownMenuItem(value: c.id, child: Text(c.displayName));
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) setLocalState(() => reqChurchId = val);
                                },
                              );
                            }
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              minimumSize: const Size(double.infinity, 50),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: () => _submitJoinRequest(reqChurchId, email, user.displayName ?? 'New Servant'),
                            icon: const Icon(Icons.send),
                            label: const Text('Send Join Request', style: TextStyle(fontWeight: FontWeight.bold)),     
                          ),
                        ] else ...[
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: () => _cancelJoinRequest(reqChurchId, email),
                            icon: const Icon(Icons.cancel_outlined),
                            label: const Text('Cancel Request'),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  // --- ACTIONS: SUBMIT & CANCEL JOIN REQUEST ---

  Future<void> _submitJoinRequest(String churchId, String email, String displayName) async {
    try {
      await _churchesRef
          .doc(churchId)
          .collection('joinRequests')
          .doc(email)
          .set({
        'displayName': displayName,
        'email': email,
        'createdAt': FieldValue.serverTimestamp(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Join request submitted successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to submit request: $e')),
        );
      }
    }
  }

  Future<void> _cancelJoinRequest(String churchId, String email) async {
    try {
      await _churchesRef
          .doc(churchId)
          .collection('joinRequests')
          .doc(email)
          .delete();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Join request cancelled.')),
        );
      }
    } catch (_) {}
  }

  // --- SUB-VIEW: Profile Settings Menu ---
  Widget _buildProfileMenu(ColorScheme colorScheme, TextTheme textTheme, String lang) {
    final user = AuthService.instance.currentUser;
    final displayName = user?.displayName ?? 'Church Servant';
    final email = user?.email ?? '';
    final photoUrl = user?.photoURL;
    final isDark = AppSettings.themeMode.value == ThemeMode.dark;

    return PopupMenuButton<int>(
      offset: const Offset(0, 56),
      icon: CircleAvatar(
        backgroundImage: photoUrl != null ? NetworkImage(photoUrl) : null,
        backgroundColor: colorScheme.primary,
        foregroundColor: colorScheme.onPrimary,
        radius: 18,
        child: photoUrl == null
            ? Text(displayName.isNotEmpty ? displayName[0].toUpperCase() : '?')
            : null,
      ),
      itemBuilder: (context) => [
        PopupMenuItem<int>(
          enabled: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8.0),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundImage: photoUrl != null ? NetworkImage(photoUrl) : null,
                  radius: 24,
                  child: photoUrl == null
                      ? Text(displayName.isNotEmpty ? displayName[0].toUpperCase() : '?')
                      : null,
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName,
                      style: textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    Text(
                      email,
                      style: textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const PopupMenuDivider(),
        PopupMenuItem<int>(
          value: 1,
          child: ListTile(
            leading: Icon(isDark ? Icons.light_mode : Icons.dark_mode),
            title: Text(AppTranslation.translate(
              isDark ? 'theme_light' : 'theme_dark',
              lang,
            )),
            contentPadding: EdgeInsets.zero,
            dense: true,
          ),
        ),
        PopupMenuItem<int>(
          value: 2,
          child: ListTile(
            leading: const Icon(Icons.language),
            title: Text('${AppTranslation.translate('language', lang)}: ${lang == 'en' ? 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©' : 'English'}'),
            contentPadding: EdgeInsets.zero,
            dense: true,
          ),
        ),
        PopupMenuItem<int>(
          value: 3,
          child: ListTile(
            leading: const Icon(Icons.switch_account_outlined),
            title: Text(AppTranslation.translate('switch_account', lang)),
            contentPadding: EdgeInsets.zero,
            dense: true,
          ),
        ),
        const PopupMenuDivider(),
        PopupMenuItem<int>(
          value: 4,
          child: ListTile(
            leading: Icon(Icons.logout, color: colorScheme.error),
            title: Text(
              AppTranslation.translate('sign_out', lang),
              style: TextStyle(color: colorScheme.error, fontWeight: FontWeight.bold),
            ),
            contentPadding: EdgeInsets.zero,
            dense: true,
          ),
        ),
      ],
      onSelected: (value) async {
        switch (value) {
          case 1:
            AppSettings.toggleTheme();
            break;
          case 2:
            AppSettings.setLanguage(lang == 'en' ? 'ar' : 'en');
            break;
          case 3:
            try {
              await AuthService.instance.signInWithGoogle(forceSelect: true);
            } catch (_) {}
            break;
          case 4:
            _handleSignOut();
            break;
        }
      },
    );
  }

  // --- SUB-VIEW: Global Cascading Filters ---
  Widget _buildGlobalFilters(ColorScheme colorScheme) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildDropdown(
          icon: Icons.church,
          value: _filterController.selectedChurchId,
          items: _filterController.churches,
          onChanged: _filterController.setChurch,
          color: colorScheme.primaryContainer,
          onColor: colorScheme.onPrimaryContainer,
        ),
        const SizedBox(width: 8),
        _buildDropdown(
          icon: Icons.calendar_today,
          value: _filterController.selectedAcademicYearId,
          items: _filterController.academicYears,
          onChanged: _filterController.setAcademicYear,
          color: colorScheme.secondaryContainer,
          onColor: colorScheme.onSecondaryContainer,
        ),
        const SizedBox(width: 8),
        _buildDropdown(
          icon: Icons.group_work,
          value: _filterController.selectedServiceGroupId,
          items: _filterController.serviceGroups,
          onChanged: _filterController.setServiceGroup,
          color: colorScheme.tertiaryContainer,
          onColor: colorScheme.onTertiaryContainer,
        ),
        const SizedBox(width: 8),
        _buildDropdown(
          icon: Icons.class_,
          value: _filterController.selectedClassId,
          items: _filterController.classes,
          onChanged: _filterController.setClass,
          color: colorScheme.surfaceContainerHigh,
          onColor: colorScheme.onSurface,
        ),
      ],
    );
  }

  Widget _buildDropdown({
    required IconData icon,
    required String? value,
    required List<DropdownItem> items,
    required void Function(String?) onChanged,
    required Color color,
    required Color onColor,
  }) {
    if (items.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(20),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String?>(
          value: value,
          icon: Padding(
            padding: const EdgeInsets.only(left: 8.0),
            child: Icon(icon, size: 16, color: onColor.withValues(alpha: 0.8)),
          ),
          style: TextStyle(
            color: onColor,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
          items: [
            // Add an "All" option if there's more than one item
            if (items.length > 1) 
              const DropdownMenuItem<String?>(
                value: null,
                child: Text('All'),
              ),
            ...items.map((item) {
              return DropdownMenuItem<String?>(
                value: item.id,
                child: Text(item.displayName),
              );
            }),
          ],
          onChanged: onChanged,
        ),
      ),
    );
  }

  Future<void> _handleSignOut() async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Sign Out'),
            content: const Text('Are you sure you want to sign out?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Sign Out'),
              ),
            ],
          ),
        ) ??
        false;

    if (confirmed) {
      await AuthService.instance.signOut();
    }
  }
}