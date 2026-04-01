const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3014;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Datenbank initialisieren
const db = new Database(path.join(__dirname, 'data', 'tracker.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Tabellen erstellen
db.exec(`
  CREATE TABLE IF NOT EXISTS revenue_entries (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    break_minutes INTEGER DEFAULT 0,
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue_entries(date);
  CREATE INDEX IF NOT EXISTS idx_time_date ON time_entries(date);
`);

// Prepared Statements
const stmts = {
  // Umsatz
  getAllRevenue: db.prepare('SELECT * FROM revenue_entries ORDER BY date ASC'),
  getRevenue: db.prepare('SELECT * FROM revenue_entries WHERE id = ?'),
  insertRevenue: db.prepare('INSERT INTO revenue_entries (id, date, amount, description, created_at) VALUES (?, ?, ?, ?, ?)'),
  updateRevenue: db.prepare('UPDATE revenue_entries SET date = ?, amount = ?, description = ? WHERE id = ?'),
  deleteRevenue: db.prepare('DELETE FROM revenue_entries WHERE id = ?'),

  // Zeiten
  getAllTime: db.prepare('SELECT * FROM time_entries ORDER BY date ASC'),
  getTime: db.prepare('SELECT * FROM time_entries WHERE id = ?'),
  insertTime: db.prepare('INSERT INTO time_entries (id, date, start_time, end_time, break_minutes, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  updateTime: db.prepare('UPDATE time_entries SET date = ?, start_time = ?, end_time = ?, break_minutes = ?, note = ? WHERE id = ?'),
  deleteTime: db.prepare('DELETE FROM time_entries WHERE id = ?'),
};

// === API: Umsatz-Einträge ===

app.get('/api/entries', (req, res) => {
  const rows = stmts.getAllRevenue.all();
  res.json(rows.map(r => ({
    id: r.id,
    date: r.date,
    amount: r.amount,
    description: r.description || '',
    createdAt: r.created_at
  })));
});

app.post('/api/entries', (req, res) => {
  const { date, amount, description } = req.body;
  if (!date || amount == null) return res.status(400).json({ error: 'date und amount sind Pflicht' });
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  stmts.insertRevenue.run(id, date, amount, description || '', createdAt);
  res.status(201).json({ id, date, amount, description: description || '', createdAt });
});

app.put('/api/entries/:id', (req, res) => {
  const { date, amount, description } = req.body;
  const existing = stmts.getRevenue.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Nicht gefunden' });
  stmts.updateRevenue.run(date, amount, description || '', req.params.id);
  res.json({ id: req.params.id, date, amount, description: description || '' });
});

app.delete('/api/entries/:id', (req, res) => {
  const existing = stmts.getRevenue.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Nicht gefunden' });
  stmts.deleteRevenue.run(req.params.id);
  res.json({ ok: true });
});

// === API: Zeit-Einträge ===

app.get('/api/time-entries', (req, res) => {
  const rows = stmts.getAllTime.all();
  res.json(rows.map(r => ({
    id: r.id,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    breakMinutes: r.break_minutes,
    note: r.note || '',
    createdAt: r.created_at
  })));
});

app.post('/api/time-entries', (req, res) => {
  const { date, startTime, endTime, breakMinutes, note } = req.body;
  if (!date || !startTime || !endTime) return res.status(400).json({ error: 'date, startTime und endTime sind Pflicht' });
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  stmts.insertTime.run(id, date, startTime, endTime, breakMinutes || 0, note || '', createdAt);
  res.status(201).json({ id, date, startTime, endTime, breakMinutes: breakMinutes || 0, note: note || '', createdAt });
});

app.put('/api/time-entries/:id', (req, res) => {
  const { date, startTime, endTime, breakMinutes, note } = req.body;
  const existing = stmts.getTime.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Nicht gefunden' });
  stmts.updateTime.run(date, startTime, endTime, breakMinutes || 0, note || '', req.params.id);
  res.json({ id: req.params.id, date, startTime, endTime, breakMinutes: breakMinutes || 0, note: note || '' });
});

app.delete('/api/time-entries/:id', (req, res) => {
  const existing = stmts.getTime.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Nicht gefunden' });
  stmts.deleteTime.run(req.params.id);
  res.json({ ok: true });
});

// === API: Import/Export ===

app.get('/api/export', (req, res) => {
  const revenueEntries = stmts.getAllRevenue.all().map(r => ({
    id: r.id, date: r.date, amount: r.amount, description: r.description || '', createdAt: r.created_at
  }));
  const timeEntries = stmts.getAllTime.all().map(r => ({
    id: r.id, date: r.date, startTime: r.start_time, endTime: r.end_time,
    breakMinutes: r.break_minutes, note: r.note || '', createdAt: r.created_at
  }));
  res.json({ version: 1, exportDate: new Date().toISOString(), revenueEntries, timeEntries });
});

app.post('/api/import', (req, res) => {
  const { revenueEntries, timeEntries } = req.body;
  if (!revenueEntries && !timeEntries) return res.status(400).json({ error: 'Keine Daten zum Importieren' });

  const importAll = db.transaction(() => {
    db.exec('DELETE FROM revenue_entries');
    db.exec('DELETE FROM time_entries');

    if (revenueEntries) {
      for (const e of revenueEntries) {
        stmts.insertRevenue.run(e.id || crypto.randomUUID(), e.date, e.amount, e.description || '', e.createdAt || new Date().toISOString());
      }
    }
    if (timeEntries) {
      for (const e of timeEntries) {
        stmts.insertTime.run(e.id || crypto.randomUUID(), e.date, e.startTime, e.endTime, e.breakMinutes || 0, e.note || '', e.createdAt || new Date().toISOString());
      }
    }
  });

  importAll();
  res.json({ ok: true, revenue: (revenueEntries || []).length, time: (timeEntries || []).length });
});

app.delete('/api/reset', (req, res) => {
  db.exec('DELETE FROM revenue_entries');
  db.exec('DELETE FROM time_entries');
  res.json({ ok: true });
});

// Graceful Shutdown
process.on('SIGTERM', () => { db.close(); process.exit(0); });
process.on('SIGINT', () => { db.close(); process.exit(0); });

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Umsatz-Tracker API läuft auf http://127.0.0.1:${PORT}`);
});
