/**
 * AI Voice Narrator — Frontend Application Logic
 * Integrates with Netlify serverless functions for ElevenLabs TTS
 */

(function () {
  'use strict';

  // --- Sample Text Presets ---
  const PRESETS = {
    podcast: "Welcome back to The Horizon Podcast. In today's episode, we explore how neural networks and generative audio are reshaping the landscape of creative storytelling. Stay tuned as we dive deep into the algorithms of tomorrow.",
    story: "The ancient library stretched into the mist, its towering shelves carved from obsidian stone. Somewhere in the deep silence, an automaton turned the page of a century-old chronicle, and the clock struck midnight.",
    tech: "Introducing NovaEngine, the next-generation spatial computing framework. Built for developers who demand real-time neural synthesis, zero latency, and uncompromising studio-grade fidelity.",
    meditation: "Take a deep, slow breath in. Feel the cool air fill your lungs, and as you gently exhale, release any tension carried in your shoulders. You are present, calm, and completely grounded in this moment.",
    news: "We interrupt your broadcast with a breaking bulletin: International aerospace teams have confirmed the successful rendezvous with the orbital clean-up platform, marking a historic leap in sustainable space operations."
  };

  // --- Application State ---
  const state = {
    voices: [],
    selectedVoiceId: null,
    audioBlob: null,
    audioUrl: null,
    isPlaying: false,
    audioContext: null,
    analyser: null,
    sourceNode: null,
    animationFrameId: null,
    isAudioContextInitialized: false,
    history: []
  };

  // --- DOM Elements ---
  const elements = {
    // Status & Alert
    statusBadge: document.getElementById('status-badge'),
    statusText: document.getElementById('status-text'),
    btnInfo: document.getElementById('btn-info'),
    apiAlertBanner: document.getElementById('api-alert-banner'),
    alertTitle: document.getElementById('alert-title'),
    alertMessage: document.getElementById('alert-message'),
    alertActionBtn: document.getElementById('alert-action-btn'),

    // Voice & Presets
    voiceSelect: document.getElementById('voice-select'),
    previewVoiceBtn: document.getElementById('preview-voice-btn'),
    refreshVoicesBtn: document.getElementById('refresh-voices-btn'),
    voiceCategoryTag: document.getElementById('voice-category-tag'),
    voiceDescTag: document.getElementById('voice-desc-tag'),
    presetContainer: document.getElementById('preset-container'),

    // Text Editor
    textInput: document.getElementById('text-input'),
    charCount: document.getElementById('char-count'),
    wordCount: document.getElementById('word-count'),
    estDuration: document.getElementById('est-duration'),
    charProgressBar: document.getElementById('char-progress-bar'),
    btnPaste: document.getElementById('btn-paste'),
    btnClear: document.getElementById('btn-clear'),

    // Settings
    toggleSettingsBtn: document.getElementById('toggle-settings-btn'),
    settingsPanel: document.getElementById('settings-panel'),
    modelSelect: document.getElementById('model-select'),
    sliderStability: document.getElementById('slider-stability'),
    sliderSimilarity: document.getElementById('slider-similarity'),
    sliderStyle: document.getElementById('slider-style'),
    valStability: document.getElementById('val-stability'),
    valSimilarity: document.getElementById('val-similarity'),
    valStyle: document.getElementById('val-style'),
    checkSpeakerBoost: document.getElementById('check-speaker-boost'),
    btnResetSettings: document.getElementById('btn-reset-settings'),

    // Generation
    btnGenerate: document.getElementById('btn-generate'),
    btnGenerateText: document.getElementById('btn-generate-text'),
    generateSpinner: document.getElementById('generate-spinner'),

    // Audio & Visualizer
    nativeAudio: document.getElementById('native-audio'),
    sampleAudio: document.getElementById('sample-audio'),
    visualizerCanvas: document.getElementById('visualizer-canvas'),
    visualizerEmptyState: document.getElementById('visualizer-empty-state'),
    nowPlayingBadge: document.getElementById('now-playing-badge'),
    nowPlayingVoice: document.getElementById('now-playing-voice'),

    // Controls
    seekBar: document.getElementById('seek-bar'),
    seekFill: document.getElementById('seek-fill'),
    currentTime: document.getElementById('current-time'),
    totalDuration: document.getElementById('total-duration'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    iconPlay: document.getElementById('icon-play'),
    iconPause: document.getElementById('icon-pause'),
    btnSkipBack: document.getElementById('btn-skip-back'),
    btnSkipFwd: document.getElementById('btn-skip-fwd'),
    btnReplay: document.getElementById('btn-replay'),
    speedPills: document.querySelectorAll('.speed-pill'),
    btnMute: document.getElementById('btn-mute'),
    iconVolHigh: document.getElementById('icon-vol-high'),
    iconVolMute: document.getElementById('icon-vol-mute'),
    volumeSlider: document.getElementById('volume-slider'),

    // Output Actions
    downloadBtn: document.getElementById('download-btn'),
    btnCopyScript: document.getElementById('btn-copy-script'),

    // History
    historyList: document.getElementById('history-list'),
    btnClearHistory: document.getElementById('btn-clear-history'),

    // Modal & Toast
    infoModal: document.getElementById('info-modal'),
    modalClose: document.getElementById('modal-close'),
    modalOkBtn: document.getElementById('modal-ok-btn'),
    toastContainer: document.getElementById('toast-container')
  };

  // --- Helper: Format Time (seconds -> mm:ss) ---
  function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // --- Helper: Show Toast Notification ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // --- API Endpoint Resolver ---
  // Works seamlessly with Netlify Dev (8888), Live Server (5500), static server, and production
  function getEndpoint(route) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (!isLocal) {
      return `/.netlify/functions/${route}`;
    }

    if (window.location.port === '8888' || !window.location.port) {
      return `/.netlify/functions/${route}`;
    }

    // If user opened page from a different local port (e.g. VS Code Live Server on 5500 or 3999)
    return `http://localhost:8888/.netlify/functions/${route}`;
  }

  // --- Fetch Voices from Serverless Backend ---
  async function loadVoices() {
    elements.statusBadge.className = 'status-badge checking';
    elements.statusText.textContent = 'Checking API...';
    elements.voiceSelect.innerHTML = '<option value="" disabled selected>Loading ElevenLabs voices...</option>';

    try {
      const endpoints = [...new Set([
        getEndpoint('voices'),
        '/.netlify/functions/voices',
        '/api/voices'
      ])];

      let response = null;
      let lastErr = null;

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            headers: { 'Accept': 'application/json' }
          });
          if (res.status !== 404) {
            response = res;
            break;
          }
        } catch (err) {
          lastErr = err;
        }
      }

      if (!response) {
        throw (lastErr || new Error('Cannot connect to voices endpoint'));
      }

      const data = await response.json();

      if (!response.ok) {
        handleApiError(data, response.status);
        return;
      }

      state.voices = data.voices || [];

      if (state.voices.length === 0) {
        elements.voiceSelect.innerHTML = '<option value="" disabled selected>No voices available in account</option>';
        showToast('No voices found in your ElevenLabs account.', 'warning');
        return;
      }

      populateVoiceDropdown(state.voices);
      
      // Update status to connected
      elements.statusBadge.className = 'status-badge connected';
      elements.statusText.textContent = `Connected (${state.voices.length} voices)`;
      elements.apiAlertBanner.classList.add('hidden');
      
    } catch (err) {
      handleApiError({
        error: 'Cannot connect to backend endpoint.',
        message: 'Ensure Netlify serverless functions are running (e.g. via "npx netlify dev").'
      }, 500);
    }
  }

  // --- Populate Voice Select Dropdown ---
  function populateVoiceDropdown(voices) {
    elements.voiceSelect.innerHTML = '';

    // Group voices by category
    const categories = {};
    voices.forEach(voice => {
      const cat = voice.category || 'Premade';
      const formattedCat = cat.charAt(0).toUpperCase() + cat.slice(1);
      if (!categories[formattedCat]) categories[formattedCat] = [];
      categories[formattedCat].push(voice);
    });

    Object.keys(categories).sort().forEach(catName => {
      const group = document.createElement('optgroup');
      group.label = `${catName} Voices (${categories[catName].length})`;

      categories[catName].forEach(v => {
        const option = document.createElement('option');
        option.value = v.voice_id;
        
        let labelText = v.name;
        if (v.labels && Object.keys(v.labels).length > 0) {
          const attributes = [];
          if (v.labels.accent) attributes.push(v.labels.accent);
          if (v.labels.gender) attributes.push(v.labels.gender);
          if (v.labels.descriptive) attributes.push(v.labels.descriptive);
          if (attributes.length > 0) {
            labelText += ` (${attributes.slice(0, 2).join(', ')})`;
          }
        }
        option.textContent = labelText;
        group.appendChild(option);
      });

      elements.voiceSelect.appendChild(group);
    });

    // Default selection: pick "Rachel" or "Adam" or the 1st voice
    const preferred = voices.find(v => v.name.toLowerCase() === 'rachel') 
      || voices.find(v => v.name.toLowerCase() === 'adam') 
      || voices[0];

    if (preferred) {
      elements.voiceSelect.value = preferred.voice_id;
      onVoiceChanged(preferred.voice_id);
    }
  }

  // --- Handle Selected Voice Change ---
  function onVoiceChanged(voiceId) {
    const resolvedId = voiceId || elements.voiceSelect.value;
    if (!resolvedId) return;

    state.selectedVoiceId = resolvedId;
    if (elements.voiceSelect.value !== resolvedId) {
      elements.voiceSelect.value = resolvedId;
    }

    const voice = state.voices.find(v => v.voice_id === resolvedId);
    if (!voice) return;

    elements.voiceCategoryTag.textContent = `${voice.category || 'Voice'}`;
    
    let desc = voice.description || '';
    if (!desc && voice.labels) {
      desc = Object.entries(voice.labels).map(([k, val]) => `${k}: ${val}`).join(' • ');
    }
    elements.voiceDescTag.textContent = desc || 'Studio quality AI narration voice';

    // Sample preview button
    if (voice.preview_url) {
      elements.previewVoiceBtn.disabled = false;
      elements.previewVoiceBtn.title = `Listen to a preview of ${voice.name}`;
    } else {
      elements.previewVoiceBtn.disabled = true;
      elements.previewVoiceBtn.title = 'No audio preview available for this voice';
    }
  }

  // --- Preview Voice Sample ---
  elements.previewVoiceBtn.addEventListener('click', () => {
    const activeVoiceId = elements.voiceSelect.value || state.selectedVoiceId;
    const voice = state.voices.find(v => v.voice_id === activeVoiceId);
    if (!voice || !voice.preview_url) {
      showToast('No audio preview available for this voice.', 'warning');
      return;
    }

    elements.sampleAudio.src = voice.preview_url;
    elements.sampleAudio.play()
      .then(() => {
        showToast(`Playing sample preview for ${voice.name}`, 'info');
      })
      .catch(() => {
        showToast('Unable to play sample audio preview.', 'warning');
      });
  });

  // --- Handle API Errors Gracefully ---
  function handleApiError(data, status) {
    elements.statusBadge.className = 'status-badge error';
    elements.statusText.textContent = 'API Error';

    const isKeyMissing = data?.code === 'API_KEY_MISSING' || status === 401;
    elements.alertTitle.textContent = isKeyMissing ? 'API Key Configuration Required' : 'ElevenLabs API Error';
    elements.alertMessage.textContent = data?.message || data?.error || 'Failed to authenticate with ElevenLabs API.';
    elements.apiAlertBanner.classList.remove('hidden');

    elements.voiceSelect.innerHTML = `<option value="" disabled selected>⚠️ ${data?.error || 'API Key Required'}</option>`;
    showToast(data?.error || 'ElevenLabs API configuration error', 'error');
  }

  // --- Character & Word Counting ---
  function updateTextStats() {
    const text = elements.textInput.value;
    const length = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    // Average speech rate is ~140-160 words per minute (~2.5 words per second)
    const estSec = Math.round(words / 2.5);

    elements.charCount.textContent = length.toLocaleString();
    elements.wordCount.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
    elements.estDuration.textContent = estSec > 60 
      ? `~${Math.floor(estSec / 60)}m ${estSec % 60}s speech`
      : `~${estSec}s speech`;

    const pct = Math.min(100, (length / 5000) * 100);
    elements.charProgressBar.style.width = `${pct}%`;

    if (length > 4800) {
      elements.charProgressBar.className = 'char-progress-bar limit-danger';
    } else if (length > 4000) {
      elements.charProgressBar.className = 'char-progress-bar limit-warning';
    } else {
      elements.charProgressBar.className = 'char-progress-bar';
    }
  }

  elements.textInput.addEventListener('input', updateTextStats);

  // --- Preset Selection ---
  elements.presetContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.preset-chip');
    if (!chip) return;

    elements.presetContainer.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const key = chip.dataset.preset;
    if (PRESETS[key]) {
      elements.textInput.value = PRESETS[key];
      updateTextStats();
      elements.textInput.focus();
    }
  });

  // --- Clipboard Paste & Clear ---
  elements.btnPaste.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        elements.textInput.value = text;
        updateTextStats();
        showToast('Pasted text from clipboard', 'info');
      }
    } catch {
      showToast('Clipboard access was denied by browser', 'warning');
    }
  });

  elements.btnClear.addEventListener('click', () => {
    elements.textInput.value = '';
    updateTextStats();
    elements.textInput.focus();
  });

  // --- Advanced Settings Toggle & Range Displays ---
  elements.toggleSettingsBtn.addEventListener('click', () => {
    const expanded = elements.toggleSettingsBtn.getAttribute('aria-expanded') === 'true';
    elements.toggleSettingsBtn.setAttribute('aria-expanded', !expanded);
    elements.settingsPanel.classList.toggle('hidden', expanded);
  });

  elements.sliderStability.addEventListener('input', (e) => {
    elements.valStability.textContent = `${Math.round(e.target.value * 100)}%`;
  });
  elements.sliderSimilarity.addEventListener('input', (e) => {
    elements.valSimilarity.textContent = `${Math.round(e.target.value * 100)}%`;
  });
  elements.sliderStyle.addEventListener('input', (e) => {
    elements.valStyle.textContent = `${Math.round(e.target.value * 100)}%`;
  });

  elements.btnResetSettings.addEventListener('click', () => {
    elements.sliderStability.value = 0.5;
    elements.valStability.textContent = '50%';
    elements.sliderSimilarity.value = 0.75;
    elements.valSimilarity.textContent = '75%';
    elements.sliderStyle.value = 0.0;
    elements.valStyle.textContent = '0%';
    elements.checkSpeakerBoost.checked = true;
    elements.modelSelect.value = 'eleven_multilingual_v2';
    showToast('Reset settings to recommended defaults', 'info');
  });

  // --- Text-to-Speech Generation ---
  async function generateSpeech() {
    const text = elements.textInput.value.trim();

    // Validation
    if (!text) {
      showToast('Please enter or paste some text to narrate.', 'warning');
      elements.textInput.focus();
      return;
    }

    // Ensure active voice is read directly from the DOM select element with state fallback
    const activeVoiceId = elements.voiceSelect.value || state.selectedVoiceId;

    if (!activeVoiceId) {
      showToast('Please select a voice before generating speech.', 'warning');
      return;
    }

    state.selectedVoiceId = activeVoiceId;

    // Set Loading State
    setGeneratingState(true);

    const payload = {
      text,
      voiceId: activeVoiceId,
      modelId: elements.modelSelect.value,
      voiceSettings: {
        stability: parseFloat(elements.sliderStability.value),
        similarityBoost: parseFloat(elements.sliderSimilarity.value),
        style: parseFloat(elements.sliderStyle.value),
        useSpeakerBoost: elements.checkSpeakerBoost.checked
      }
    };

    try {
      const endpoints = [...new Set([
        getEndpoint('text-to-speech'),
        '/.netlify/functions/text-to-speech',
        '/api/text-to-speech'
      ])];

      let response = null;
      let lastErr = null;

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg, application/json'
            },
            body: JSON.stringify(payload)
          });
          if (res.status !== 404) {
            response = res;
            break;
          }
        } catch (fetchErr) {
          lastErr = fetchErr;
        }
      }

      if (!response) {
        throw (lastErr || new Error('Could not connect to text-to-speech endpoint. Please verify Netlify Dev is running.'));
      }

      if (!response.ok) {
        let errData = {};
        try {
          errData = await response.json();
        } catch {
          errData = { error: `Server returned status ${response.status}` };
        }
        const errorDetail = errData.error || errData.message || (typeof errData.detail === 'string' ? errData.detail : (errData.detail?.message || JSON.stringify(errData.detail || 'Generation failed')));
        throw new Error(errorDetail);
      }

      // Read audio data safely (supports direct audio stream or base64 decoded blob)
      const contentType = response.headers.get('content-type') || '';
      let audioBlob;

      if (contentType.includes('audio') || contentType.includes('octet-stream')) {
        audioBlob = await response.blob();
      } else {
        // Fallback in case raw lambda payload is delivered
        try {
          const jsonPayload = await response.json();
          if (jsonPayload.body && jsonPayload.isBase64Encoded) {
            const binaryString = atob(jsonPayload.body);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            audioBlob = new Blob([bytes.buffer], { type: 'audio/mpeg' });
          } else {
            audioBlob = await response.blob();
          }
        } catch {
          audioBlob = await response.blob();
        }
      }

      state.audioBlob = audioBlob;

      // Revoke previous object URL if any to prevent memory leaks
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }

      state.audioUrl = URL.createObjectURL(audioBlob);
      setupGeneratedAudio(state.audioUrl, text, activeVoiceId);

      showToast('Speech generated successfully!', 'success');

    } catch (err) {
      console.error('Speech generation error:', err);
      let errMsg = err.message || 'Generation failed';
      if (errMsg === 'Failed to fetch') {
        errMsg = 'Failed to reach Netlify Dev server. Ensure "npm run dev" is running at http://localhost:8888.';
      }
      showToast(`Error: ${errMsg}`, 'error');
    } finally {
      setGeneratingState(false);
    }
  }

  function setGeneratingState(isGenerating) {
    if (isGenerating) {
      elements.btnGenerate.disabled = true;
      elements.generateSpinner.classList.remove('hidden');
      elements.btnGenerateText.textContent = 'Synthesizing Audio...';
    } else {
      elements.btnGenerate.disabled = false;
      elements.generateSpinner.classList.add('hidden');
      elements.btnGenerateText.textContent = 'Generate Narration';
    }
  }

  // --- Setup Audio Player with New Track ---
  function setupGeneratedAudio(audioUrl, textSnippet, generatedVoiceId) {
    const audio = elements.nativeAudio;
    audio.src = audioUrl;
    audio.load();

    // Enable player controls
    elements.btnPlayPause.disabled = false;
    elements.btnSkipBack.disabled = false;
    elements.btnSkipFwd.disabled = false;
    elements.btnReplay.disabled = false;
    elements.seekBar.disabled = false;

    // Resolve voice metadata
    const targetVoiceId = generatedVoiceId || state.selectedVoiceId || elements.voiceSelect.value;
    const voice = state.voices.find(v => v.voice_id === targetVoiceId);
    const voiceName = voice ? voice.name : 'AI Voice';
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const filename = `narration-${voiceName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}.mp3`;

    elements.downloadBtn.classList.remove('disabled');
    elements.downloadBtn.removeAttribute('aria-disabled');
    elements.downloadBtn.href = audioUrl;
    elements.downloadBtn.download = filename;

    // Update active voice pill
    elements.nowPlayingBadge.classList.remove('hidden');
    elements.nowPlayingVoice.textContent = `${voiceName} • Narration Ready`;

    // Hide visualizer empty state
    elements.visualizerEmptyState.classList.add('hidden');

    // Add to history
    addHistoryItem(voiceName, textSnippet, audioUrl, filename);

    // Auto play narration
    audio.play()
      .then(() => {
        initAudioVisualizer();
      })
      .catch(() => {
        // Autoplay may be blocked by browser policy until interaction
      });
  }

  // --- HTML5 Audio Visualizer using Web Audio API ---
  function initAudioVisualizer() {
    const canvas = elements.visualizerCanvas;
    const ctx = canvas.getContext('2d');
    const audio = elements.nativeAudio;

    if (!state.isAudioContextInitialized) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        state.audioContext = new AudioCtx();
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 128;

        state.sourceNode = state.audioContext.createMediaElementSource(audio);
        state.sourceNode.connect(state.analyser);
        state.analyser.connect(state.audioContext.destination);

        state.isAudioContextInitialized = true;
      } catch (e) {
        // If web audio not permitted or already attached
      }
    }

    if (state.audioContext && state.audioContext.state === 'suspended') {
      state.audioContext.resume();
    }

    renderVisualizer(canvas, ctx);
  }

  function renderVisualizer(canvas, ctx) {
    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
    }

    const bufferLength = state.analyser ? state.analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      state.animationFrameId = requestAnimationFrame(draw);

      if (state.analyser && state.isPlaying) {
        state.analyser.getByteFrequencyData(dataArray);
      } else {
        // Fade out bars gently when paused
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = Math.max(0, dataArray[i] * 0.85);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 36;
      const barWidth = (canvas.width / barCount) - 3;
      let x = 2;

      for (let i = 0; i < barCount; i++) {
        const index = Math.floor(i * (bufferLength / barCount));
        const val = dataArray[index] || 0;
        const barHeight = Math.max(4, (val / 255) * (canvas.height - 16));

        // Create gradient for bars
        const grad = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        grad.addColorStop(0, '#ec4899');
        grad.addColorStop(0.5, '#8b5cf6');
        grad.addColorStop(1, '#6366f1');

        ctx.fillStyle = grad;
        // Rounded top bars
        const y = canvas.height - barHeight - 4;
        const radius = Math.min(3, barWidth / 2);
        
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, canvas.height);
        ctx.lineTo(x, canvas.height);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();

        x += barWidth + 3;
      }
    }

    draw();
  }

  // --- Audio Event Listeners ---
  const audio = elements.nativeAudio;

  audio.addEventListener('play', () => {
    state.isPlaying = true;
    elements.iconPlay.classList.add('hidden');
    elements.iconPause.classList.remove('hidden');
    if (state.audioContext && state.audioContext.state === 'suspended') {
      state.audioContext.resume();
    }
  });

  audio.addEventListener('pause', () => {
    state.isPlaying = false;
    elements.iconPlay.classList.remove('hidden');
    elements.iconPause.classList.add('hidden');
  });

  audio.addEventListener('ended', () => {
    state.isPlaying = false;
    elements.iconPlay.classList.remove('hidden');
    elements.iconPause.classList.add('hidden');
    elements.seekBar.value = 100;
    elements.seekFill.style.width = '100%';
  });

  audio.addEventListener('loadedmetadata', () => {
    elements.totalDuration.textContent = formatTime(audio.duration);
    elements.currentTime.textContent = '00:00';
    elements.seekBar.value = 0;
    elements.seekFill.style.width = '0%';
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const current = audio.currentTime;
    const duration = audio.duration;
    elements.currentTime.textContent = formatTime(current);

    const progress = (current / duration) * 100;
    elements.seekBar.value = progress;
    elements.seekFill.style.width = `${progress}%`;
  });

  // Seekbar scrubbing
  elements.seekBar.addEventListener('input', (e) => {
    if (!audio.duration) return;
    const targetTime = (e.target.value / 100) * audio.duration;
    elements.currentTime.textContent = formatTime(targetTime);
    elements.seekFill.style.width = `${e.target.value}%`;
  });

  elements.seekBar.addEventListener('change', (e) => {
    if (!audio.duration) return;
    audio.currentTime = (e.target.value / 100) * audio.duration;
  });

  // Play / Pause Toggle
  elements.btnPlayPause.addEventListener('click', () => {
    if (!audio.src) return;
    if (audio.paused) {
      audio.play().then(() => initAudioVisualizer());
    } else {
      audio.pause();
    }
  });

  // Skip Back / Forward / Replay
  elements.btnSkipBack.addEventListener('click', () => {
    if (!audio.src) return;
    audio.currentTime = Math.max(0, audio.currentTime - 5);
  });

  elements.btnSkipFwd.addEventListener('click', () => {
    if (!audio.src) return;
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
  });

  elements.btnReplay.addEventListener('click', () => {
    if (!audio.src) return;
    audio.currentTime = 0;
    audio.play();
  });

  // Speed Pills
  elements.speedPills.forEach(pill => {
    pill.addEventListener('click', () => {
      elements.speedPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const rate = parseFloat(pill.dataset.speed);
      audio.playbackRate = rate;
    });
  });

  // Volume & Mute
  elements.volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.volume = val;
    audio.muted = (val === 0);
    updateVolumeIcon(val);
  });

  elements.btnMute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    if (audio.muted) {
      updateVolumeIcon(0);
    } else {
      updateVolumeIcon(audio.volume);
    }
  });

  function updateVolumeIcon(val) {
    if (val === 0 || audio.muted) {
      elements.iconVolHigh.classList.add('hidden');
      elements.iconVolMute.classList.remove('hidden');
    } else {
      elements.iconVolHigh.classList.remove('hidden');
      elements.iconVolMute.classList.add('hidden');
    }
  }

  // --- Copy Script Button ---
  elements.btnCopyScript.addEventListener('click', async () => {
    const text = elements.textInput.value.trim();
    if (!text) {
      showToast('No text to copy', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Script copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy to clipboard', 'warning');
    }
  });

  // --- History Management ---
  function addHistoryItem(voiceName, snippet, audioUrl, filename) {
    const item = {
      id: Date.now(),
      voiceName,
      snippet: snippet.slice(0, 75) + (snippet.length > 75 ? '...' : ''),
      fullText: snippet,
      audioUrl,
      filename,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    state.history.unshift(item);
    if (state.history.length > 6) state.history.pop();
    renderHistory();
  }

  function renderHistory() {
    if (state.history.length === 0) {
      elements.historyList.innerHTML = '<div class="history-empty">No narrations generated yet in this session.</div>';
      return;
    }

    elements.historyList.innerHTML = '';
    state.history.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="hist-info">
          <div class="hist-snippet">"${item.snippet}"</div>
          <div class="hist-meta">Voice: <strong>${item.voiceName}</strong> • ${item.time}</div>
        </div>
        <div class="hist-actions">
          <button class="btn-icon-xs hist-play-btn" title="Play Narration">
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
          <a href="${item.audioUrl}" download="${item.filename}" class="btn-icon-xs" title="Download MP3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </a>
        </div>
      `;

      el.querySelector('.hist-play-btn').addEventListener('click', () => {
        elements.nativeAudio.src = item.audioUrl;
        elements.nativeAudio.play();
        elements.nowPlayingBadge.classList.remove('hidden');
        elements.nowPlayingVoice.textContent = `${item.voiceName} • Playing`;
      });

      elements.historyList.appendChild(el);
    });
  }

  elements.btnClearHistory.addEventListener('click', () => {
    state.history = [];
    renderHistory();
    showToast('Cleared session history', 'info');
  });

  // --- Keyboard Shortcut: Ctrl + Enter / Cmd + Enter ---
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      generateSpeech();
    }
  });

  // --- Modal Events ---
  function openModal() {
    elements.infoModal.classList.remove('hidden');
  }
  function closeModal() {
    elements.infoModal.classList.add('hidden');
  }

  elements.btnInfo.addEventListener('click', openModal);
  elements.statusBadge.addEventListener('click', openModal);
  elements.alertActionBtn.addEventListener('click', openModal);
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalOkBtn.addEventListener('click', closeModal);
  elements.infoModal.addEventListener('click', (e) => {
    if (e.target === elements.infoModal) closeModal();
  });

  // --- Init Listeners ---
  elements.btnGenerate.addEventListener('click', generateSpeech);
  elements.refreshVoicesBtn.addEventListener('click', loadVoices);
  elements.voiceSelect.addEventListener('change', (e) => onVoiceChanged(e.target.value));
  elements.voiceSelect.addEventListener('input', (e) => onVoiceChanged(e.target.value));

  // Default script on startup
  elements.textInput.value = PRESETS.podcast;
  updateTextStats();

  // Load voices on page load
  loadVoices();

})();
