/**
 * server.js
 * Express + Socket.IO server for Watch2Gether clone
 *
 * Features:
 * - Video uploads via /upload (Multer)
 * - Room management & logs (in-memory, replaceable by DB)
 * - Socket.IO for realtime playback sync, chat, userlist, host control
 *
 * For production: replace in-memory stores with a DB or Redis for multi-instance.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Rooms } = require('./lib/rooms');
const { Logger } = require('./lib/logger');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: { origin: '*' },
});

const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const MAX_UPLOAD = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '500000000', 10);

// ensure upload dir exists
const fs = require('fs');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, id + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD },
});

// basic middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, UPLOAD_DIR))); // serve uploaded videos

// in-memory rooms; swap with Redis or DB for multiple server instances
const rooms = new Rooms();
const logger = new Logger();

/**
 * Upload endpoint
 * Expects multipart/form-data with field 'video'
 * Query param roomId optional; if provided, the server will broadcast new video to the room.
 */
app.post('/upload', upload.single('video'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const roomId = req.body.roomId;
    const url = `${BASE_URL}/uploads/${req.file.filename}`;
    const meta = {
      filename: req.file.originalname,
      savedName: req.file.filename,
      size: req.file.size,
      url,
      uploadedAt: new Date().toISOString(),
    };

    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.video = meta;
        room.addLog({ type: 'video_uploaded', text: `${meta.filename} uploaded`, time: new Date() });
        io.to(roomId).emit('video:uploaded', { video: meta, log: room.logs.slice(-1)[0] });
      }
    }

    return res.json({ ok: true, video: meta });
  } catch (err) {
    next(err);
  }
});

// simple health
app.get('/health', (req, res) => res.json({ ok: true }));

