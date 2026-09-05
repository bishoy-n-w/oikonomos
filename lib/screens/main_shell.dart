import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/app_settings.dart';
import '../services/translations.dart';
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
  String _selectedChurchId = 'CHC_ABC123';
  String _selectedAcademicYearId = 'AY_2026';

  CollectionReference<Map<String, dynamic>> get _churchesRef =>
      FirebaseFirestore.instance.collection('churches');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final lang = AppSettings.language.value;
    final isRtl = AppSettings.isRtl();

    // Responsive navigation body routing
    final List<Widget> screens = [
      DashboardScreen(
        churchId: _selectedChurchId,
        academicYearId: _selectedAcademicYearId,
      ),
      KidsDirectoryScreen(
        churchId: _selectedChurchId,
      ),
      MistersDirectoryScreen(
        churchId: _selectedChurchId,
      ),
      AttendanceTrackerScreen(
        churchId: _selectedChurchId,
        academicYearId: _selectedAcademicYearId,
      ),
      ClassesScreen(
        churchId: _selectedChurchId,
      ),
      ServiceGroupsScreen(
        churchId: _selectedChurchId,
      ),
      ClassAssignmentsScreen(
        churchId: _selectedChurchId,
        academicYearId: _selectedAcademicYearId,
      ),
      Padding(
        padding: const EdgeInsets.all(24.0),
        child: HomeVisitsTab(
          churchId: _selectedChurchId,
          academicYearId: _selectedAcademicYearId,
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
          _buildChurchDropdown(colorScheme),
          const SizedBox(width: 8),
          _buildAcademicYearDropdown(colorScheme),
          const SizedBox(width: 16),
          // Unified dynamic profile menu (Google-style switcher, language, theme, logout)
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

  // --- SUB-VIEW: Sleek Google-style Profile Menu Dropdown ---
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
        // User details header card
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
        // Theme Toggle Action
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
        // Language Toggle Action
        PopupMenuItem<int>(
          value: 2,
          child: ListTile(
            leading: const Icon(Icons.language),
            title: Text('${AppTranslation.translate('language', lang)}: ${lang == 'en' ? 'العربية' : 'English'}'),
            contentPadding: EdgeInsets.zero,
            dense: true,
          ),
        ),
        // Google-style Switch Account Action (Select Account Prompt)
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
        // Logout Action
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
              // Trigger rapid account swapper popup
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

  Widget _buildChurchDropdown(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(20),
      ),
      child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: _churchesRef.snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Tooltip(
              message: 'Database Error: ${snapshot.error}',
              child: const Icon(Icons.error_outline, color: Colors.red, size: 20),
            );
          }
          if (!snapshot.hasData) {
            return const SizedBox(
              width: 120,
              height: 20,
              child: LinearProgressIndicator(),
            );
          }
          final docs = snapshot.data!.docs;
          final ids = docs.map((e) => e.id).toList();
          final currentValue =
              ids.contains(_selectedChurchId) ? _selectedChurchId : null;
          if (currentValue == null && ids.isNotEmpty) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted) return;
              setState(() {
                _selectedChurchId = ids.first;
                _selectedAcademicYearId = '';
              });
            });
          }
          return DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: currentValue,
              icon: const Icon(Icons.church, size: 18),
              style: TextStyle(
                color: colorScheme.onPrimaryContainer,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
              items: docs.map((doc) {
                final display = doc.data()['displayName']?.toString() ?? doc.id;
                return DropdownMenuItem<String>(
                  value: doc.id,
                  child: Text(display),
                );
              }).toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() {
                  _selectedChurchId = value;
                  _selectedAcademicYearId = '';
                });
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildAcademicYearDropdown(ColorScheme colorScheme) {
    if (_selectedChurchId.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: colorScheme.secondaryContainer.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(20),
      ),
      child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: _churchesRef
            .doc(_selectedChurchId)
            .collection('academicYears')
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Tooltip(
              message: 'Database Error: ${snapshot.error}',
              child: const Icon(Icons.error_outline, color: Colors.red, size: 20),
            );
          }
          if (!snapshot.hasData) {
            return const SizedBox(
              width: 100,
              height: 20,
              child: LinearProgressIndicator(),
            );
          }
          final docs = snapshot.data!.docs;
          final ids = docs.map((e) => e.id).toList();
          final currentValue = ids.contains(_selectedAcademicYearId)
              ? _selectedAcademicYearId
              : null;
          if (currentValue == null && ids.isNotEmpty) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted) return;
              setState(() {
                _selectedAcademicYearId = ids.first;
              });
            });
          }
          return DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: currentValue,
              icon: const Icon(Icons.calendar_today, size: 16),
              style: TextStyle(
                color: colorScheme.onSecondaryContainer,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
              items: docs.map((doc) {
                final display = doc.data()['displayName']?.toString() ?? doc.id;
                return DropdownMenuItem<String>(
                  value: doc.id,
                  child: Text(display),
                );
              }).toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() {
                  _selectedAcademicYearId = value;
                });
              },
            ),
          );
        },
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
