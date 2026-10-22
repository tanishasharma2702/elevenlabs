# 🎙️ AI Voice Narrator

A complete, modern, responsive web application that converts text into studio-grade human speech using the **ElevenLabs Text-to-Speech API**.

Built with semantic **HTML5**, modern **CSS3 (Glassmorphism design)**, and clean **JavaScript**, backed by secure **Netlify Serverless Functions** to keep your ElevenLabs API key strictly private.

![AI Voice Narrator](public/favicon.svg)

---

## ✨ Features

- **Large Textarea & Presets**: Paste or write up to 5,000 characters. Includes 1-click sample presets for podcasts, storytelling, tech pitches, meditation, and breaking news.
- **Dynamic ElevenLabs Voice Selection**: Automatically fetches all available AI voices from your ElevenLabs account, categorized with accent, gender, and descriptive labels.
- **Voice Sample Preview**: Instant 1-click sample preview to listen to any voice before synthesizing.
- **Custom Modern Audio Player**:
  - Interactive scrubbing seekbar with live timestamp displays (`mm:ss`).
  - Big Play / Pause / Replay controls and ±5-second skip buttons.
  - Real-time **HTML5 Canvas Audio Visualizer** rendering frequency animations.
  - Multi-speed playback selector (`0.75x`, `1.0x`, `1.25x`, `1.5x`).
  - Smooth volume slider and instant mute toggle.
- **Download Audio (.MP3)**: 1-click download button with timestamped file naming (e.g. `narration-rachel-20261022193000.mp3`).
- **Advanced Voice Controls (Optional Accordion)**:
  - Model selection: `Multilingual v2` (29 languages), `Turbo v2.5` (Ultra-low latency), or `Monolingual v1`.
  - Precision sliders for Stability, Clarity / Similarity Boost, and Style Exaggeration.
  - Speaker Boost toggle.
- **Real-Time Validation & Counters**: Character count with safety threshold indicators, word counter, and estimated speech duration.
- **Session History**: Keeps track of recent narrations in your session for instant replay and download.
- **Enterprise-Grade Security**: The ElevenLabs API key is never exposed to the browser. All API requests route through serverless Netlify Functions.
- **Keyboard Shortcut**: Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (or <kbd>Cmd</kbd> + <kbd>Enter</kbd>) to generate narration instantly.

---

## 🔒 Security Architecture

```
┌─────────────────────────────────┐
│     Client Browser (Frontend)   │
│   (HTML, CSS, Vanilla JS)       │
└───────────────┬─────────────────┘
                │  POST /api/text-to-speech
                │  GET  /api/voices
                ▼
┌─────────────────────────────────┐
│     Netlify Serverless Backend  │
│  (netlify/functions/*.js)       │
│  • Reads ELEVENLABS_API_KEY     │
│  • Validates payload            │
└───────────────┬─────────────────┘
                │  xi-api-key: [SERVER ENV SECRET]
                ▼
┌─────────────────────────────────┐
│     ElevenLabs Official API     │
│     https://api.elevenlabs.io   │
└─────────────────────────────────┘
```

