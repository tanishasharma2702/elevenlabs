/**
 * Netlify Function: text-to-speech.js
 * Securely converts text to speech using ElevenLabs API
 * Keeps ELEVENLABS_API_KEY strictly on the server-side
 */

const { getElevenLabsApiKey } = require('./utils/env');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  const apiKey = getElevenLabsApiKey();

  if (!apiKey) {
    return {
      statusCode: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Missing or unconfigured ELEVENLABS_API_KEY',
        message: 'Please set your ELEVENLABS_API_KEY in your local .env file or Netlify environment variables.',
        code: 'API_KEY_MISSING'
      })
    };
  }

  // Parse payload
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON request body.' })
    };
  }

  const { text, voiceId, modelId, voiceSettings } = payload;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Text prompt is required and cannot be empty.' })
    };
  }

  const trimmedText = text.trim();
  if (trimmedText.length > 5000) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Text length (${trimmedText.length} characters) exceeds the 5,000 character maximum limit.` })
    };
  }

  if (!voiceId || typeof voiceId !== 'string') {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'A valid voiceId is required.' })
    };
  }

  // Sanitize voice settings
  const settings = {
    stability: typeof voiceSettings?.stability === 'number' ? Math.max(0, Math.min(1, voiceSettings.stability)) : 0.5,
    similarity_boost: typeof voiceSettings?.similarityBoost === 'number' ? Math.max(0, Math.min(1, voiceSettings.similarityBoost)) : 0.75
  };

  // Only include style if explicitly greater than 0, ensuring maximum model compatibility
  if (typeof voiceSettings?.style === 'number' && voiceSettings.style > 0) {
    settings.style = Math.max(0, Math.min(1, voiceSettings.style));
  }

  // Include speaker boost if specified
  if (typeof voiceSettings?.useSpeakerBoost === 'boolean') {
    settings.use_speaker_boost = voiceSettings.useSpeakerBoost;
  }

  // Model compatibility check (ElevenLabs deprecated v1 models)
  const deprecatedModels = {
    'eleven_monolingual_v1': 'eleven_multilingual_v2',
    'eleven_multilingual_v1': 'eleven_multilingual_v2'
  };

  let selectedModel = modelId || 'eleven_multilingual_v2';
  if (deprecatedModels[selectedModel]) {
    selectedModel = deprecatedModels[selectedModel];
  }

  try {
    const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;

    const response = await fetch(elevenUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey.trim(),
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: trimmedText,
        model_id: selectedModel,
        voice_settings: settings
      })
    });

    if (!response.ok) {
      let errorDetail = 'ElevenLabs generation failed';
      try {
        const errorJson = await response.json();
        if (typeof errorJson?.detail === 'string') {
          errorDetail = errorJson.detail;
        } else if (errorJson?.detail?.message) {
          errorDetail = errorJson.detail.message;
        } else if (Array.isArray(errorJson?.detail)) {
          errorDetail = errorJson.detail.map(d => d.msg || d.message || JSON.stringify(d)).join('; ');
        } else if (errorJson?.message) {
          errorDetail = errorJson.message;
        } else if (errorJson?.detail) {
          errorDetail = typeof errorJson.detail === 'object' ? JSON.stringify(errorJson.detail) : String(errorJson.detail);
        }
      } catch {
        errorDetail = await response.text();
      }

      // Redact any accidental secret key leakage
      if (apiKey) {
        errorDetail = errorDetail.replaceAll(apiKey.trim(), '[REDACTED_API_KEY]');
      }

      console.error(`[ElevenLabs TTS Error] Voice: ${voiceId}, Model: ${selectedModel}, Status: ${response.status}, Detail: ${errorDetail}`);

      return {
        statusCode: response.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: errorDetail,
          status: response.status,
          voiceId,
          modelId: selectedModel
        })
      };
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Disposition': 'inline; filename="narration.mp3"'
      },
      body: audioBuffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Server or network error communicating with ElevenLabs API',
        message: err.message
      })
    };
  }
};
