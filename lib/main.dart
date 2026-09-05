import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'firebase_options.dart';
import 'services/auth_service.dart';
import 'services/app_settings.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'constants.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppSettings.initialize();
  await AppVersion.initialize();
  runApp(const FirebaseBootstrapApp());
}

class FirebaseBootstrapApp extends StatefulWidget {
  const FirebaseBootstrapApp({super.key});

  @override
  State<FirebaseBootstrapApp> createState() => _FirebaseBootstrapAppState();
}

class _FirebaseBootstrapAppState extends State<FirebaseBootstrapApp> {
  late final Future<FirebaseApp> _bootstrapFuture = _initializeFirebase();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<FirebaseApp>(
      future: _bootstrapFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return MaterialApp(
            debugShowCheckedModeBanner: false,
            home: Scaffold(
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'Firebase initialization failed.\n\n${snapshot.error}',
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ),
          );
        }
        if (!snapshot.hasData) {
          return const MaterialApp(
            debugShowCheckedModeBanner: false,
            home: Scaffold(
              body: Center(child: CircularProgressIndicator()),
            ),
          );
        }
        return const SundaySchoolAuthGate();
      },
    );
  }
}

Future<FirebaseApp> _initializeFirebase() async {
  return Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
}

class SundaySchoolAuthGate extends StatelessWidget {
  const SundaySchoolAuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: AppSettings.themeMode,
      builder: (context, currentThemeMode, _) {
        return ValueListenableBuilder<String>(
          valueListenable: AppSettings.language,
          builder: (context, currentLanguage, _) {
            final isRtl = AppSettings.isRtl();
            return MaterialApp(
              debugShowCheckedModeBanner: false,
              title: 'Oikonomos',
              locale: Locale(currentLanguage),
              themeMode: currentThemeMode,
              theme: ThemeData(
                colorScheme: ColorScheme.fromSeed(
                  seedColor: Colors.teal,
                  brightness: Brightness.light,
                ),
                useMaterial3: true,
              ),
              darkTheme: ThemeData(
                colorScheme: ColorScheme.fromSeed(
                  seedColor: Colors.teal,
                  brightness: Brightness.dark,
                ),
                useMaterial3: true,
              ),
              home: Directionality(
                textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
                child: StreamBuilder<User?>(
                  stream: AuthService.instance.authStateChanges,
                  builder: (context, snapshot) {
                    // If connection is active, let's look at the data.
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Scaffold(
                        body: Center(
                          child: CircularProgressIndicator(),
                        ),
                      );
                    }

                    final user = snapshot.data;
                    if (user == null) {
                      return const LoginScreen();
                    }

                    return BootstrapGuard(
                      user: user,
                      child: const MainShell(),
                    );
                  },
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class BootstrapGuard extends StatefulWidget {
  const BootstrapGuard({required this.user, required this.child, super.key});

  final User user;
  final Widget child;

  @override
  State<BootstrapGuard> createState() => _BootstrapGuardState();
}

class _BootstrapGuardState extends State<BootstrapGuard> {
  bool _checking = true;
  bool _bootstrapping = false;

  @override
  void initState() {
    super.initState();
    _checkAndBootstrap();
  }

  Future<void> _checkAndBootstrap() async {
    try {
      final firestore = FirebaseFirestore.instance;
      // Read the lock document to see if database is brand new
      final lockDoc =
          await firestore.collection('global_admins').doc('_lock').get();

      if (!lockDoc.exists) {
        setState(() {
          _bootstrapping = true;
        });

        final batch = firestore.batch();

        // 1. Create the global gate lock
        batch.set(firestore.collection('global_admins').doc('_lock'), {
          'initialized': true,
          'createdAt': FieldValue.serverTimestamp(),
          'initializedBy': widget.user.uid,
        });

        // 2. Register the logged-in user as Global Owner
        batch.set(firestore.collection('global_admins').doc(widget.user.uid), {
          'email': widget.user.email,
          'role': 'owner',
          'createdAt': FieldValue.serverTimestamp(),
        });

        await batch.commit();
      }
    } catch (e, stackTrace) {
      // Print the exact error so it is visible in the F12 browser console
      debugPrint('Oikonomos Bootstrap Guard Error: $e');
      debugPrint('$stackTrace');
    } finally {
      if (mounted) {
        setState(() {
          _checking = false;
          _bootstrapping = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: 24),
              Text(
                _bootstrapping
                    ? 'Initializing secure Sunday School database...'
                    : 'Securing administrative session...',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ],
          ),
        ),
      );
    }

    return widget.child;
  }
}
