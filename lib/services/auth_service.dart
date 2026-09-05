import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

class AuthService {
  AuthService._privateConstructor();
  static final AuthService instance = AuthService._privateConstructor();

  final FirebaseAuth _auth = FirebaseAuth.instance;

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  Future<UserCredential> signInWithGoogle() async {
    final googleProvider = GoogleAuthProvider();
    
    if (kIsWeb) {
      // Use standard popup for web
      return await _auth.signInWithPopup(googleProvider);
    } else {
      // Fallback for native mobile/desktop platforms
      return await _auth.signInWithProvider(googleProvider);
    }
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }
}
