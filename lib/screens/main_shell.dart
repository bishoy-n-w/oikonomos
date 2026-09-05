import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import 'dashboard_screen.dart';
import 'kids_directory.dart';
import 'misters_directory.dart';
import 'attendance_tracker.dart';
import 'settings_screen.dart';

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

    // Destructural navigation body routing
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
      SettingsScreen(
        churchId: _selectedChurchId,
        academicYearId: _selectedAcademicYearId,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(left: 16),
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
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign Out',
            onPressed: _handleSignOut,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Row(
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
            destinations: const [
              NavigationRailDestination(
                icon: Icon(Icons.dashboard_outlined),
                selectedIcon: Icon(Icons.dashboard),
                label: Text('Dashboard'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.child_care_outlined),
                selectedIcon: Icon(Icons.child_care),
                label: Text('Kids'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.people_outline),
                selectedIcon: Icon(Icons.people),
                label: Text('Servants'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.co_present_outlined),
                selectedIcon: Icon(Icons.co_present),
                label: Text('Attendance'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.settings_outlined),
                selectedIcon: Icon(Icons.settings),
                label: Text('Settings'),
              ),
            ],
          ),
          const VerticalDivider(thickness: 1, width: 1),
          // Main Body Screen
          Expanded(
            child: Container(
              color: colorScheme.surface,
              child: screens[_selectedIndex],
            ),
          ),
        ],
      ),
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
