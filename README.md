# Tuneprint

A lightweight web application that identifies songs simply by listening to you hum or sing. Built using Node.js and the ACRCloud Audio Recognition API.

## Features
- **Humming Recognition**: Hold the button, hum a tune for a few seconds, and let the app match it against millions of songs.
- **Smart Filtering**: Evaluates multiple results and filters out irrelevant regional databases to improve accuracy for targeted languages (like English, Hindi, and Telugu).
- **External Links**: Automatically generates clickable Spotify and YouTube search links for every recognized song.
- **Top Matches**: Neatly displays the top 3 best possible matches along with their confidence scores.
- **Customizable**: Ready to be linked to a custom ACRCloud audio bucket if you want to upload your own specialized catalog of music.

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- An [ACRCloud](https://www.acrcloud.com/) account and project credentials

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
   Copy the `env.example` file to a new file named `.env` and fill in your ACRCloud credentials.
   ```bash
   # Create .env and update these values
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
   Since the frontend is a standalone HTML file, you can simply double-click `index.html` to open it in your browser and start humming! (Ensure your backend is running in the terminal so it can process the requests).

## Tech Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript (MediaRecorder API for audio capture)
- **Backend**: Node.js, Express, Multer
- **API**: ACRCloud Identify API
