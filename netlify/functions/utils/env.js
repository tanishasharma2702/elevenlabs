const path = require('path');
const fs = require('fs');

/**
 * Safely resolves and loads ELEVENLABS_API_KEY across all environments:
 * 1. Pre-configured process.env (Netlify production, CI/CD)
 * 2. Local root .env via dotenv
 * 3. Local root .env via Node.js process.loadEnvFile
 * 4. Direct filesystem fallback parser
 */
function getElevenLabsApiKey() {
  if (isValidKey(process.env.ELEVENLABS_API_KEY)) {
    return process.env.ELEVENLABS_API_KEY.trim();
  }

  // 1. Try loading via dotenv
  try {
    const dotenv = require('dotenv');
    dotenv.config();
    if (isValidKey(process.env.ELEVENLABS_API_KEY)) {
      return process.env.ELEVENLABS_API_KEY.trim();
    }

    const candidatePaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(__dirname, '../../.env'),
      path.resolve(__dirname, '../../../.env')
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        if (isValidKey(process.env.ELEVENLABS_API_KEY)) {
          return process.env.ELEVENLABS_API_KEY.trim();
        }
      }
    }
  } catch (err) {
    // dotenv might be unavailable in some runtime bundles
  }

  // 2. Try Node.js native process.loadEnvFile (Node 20.6+)
  if (typeof process.loadEnvFile === 'function') {
    const candidatePaths = [
      undefined,
      path.resolve(process.cwd(), '.env'),
      path.resolve(__dirname, '../../.env')
    ];

    for (const p of candidatePaths) {
      try {
        if (p) {
          if (fs.existsSync(p)) process.loadEnvFile(p);
        } else {
          process.loadEnvFile();
        }
        if (isValidKey(process.env.ELEVENLABS_API_KEY)) {
          return process.env.ELEVENLABS_API_KEY.trim();
        }
      } catch (err) {
        // ignore if file doesn't exist
      }
    }
  }

  // 3. Fallback: manual .env parser if running in isolated Netlify dev worker
  const candidateFiles = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env')
  ];

  for (const file of candidateFiles) {
    if (fs.existsSync(file)) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (key === 'ELEVENLABS_API_KEY' && isValidKey(val)) {
              process.env.ELEVENLABS_API_KEY = val.trim();
              return val.trim();
            }
          }
        }
      } catch (err) {
        // ignore read errors
      }
    }
  }

  return null;
}

function isValidKey(key) {
  return typeof key === 'string' && key.trim().length > 0 && key.trim() !== 'your_elevenlabs_api_key_here';
}

module.exports = {
  getElevenLabsApiKey
};
