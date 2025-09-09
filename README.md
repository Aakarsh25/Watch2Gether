# Watch2Gether Clone (React + Node + Socket.IO)

A lightweight Watch2Gether-like app to watch local videos together in realtime.

## Features

- Create/join rooms by ID
- Upload videos (server stores files and serves URLs)
- Real-time playback sync: host controls play/pause/seek, guests follow
- Host control transfer ("Take Host Control")
- Chat with `/name YourName` to rename
- Activity logging (joins, name changes, host changes, uploads, play/pause/seek)
- Participant list and auto host reassignment when host disconnects
- Clean UI with TailwindCSS

## Architecture

- **Server:** Express + Socket.IO + Multer for uploads. In-memory room store (replaceable with DB/Redis for production multi-instance).
- **Client:** React (Vite) + Tailwind + Socket.IO client.

## Quick start (development)

### Prereqs
- Node.js 18+
- npm or yarn

### Server

```bash
cd server
cp .env.example .env
# edit .env if needed
npm install
npm run dev
