import { describe, it, expect } from 'vitest';
// @ts-ignore - Importing CJS into TS test
import ext from '../../scripts/extract-firebase-config.cjs';
const { parseFirebaseCredentials, determineBasePath } = ext;

describe('Deployment Configuration Extractor', () => {
  
  describe('Firebase Credentials Parser', () => {
    
    it('parses a clean JSON object correctly', () => {
      const jsonStr = JSON.stringify({
        apiKey: "json-api-key",
        authDomain: "json-auth.firebaseapp.com",
        projectId: "json-project",
        storageBucket: "json-bucket.appspot.com",
        messagingSenderId: "12345",
        appId: "1:12345:web:abc"
      });
      
      const creds = parseFirebaseCredentials(jsonStr, "", {});
      expect(creds.apiKey).toBe("json-api-key");
      expect(creds.projectId).toBe("json-project");
    });

    it('parses a JS snippet object (from Firebase Console) correctly', () => {
      const jsSnippet = `
        const firebaseConfig = {
          apiKey: "js-api-key",
          authDomain: "js-auth.firebaseapp.com",
          projectId: "js-project",
          storageBucket: "js-bucket.appspot.com",
          messagingSenderId: "56789",
          appId: "1:56789:web:def"
        };
      `;
      
      const creds = parseFirebaseCredentials(jsSnippet, "", {});
      expect(creds.apiKey).toBe("js-api-key");
      expect(creds.projectId).toBe("js-project");
      expect(creds.appId).toBe("1:56789:web:def");
    });

    it('falls back to individual environment variables if JSON is missing', () => {
      const envVars = {
        VITE_FIREBASE_API_KEY: "env-api-key",
        VITE_FIREBASE_AUTH_DOMAIN: "env-auth.firebaseapp.com",
        VITE_FIREBASE_PROJECT_ID: "env-project",
        VITE_FIREBASE_STORAGE_BUCKET: "env-bucket",
        VITE_FIREBASE_MESSAGING_SENDER_ID: "111",
        VITE_FIREBASE_APP_ID: "222"
      };
      
      const creds = parseFirebaseCredentials("", "", envVars);
      expect(creds.apiKey).toBe("env-api-key");
      expect(creds.projectId).toBe("env-project");
    });

    it('falls back to legacy FIREBASE_OPTIONS_DART if others are missing', () => {
      const dartSnippet = `
        static const FirebaseOptions web = FirebaseOptions(
          apiKey: 'dart-api-key',
          appId: '1:999:web:333',
          messagingSenderId: '999',
          projectId: 'dart-project',
          authDomain: 'dart-auth.firebaseapp.com',
          storageBucket: 'dart-bucket.appspot.com',
        );
      `;
      
      const creds = parseFirebaseCredentials("", dartSnippet, {});
      expect(creds.apiKey).toBe("dart-api-key");
      expect(creds.projectId).toBe("dart-project");
    });

    it('prioritizes env vars if partially provided alongside JSON', () => {
      const jsonStr = JSON.stringify({
        apiKey: "json-api-key", // Will be overridden by env
        projectId: "json-project"
      });
      
      const envVars = {
        VITE_FIREBASE_API_KEY: "env-api-key-wins"
      };
      
      const creds = parseFirebaseCredentials(jsonStr, "", envVars);
      expect(creds.apiKey).toBe("env-api-key-wins"); // Env overrides
      expect(creds.projectId).toBe("json-project"); // Falls back to JSON for missing env
    });
  });

  describe('Dynamic Base Path Resolver', () => {
    
    it('returns / if no repository name is provided', () => {
      expect(determineBasePath("", "")).toBe("/");
    });

    it('returns custom BASE_PATH if explicitly provided', () => {
      expect(determineBasePath("user/repo", "/custom-path/")).toBe("/custom-path/");
      expect(determineBasePath("user/repo", "custom-path/")).toBe("/custom-path/"); // Prepends slash
    });

    it('returns / for .github.io root repositories', () => {
      expect(determineBasePath("username/username.github.io", "")).toBe("/");
      expect(determineBasePath("church/church.github.io", "")).toBe("/");
    });

    it('returns /repo-name/ for sub-directory repositories', () => {
      expect(determineBasePath("username/oikonomos", "")).toBe("/oikonomos/");
      expect(determineBasePath("church/sunday-school-crm", "")).toBe("/sunday-school-crm/");
    });
    
    it('handles repository names without owner cleanly', () => {
      expect(determineBasePath("my-repo", "")).toBe("/my-repo/");
    });
  });

});
