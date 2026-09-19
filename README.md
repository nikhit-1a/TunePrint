# Tuneprint

A hybrid web application that identifies songs by listening to you hum or sing. Powered concurrently by the **ACRCloud Audio Recognition API** (for melody matching) and **Deepgram + YouTube Data API** (for lyrics transcription and matching).

## Features
- **Hybrid Recognition Engine**: Hold the button, hum a tune, or sing the lyrics. The app runs two distinct recognition engines at the same time:
  - **Melody Search**: Analyzes your humming against ACRCloud's massive acoustic fingerprint database.
  - **Lyrics Search**: Uses Deepgram's industry-leading Nova-2 AI to transcribe your singing in real-time (supporting Hindi, Telugu, English, etc.) and searches YouTube's massive database for exact lyric matches.
- **Fail-Safe Architecture**: Both engines run independently. If one API fails to find a match, it seamlessly falls back on the results of the other.
- **Smart Filtering & Badges**: Evaluates results and visually tags them in the UI with badges (`🎵 Found via Melody` or `🎤 Found via Lyrics`).
- **External Links**: Automatically generates clickable Spotify and YouTube search links for every recognized song.
- **Top Matches**: Neatly displays the top 3 best possible matches.

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- An [ACRCloud](https://www.acrcloud.com/) account and project credentials
- A [Deepgram](https://deepgram.com/) API key (for fast AI transcription)
- A [YouTube Data API v3](https://console.cloud.google.com/) key (for exact lyrics search)

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd TUNEprint
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your credentials:
   ```bash
   # Deepgram API (For Lyrics matching)
   DEEPGRAM_API_KEY=your_deepgram_api_key

   # YouTube Data API (For Lyrics matching)
   YOUTUBE_API_KEY=your_youtube_api_key

   # ACRCloud API (For Humming/Melody matching)
   ACR_HOST=identify-eu-west-1.acrcloud.com
   ACR_ACCESS_KEY=your_access_key_here
   ACR_ACCESS_SECRET=your_access_secret_here

   PORT=3000
   ```

4. Start the server:
   ```bash
   npm start
   # or run 'npm run dev' for automatic reloading during development
   ```

5. Open the Application:
   Since the frontend is a standalone HTML file, simply double-click `index.html` to open it in your browser and start humming/singing! (Ensure your backend is running in the terminal).

## Tech Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript (MediaRecorder API for audio capture)
- **Backend**: Node.js, Express, Multer
- **APIs**: Deepgram (Speech-to-Text), YouTube Data API, ACRCloud (Audio Fingerprinting)
