/**
 * Netlify Function: voices.js
 * Securely retrieves available voices from ElevenLabs API
 * Keeps ELEVENLABS_API_KEY strictly on the server-side
 */

const { getElevenLabsApiKey } = require('./utils/env');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed. Use GET.' })
    };
  }

  const apiKey = getElevenLabsApiKey();

  if (!apiKey) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Missing or unconfigured ELEVENLABS_API_KEY',
        message: 'Please set your ELEVENLABS_API_KEY in your local .env file or in Netlify site settings.',
        code: 'API_KEY_MISSING'
      })
    };
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey.trim(),
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.detail?.message || data?.detail || response.statusText || 'Failed to fetch voices';
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: errorMessage,
          status: response.status
        })
      };
    }

    // Sort voices: premade first, then alphabetical by name
    const voices = (data.voices || []).map(voice => ({
      voice_id: voice.voice_id,
      name: voice.name,
      category: voice.category || 'general',
      description: voice.description || (voice.labels ? Object.values(voice.labels).join(', ') : ''),
      labels: voice.labels || {},
      preview_url: voice.preview_url || null
    })).sort((a, b) => a.name.localeCompare(b.name));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        voices,
        total: voices.length
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Network or internal server error while fetching voices',
        message: err.message
      })
    };
  }
};
