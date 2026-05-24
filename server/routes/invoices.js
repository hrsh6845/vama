import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.js';

const uuid = () => crypto.randomUUID();

const router = Router();

// Helper: get next invoice number
function getNextInvoiceNumber() {
  const year = new Date().getFullYear();
  const last = db.prepare(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`
  ).get(`INV-${year}-%`);

  if (!last) return `INV-${year}-001`;
  const num = parseInt(last.invoice_number.split('-')[2], 10) + 1;
  return `INV-${year}-${String(num).padStart(3, '0')}`;
}

// Helper: recalculate invoice totals
function recalcTotals(invoiceId) {
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);
  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const invoice = db.prepare('SELECT tax_rate, amount_paid FROM invoices WHERE id = ?').get(invoiceId);
  const taxAmount = subtotal * (invoice.tax_rate || 0);
  const total = subtotal + taxAmount;
  const balanceDue = total - (invoice.amount_paid || 0);

  db.prepare(`
    UPDATE invoices SET subtotal=?, tax_amount=?, total=?, balance_due=?, updated_at=datetime('now')
    WHERE id=?
  `).run(subtotal, taxAmount, total, balanceDue, invoiceId);
}

// GET all invoices
router.get('/', (req, res) => {
  const { status, client_id, from, to } = req.query;
  let sql = `
    SELECT i.*, c.name as client_name, c.company as client_company, c.email as client_email, c.whatsapp as client_whatsapp
    FROM invoices i
    JOIN clients c ON i.client_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (status) { sql += ' AND i.status = ?'; params.push(status); }
  if (client_id) { sql += ' AND i.client_id = ?'; params.push(client_id); }
  if (from) { sql += ' AND i.issue_date >= ?'; params.push(from); }
  if (to) { sql += ' AND i.issue_date <= ?'; params.push(to); }

  sql += ' ORDER BY i.created_at DESC';
  const invoices = db.prepare(sql).all(...params);
  res.json(invoices);
});

// GET single invoice with items and payments
router.get('/:id', (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, c.company as client_company, c.email as client_email,
           c.phone as client_phone, c.whatsapp as client_whatsapp, c.address as client_address
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order').all(req.params.id);
  invoice.payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC').all(req.params.id);
  res.json(invoice);
});

// GET public invoice by share token
router.get('/share/:token', (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, c.company as client_company, c.email as client_email,
           c.phone as client_phone, c.address as client_address
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.share_token = ?
  `).get(req.params.token);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  // Mark as viewed if sent
  if (invoice.status === 'sent') {
    db.prepare("UPDATE invoices SET status='viewed', updated_at=datetime('now') WHERE id=?").run(invoice.id);
    invoice.status = 'viewed';
  }

  invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order').all(invoice.id);
  res.json(invoice);
});

// POST create invoice
router.post('/', (req, res) => {
  const { client_id, issue_date, due_date, tax_rate, notes, items } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id is required' });
  if (!items || items.length === 0) return res.status(400).json({ error: 'At least one line item is required' });

  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(client_id);
  if (!client) return res.status(400).json({ error: 'Client not found' });

  const id = uuid();
  const invoiceNumber = getNextInvoiceNumber();
  const shareToken = crypto.randomBytes(16).toString('hex');

  const createInvoice = db.transaction(() => {
    db.prepare(`
      INSERT INTO invoices (id, invoice_number, client_id, status, issue_date, due_date, tax_rate, notes, share_token)
      VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)
    `).run(id, invoiceNumber, client_id, issue_date || new Date().toISOString().split('T')[0],
      due_date || '', tax_rate || 0, notes || null, shareToken);

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    items.forEach((item, idx) => {
      const amount = (item.quantity || 1) * item.unit_price;
      insertItem.run(uuid(), id, item.description, item.quantity || 1, item.unit_price, amount, idx);
    });

    recalcTotals(id);
  });

  createInvoice();

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);
  res.status(201).json(invoice);
});

// PUT update invoice
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found' });

  const { client_id, status, issue_date, due_date, tax_rate, notes, items } = req.body;

  const updateInvoice = db.transaction(() => {
    db.prepare(`
      UPDATE invoices SET client_id=?, status=?, issue_date=?, due_date=?, tax_rate=?, notes=?, updated_at=datetime('now')
      WHERE id=?
    `).run(
      client_id || existing.client_id, status || existing.status,
      issue_date || existing.issue_date, due_date || existing.due_date,
      tax_rate ?? existing.tax_rate, notes ?? existing.notes, req.params.id
    );

    if (items) {
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
      const insertItem = db.prepare(`
        INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, amount, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach((item, idx) => {
        const amount = (item.quantity || 1) * item.unit_price;
        insertItem.run(uuid(), req.params.id, item.description, item.quantity || 1, item.unit_price, amount, idx);
      });
      recalcTotals(req.params.id);
    }
  });

  updateInvoice();

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
  res.json(invoice);
});

// DELETE invoice
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found' });
  if (existing.status === 'paid') return res.status(400).json({ error: 'Cannot delete a paid invoice' });

  db.prepare('DELETE FROM payments WHERE invoice_id = ?').run(req.params.id);
  db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
