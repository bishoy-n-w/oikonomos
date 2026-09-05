import 'package:firebase_auth/firebase_auth.dart';

class AuthService {
  AuthService._privateConstructor();
  static final AuthService instance = AuthService._privateConstructor();

  final FirebaseAuth _auth = FirebaseAuth.instance;

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  Future<UserCredential> signInWithGoogle() async {
    final googleProvider = GoogleAuthProvider();
    // On web, this will open a Google Sign-In popup. On mobile, it will fall back to a web-based popup if native Google Sign-In is not configured.
    return await _auth.signInWithProvider(googleProvider);
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }
}
