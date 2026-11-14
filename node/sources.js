'use strict';
const { Worker } = require('node:worker_threads');
const path = require('node:path');
class Sources {
  constructor(root) {
    this.worker = new Worker(path.join(__dirname, 'source-worker.js'), { workerData: { root } });
    this.pending = new Map(); this.sequence = 0; this.heartbeat = Date.now(); this.alive = true; this.ready = false;
    this.outbox = []; this.flushScheduled = false; this.closing = false;
    this.worker.on('message', message => {
      if (message.heartbeat) { this.heartbeat = message.heartbeat; this.ready = message.initialized && !message.failure; return; }
      const pending = this.pending.get(message.id); if (!pending) return;
      this.pending.delete(message.id); clearTimeout(pending.timer);
      if (message.error) { this.ready = false; pending.reject(new Error(message.error)); } else { this.ready = message.verification_ready !== false; pending.resolve(message.value); }
    });
    const stopped = () => { this.alive = false; this.ready = false; for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('worker_unavailable')); } this.pending.clear(); };
    this.worker.on('exit', stopped); this.worker.on('error', stopped);
  }
  call(action, key, strong = false) {
    if (!this.alive || this.closing) return Promise.reject(new Error('worker_unavailable'));
    return new Promise((resolve, reject) => {
      const id = ++this.sequence, timer = setTimeout(() => { this.pending.delete(id); reject(new Error('source_validation_timeout')); }, 120000);
      this.pending.set(id, { resolve, reject, timer }); this.outbox.push({ id, action, key, strong });
      if (!this.flushScheduled) { this.flushScheduled = true; queueMicrotask(() => { this.flushScheduled = false; if (this.alive && !this.closing) this.worker.postMessage({ requests: this.outbox.splice(0) }); }); }
    });
  }
  async close() { this.closing = true; await this.worker.terminate(); }
}
module.exports = { Sources };
