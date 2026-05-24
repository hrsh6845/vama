import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.js';

const uuid = () => crypto.randomUUID();

const router = Router();

// GET all clients
router.get('/', (req, res) => {
  const { search } = req.query;
  let clients;
  if (search) {
    clients = db.prepare(`
      SELECT * FROM clients
      WHERE name LIKE ? OR company LIKE ? OR email LIKE ?
      ORDER BY name
    `).all(`%${search}%`, `%${search}%`, `%${search}%`);
  } else {
    clients = db.prepare('SELECT * FROM clients ORDER BY name').all();
  }
  res.json(clients);
});

// GET single client
router.get('/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

// POST create client
router.post('/', (req, res) => {
  const { name, email, phone, whatsapp, company, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const id = uuid();
  db.prepare(`
    INSERT INTO clients (id, name, email, phone, whatsapp, company, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, email || null, phone || null, whatsapp || null, company || null, address || null, notes || null);

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  res.status(201).json(client);
});

// PUT update client
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client not found' });

  const { name, email, phone, whatsapp, company, address, notes } = req.body;
  db.prepare(`
    UPDATE clients SET name=?, email=?, phone=?, whatsapp=?, company=?, address=?, notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    name || existing.name, email ?? existing.email, phone ?? existing.phone,
    whatsapp ?? existing.whatsapp, company ?? existing.company,
    address ?? existing.address, notes ?? existing.notes, req.params.id
  );

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  res.json(client);
});

// DELETE client
router.delete('/:id', (req, res) => {
  const invoiceCount = db.prepare('SELECT COUNT(*) as count FROM invoices WHERE client_id = ?').get(req.params.id);
  if (invoiceCount.count > 0) {
    return res.status(400).json({ error: 'Cannot delete client with existing invoices' });
  }
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
