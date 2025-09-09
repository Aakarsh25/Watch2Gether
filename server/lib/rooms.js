/**
 * Simple in-memory Room manager.
 * Replaceable with Redis/DB for production (to support multiple Node instances).
 */

const { v4: uuidv4 } = require('uuid');

class Room {
  constructor(id) {
    this.id = id;
    this.users = {}; // userId -> { id, name, socketId }
    this.hostId = null;
    this.video = null; // { filename, url, uploadedAt, ... }
    this.logs = []; // { type, text, time }
    this.playbackState = { playing: false, time: 0 }; // seconds
  }

  addUser({ socketId, username }) {
    const id = uuidv4();
    const name = username || `Guest-${Math.floor(100 + Math.random() * 900)}`;
    const user = { id, name, socketId, joinedAt: new Date().toISOString() };
    this.users[id] = user;
    return user;
  }

  removeUser(userId) {
    delete this.users[userId];
  }

  getUser(userId) {
    return this.users[userId];
  }

  getUserBySocket(socketId) {
    return Object.values(this.users).find(u => u.socketId === socketId);
  }

  anyUser() {
    const arr = Object.values(this.users);
    return arr.length ? arr[0] : null;
  }

  userList() {
    return Object.values(this.users).map(u => ({ id: u.id, name: u.name }));
  }

  setHost(userId) {
    this.hostId = userId;
  }

  changeUsername(userId, newName) {
    if (this.users[userId]) this.users[userId].name = newName;
  }

  addLog(entry) {
    const log = {
      id: uuidv4(),
      type: entry.type || 'info',
      text: entry.text,
      time: new Date().toISOString(),
    };
    this.logs.push(log);
    // keep logs reasonably bounded
    if (this.logs.length > 500) this.logs.shift();
    return log;
  }
}

class Rooms {
  constructor() {
    this.map = new Map(); // roomId -> Room
  }

  create(id) {
    const room = new Room(id || uuidv4());
    this.map.set(room.id, room);
    return room;
  }

  get(id) {
    return this.map.get(id);
  }

  delete(id) {
    this.map.delete(id);
  }
}

module.exports = { Rooms };
