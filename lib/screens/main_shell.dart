import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
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

        // 2. Second, listen to their church-specific servant profile document (keyed by verified Email)
        return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: _churchesRef
              .doc(_selectedChurchId)
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

            // If we are waiting for connection, show a clean indicator
            if (isCheckingAuth) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }

            // If the user is NOT authorized (unapproved / new sign-in), show the Join Request Wizard
            if (!isAuthorized) {
              return _buildJoinRequestShell(context, user, email, theme, colorScheme, lang, isRtl);
            }

            // --- AUTHORIZED DASHBOARD VIEW ---
            final List<Widget> screens = [
              DashboardScreen(
                churchId: _selectedChurchId,
                academicYearId: _selectedAcademicYearId,
                userEmail: email,
                userRole: isGlobalAdmin ? 'Admin' : (misterData?['churchRole'] ?? 'Teacher'),
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
          },
        );
      },
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
  ) {
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
                  .doc(_selectedChurchId)
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
                          StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                            stream: _churchesRef.snapshots(),
                            builder: (context, snap) {
                              if (!snap.hasData) return const LinearProgressIndicator();
                              final docs = snap.data!.docs;
                              return DropdownButtonFormField<String>(
                                value: _selectedChurchId,
                                decoration: const InputDecoration(
                                  labelText: 'Select Sunday School Church',
                                  border: OutlineInputBorder(),
                                ),
                                items: docs.map((doc) {
                                  final name = doc.data()['displayName'] ?? doc.id;
                                  return DropdownMenuItem(value: doc.id, child: Text(name));
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) {
                                    setState(() {
                                      _selectedChurchId = val;
                                    });
                                  }
                                },
                              );
                            },
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              minimumSize: const Size(double.infinity, 50),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: () => _submitJoinRequest(email, user.displayName ?? 'New Servant'),
                            icon: const Icon(Icons.send),
                            label: const Text('Send Join Request', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ] else ...[
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: () => _cancelJoinRequest(email),
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

  Future<void> _submitJoinRequest(String email, String displayName) async {
    try {
      await _churchesRef
          .doc(_selectedChurchId)
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

  Future<void> _cancelJoinRequest(String email) async {
    try {
      await _churchesRef
          .doc(_selectedChurchId)
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
            title: Text('${AppTranslation.translate('language', lang)}: ${lang == 'en' ? 'العربية' : 'English'}'),
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
