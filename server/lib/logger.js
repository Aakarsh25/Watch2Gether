class Logger {
  constructor() {
    this.store = {}; // roomId -> logs
  }

  push(roomId, log) {
    if (!this.store[roomId]) this.store[roomId] = [];
    this.store[roomId].push({ ...log, time: new Date().toISOString() });
    if (this.store[roomId].length > 1000) this.store[roomId].shift();
  }

  get(roomId) {
    return this.store[roomId] || [];
  }
}

module.exports = { Logger };