Your `ELEVENLABS_API_KEY` is stored strictly as a server-side environment variable. Neither the frontend HTML/JS nor GitHub repositories ever receive or expose your private key.

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- An [ElevenLabs account](https://elevenlabs.io) with an active API key

### 2. Clone or Navigate to the Project Folder
```bash
cd "c:\Users\mudit\Desktop\ELEVEN LABS"
```

### 3. Configure Your ElevenLabs API Key
Copy the template `.env.example` into a local `.env` file:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Open `.env` in any text editor and insert your actual ElevenLabs API key:
```env
ELEVENLABS_API_KEY=sk_your_actual_elevenlabs_api_key_here
```
> ⚠️ **Note:** `.env` is already included in `.gitignore` to prevent accidental commits to version control.

### 4. Install Dependencies
Install the Netlify CLI dev dependency:
```bash
npm install
```

### 5. Start the Local Server with Netlify Functions
Run the local development server:
```bash
npm run dev
```
*(or run directly: `npx netlify dev`)*

The Netlify CLI will:
1. Load your `.env` variables automatically.
2. Spin up the serverless backend functions at `/.netlify/functions/*`.
3. Open your browser at `http://localhost:8888`.

---

## 🧪 Testing the Application

1. **Verify API Connection**:
   - Check the top right header badge. It should display a pulsing green dot: **Connected (X voices)**.
   - If no API key was configured, an amber alert banner will guide you to set it up.
2. **Choose an AI Voice**:
   - Open the **Select AI Voice** dropdown. Select any voice (e.g., "Rachel", "Adam", "Drew").
   - Click **Play Sample** to hear a preview snippet.
3. **Write or Pick a Preset**:
   - Click one of the preset pills (e.g. *🎙️ Podcast*, *📖 Storyteller*, *🚀 Tech Pitch*) or type your own text.
   - Observe live character, word, and estimated speech duration counters.
4. **Generate Narration**:
   - Click **Generate Narration** or press `Ctrl + Enter`.
   - The button shows a loading spinner while ElevenLabs synthesizes the voice.
5. **Listen & Visualizer**:
   - The player activates with a real-time glowing audio visualizer.
   - Test Play, Pause, Skip ±5s, and timeline scrubbing.
   - Test speed buttons (`0.75x`, `1.0x`, `1.25x`, `1.5x`).
6. **Download**:
   - Click **Download Audio (.MP3)** to save the high-fidelity audio file locally.

---

## ☁️ Deployment Guide

### Deploying to Netlify

#### Option A: Deploy via Netlify CLI (Fastest)
```bash
# Log in to Netlify
npx netlify login

# Deploy and link to a new or existing site
npx netlify deploy --prod
```

#### Option B: Deploy via GitHub + Netlify Web UI (Continuous Deployment)
1. Initialize a git repository and commit the project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: AI Voice Narrator"
   ```
2. Push the repository to your GitHub account:
   ```bash
   git remote add origin https://github.com/your-username/ai-voice-narrator.git
   git branch -M main
   git push -u origin main
   ```
3. Go to [Netlify Dashboard](https://app.netlify.com) and click **"Add new site" > "Import an existing project"**.
4. Select GitHub and pick your repository.
5. In the build settings:
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
   *(These are pre-configured automatically via `netlify.toml`)*
6. **Set the Environment Variable**:
   - In Netlify, go to **Site configuration > Environment variables**.
   - Click **"Add a variable"**.
   - Key: `ELEVENLABS_API_KEY`
   - Value: `your_actual_elevenlabs_api_key`
   - Scope: *All scopes (Functions & Builds)*
   - Click **Save**.
7. Click **"Deploy site"**. Your production URL will be live with full text-to-speech functionality!

---

## 📂 Project Structure

```
ELEVEN LABS/
├── public/                       # Frontend web application
│   ├── index.html                # Semantic UI structure & accessibility
│   ├── favicon.svg               # Vector brand logo
│   ├── css/
│   │   └── style.css             # Glassmorphism design system & animations
│   └── js/
│       └── app.js                # State, audio player, visualizer, & API calls
├── netlify/
│   └── functions/                # Secure serverless backend
│       ├── voices.js             # GET: Fetches account voices securely
│       └── text-to-speech.js     # POST: Converts text to MP3 binary
├── .env.example                  # Environment variable reference
├── .gitignore                    # Prevents secret & node_modules leakage
├── netlify.toml                  # Netlify build, dev, and API redirect configuration
├── package.json                  # DevDependencies and npm scripts
└── README.md                     # Documentation & setup guide
```

---

## 🛠️ API Reference (Serverless Endpoints)

### `GET /api/voices` (or `/.netlify/functions/voices`)
- **Headers**: None required from browser.
- **Returns**: JSON list of available ElevenLabs voices with metadata (ID, name, category, accent, preview audio).
- **Security**: Injects `xi-api-key` on the server.

### `POST /api/text-to-speech` (or `/.netlify/functions/text-to-speech`)
- **Request Body**:
  ```json
  {
    "text": "Hello world from ElevenLabs!",
    "voiceId": "21m00Tcm4TlvDq8ikWAM",
    "modelId": "eleven_multilingual_v2",
    "voiceSettings": {
      "stability": 0.5,
      "similarityBoost": 0.75,
      "style": 0.0,
      "useSpeakerBoost": true
    }
  }
  ```
- **Returns**: `audio/mpeg` binary audio stream (base64-encoded via Netlify lambda).

---

## 📄 License
MIT License. Created for high-performance AI speech synthesis.
