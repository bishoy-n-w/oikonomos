const fs = require('fs');

/**
 * Extracts Firebase credentials from various possible user inputs:
 * 1. A pure JSON object
 * 2. A JS snippet (e.g., const firebaseConfig = { ... })
 * 3. A Dart snippet (static const FirebaseOptions web = ...)
 * 4. Fallback to individual environment variables
 */
function parseFirebaseCredentials(configJson, dartSnippet, envVars) {
  let apiKey = envVars.VITE_FIREBASE_API_KEY || "";
  let authDomain = envVars.VITE_FIREBASE_AUTH_DOMAIN || "";
  let projectId = envVars.VITE_FIREBASE_PROJECT_ID || "";
  let storageBucket = envVars.VITE_FIREBASE_STORAGE_BUCKET || "";
  let messagingSenderId = envVars.VITE_FIREBASE_MESSAGING_SENDER_ID || "";
  let appId = envVars.VITE_FIREBASE_APP_ID || "";

  // Helper to extract via Regex for non-JSON objects
  const extractRegex = (source, key) => {
    const m = source.match(new RegExp(key + "\\s*:\\s*[\x27\x22]([^\x27\x22]+)[\x27\x22]"));
    return m ? m[1] : "";
  };

  if (configJson) {
    try {
      // First try strict JSON parse by stripping out any preceding/trailing JS code
      const cleaned = configJson.replace(/^[^{]*{/, '{').replace(/}[^}]*$/, '}');
      const parsed = JSON.parse(cleaned);
      apiKey = apiKey || parsed.apiKey || "";
      authDomain = authDomain || parsed.authDomain || "";
      projectId = projectId || parsed.projectId || "";
      storageBucket = storageBucket || parsed.storageBucket || "";
      messagingSenderId = messagingSenderId || parsed.messagingSenderId || "";
      appId = appId || parsed.appId || "";
    } catch {
      // If parsing fails (e.g. unquoted keys in JS snippet), fallback to regex
      apiKey = apiKey || extractRegex(configJson, 'apiKey');
      authDomain = authDomain || extractRegex(configJson, 'authDomain');
      projectId = projectId || extractRegex(configJson, 'projectId');
      storageBucket = storageBucket || extractRegex(configJson, 'storageBucket');
      messagingSenderId = messagingSenderId || extractRegex(configJson, 'messagingSenderId');
      appId = appId || extractRegex(configJson, 'appId');
    }
  }

  // Fallback to legacy Dart options if present
  if (dartSnippet && !apiKey) {
    const match = dartSnippet.match(/static const FirebaseOptions web = FirebaseOptions\(([\s\S]*?)\);/);
    if (match) {
      const block = match[1];
      apiKey = apiKey || extractRegex(block, 'apiKey');
      authDomain = authDomain || extractRegex(block, 'authDomain');
      projectId = projectId || extractRegex(block, 'projectId');
      storageBucket = storageBucket || extractRegex(block, 'storageBucket');
      messagingSenderId = messagingSenderId || extractRegex(block, 'messagingSenderId');
      appId = appId || extractRegex(block, 'appId');
    }
  }

  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
}

/**
 * Calculates the correct BASE_PATH for Vite during GitHub Pages deployment
 */
function determineBasePath(repoName, providedBasePath) {
  if (providedBasePath) {
    return providedBasePath.startsWith('/') ? providedBasePath : `/${providedBasePath}`;
  }
  
  // If no repository name is provided, default to root
  if (!repoName) return '/';
  
  // Clean repository name from 'owner/repo' format to 'repo'
  const repo = repoName.includes('/') ? repoName.split('/')[1] : repoName;
  
  // If repository is a user/org root page (e.g., username.github.io)
  if (repo.toLowerCase().endsWith('.github.io')) {
    return '/';
  }
  
  return `/${repo}/`;
}

// Main execution only if called directly from CLI
if (require.main === module) {
  const configJson = process.env.FIREBASE_CONFIG_JSON || "";
  const dartSnippet = process.env.FIREBASE_OPTIONS_DART || "";
  const envVars = process.env;

  const creds = parseFirebaseCredentials(configJson, dartSnippet, envVars);
  
  if (creds.apiKey && creds.projectId) {
    const envContent = [
      `VITE_FIREBASE_API_KEY=${creds.apiKey}`,
      `VITE_FIREBASE_AUTH_DOMAIN=${creds.authDomain}`,
      `VITE_FIREBASE_PROJECT_ID=${creds.projectId}`,
      `VITE_FIREBASE_STORAGE_BUCKET=${creds.storageBucket}`,
      `VITE_FIREBASE_MESSAGING_SENDER_ID=${creds.messagingSenderId}`,
      `VITE_FIREBASE_APP_ID=${creds.appId}`
    ].join("\n");
    
    fs.writeFileSync(".env.local", envContent);
    console.log("✅ Successfully extracted and wrote Firebase web credentials to .env.local");
  } else {
    console.warn("⚠️ Warning: Incomplete Firebase credentials provided. Ensure FIREBASE_CONFIG_JSON, FIREBASE_OPTIONS_DART, or VITE_FIREBASE_* secrets are set in repository settings.");
  }

  const repoName = process.env.GITHUB_REPOSITORY || "";
  const varsBasePath = process.env.VARS_BASE_PATH || process.env.SECRETS_BASE_PATH || "";
  
  const basePath = determineBasePath(repoName, varsBasePath);
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `\nBASE_PATH=${basePath}\n`);
  }
  console.log(`✅ Dynamically resolved BASE_PATH to: ${basePath}`);
}

module.exports = { parseFirebaseCredentials, determineBasePath };