// Serve client in production (if client build copied to server/public)
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO events
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  // join room
  socket.on('room:join', ({ roomId, username }, callback) => {
    try {
      let room = rooms.get(roomId);
      if (!room) {
        room = rooms.create(roomId);
      }
      const user = room.addUser({ socketId: socket.id, username });
      socket.join(roomId);

      // If no host assigned, make this user the host
      if (!room.hostId) {
        room.setHost(user.id);
        room.addLog({ type: 'host_assigned', text: `${user.name} became host` });
      }

      // notify room
      const joinedLog = room.addLog({
        type: 'user_joined',
        text: `${user.name} joined`,
      });

      // send current room state to this socket
      socket.emit('room:state', {
        roomId,
        users: room.userList(),
        hostId: room.hostId,
        video: room.video,
        logs: room.logs.slice(-50),
        playbackState: room.playbackState, // { playing: bool, time: seconds }
      });

      // broadcast to others
      socket.to(roomId).emit('room:user_joined', { user, log: joinedLog });
      io.to(roomId).emit('room:user_list', { users: room.userList() });

      callback && callback({ ok: true, user });
    } catch (err) {
      console.error(err);
      callback && callback({ ok: false, error: 'join_failed' });
    }
  });

  // chat message
  socket.on('chat:message', ({ roomId, userId, text }, cb) => {
    try {
      const room = rooms.get(roomId);
      if (!room) return;
      const user = room.getUser(userId);
      if (!user) return;

      // handle /name command
      if (text.trim().startsWith('/name')) {
        const newName = text.trim().slice(5).trim();
        if (newName && newName.length <= 32) {
          const old = user.name;
          room.changeUsername(userId, newName);
          const log = room.addLog({ type: 'name_changed', text: `${old} changed name to ${newName}` });
          io.to(roomId).emit('chat:log', log);
          io.to(roomId).emit('room:user_list', { users: room.userList() });
          return cb && cb({ ok: true });
        } else {
          return cb && cb({ ok: false, error: 'invalid_name' });
        }
      }

      const message = { id: uuidv4(), userId, username: user.name, text, time: new Date().toISOString() };
      room.addLog({ type: 'chat', text: `${user.name}: ${text}` });
      io.to(roomId).emit('chat:message', message);
      cb && cb({ ok: true });
    } catch (err) {
      console.error(err);
      cb && cb({ ok: false });
    }
  });

  // Host actions: play/pause/seek
  socket.on('host:action', ({ roomId, userId, action, time }, cb) => {
    try {
      const room = rooms.get(roomId);
      if (!room) return cb && cb({ ok: false, error: 'room_not_found' });

      // permission check
      if (room.hostId !== userId) return cb && cb({ ok: false, error: 'not_host' });

      // update playback state on server & broadcast
      if (action === 'play') {
        room.playbackState.playing = true;
        room.playbackState.time = time ?? room.playbackState.time;
        const log = room.addLog({ type: 'video_play', text: `Host played at ${formatTime(room.playbackState.time)}` });
        io.to(roomId).emit('host:play', { time: room.playbackState.time, log });
      } else if (action === 'pause') {
        room.playbackState.playing = false;
        room.playbackState.time = time ?? room.playbackState.time;
        const log = room.addLog({ type: 'video_pause', text: `Host paused at ${formatTime(room.playbackState.time)}` });
        io.to(roomId).emit('host:pause', { time: room.playbackState.time, log });
      } else if (action === 'seek') {
        room.playbackState.time = time;
        const log = room.addLog({ type: 'video_seek', text: `Host seeked to ${formatTime(room.playbackState.time)}` });
        io.to(roomId).emit('host:seek', { time: room.playbackState.time, log });
      }

      cb && cb({ ok: true });
    } catch (err) {
      console.error(err);
      cb && cb({ ok: false });
    }
  });

  // Request to take host
  socket.on('host:take', ({ roomId, userId }, cb) => {
    try {
      const room = rooms.get(roomId);
      if (!room) return cb && cb({ ok: false, error: 'room_not_found' });
      const user = room.getUser(userId);
      if (!user) return cb && cb({ ok: false, error: 'user_not_found' });

      // assign new host
      const previousHostId = room.hostId;
      room.setHost(userId);
      const log = room.addLog({
        type: 'host_changed',
        text: `${user.name} took host control (previous host: ${previousHostId ? (room.getUser(previousHostId)?.name || previousHostId) : 'none'})`,
      });

      io.to(roomId).emit('host:changed', { hostId: userId, log });
      io.to(roomId).emit('room:user_list', { users: room.userList() });
      cb && cb({ ok: true });
    } catch (err) {
      console.error(err);
      cb && cb({ ok: false });
    }
  });

  // upload via client (alternative to HTTP) - client may post using HTTP; we still include an event if desired
  socket.on('disconnecting', () => {
    // before actual disconnect, get rooms socket is in
    const joinedRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    joinedRooms.forEach((roomId) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const user = room.getUserBySocket(socket.id);
      if (user) {
        room.removeUser(user.id);
        const log = room.addLog({ type: 'user_left', text: `${user.name} left` });
        io.to(roomId).emit('room:user_left', { userId: user.id, log });
        io.to(roomId).emit('room:user_list', { users: room.userList() });

        // reassign host if necessary
        if (room.hostId === user.id) {
          const nextUser = room.anyUser();
          if (nextUser) {
            room.setHost(nextUser.id);
            const hostLog = room.addLog({ type: 'host_assigned', text: `${nextUser.name} became host after disconnect` });
            io.to(roomId).emit('host:changed', { hostId: nextUser.id, log: hostLog });
            io.to(roomId).emit('room:user_list', { users: room.userList() });
          } else {
            room.hostId = null;
          }
        }
      }
    });
  });

  socket.on('disconnect', () => {
    // final disconnect
    console.log('socket disconnected', socket.id);
  });
});

// helper to format seconds to mm:ss
function formatTime(sec = 0) {
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  const m = Math.floor((sec / 60) % 60).toString().padStart(2, '0');
  const h = Math.floor(sec / 3600);
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
