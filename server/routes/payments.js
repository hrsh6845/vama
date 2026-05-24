import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.js';

const uuid = () => crypto.randomUUID();

const router = Router();

// GET all payments (optionally filtered by invoice)
router.get('/', (req, res) => {
  const { invoice_id, from, to } = req.query;
  let sql = `
    SELECT p.*, i.invoice_number, c.name as client_name
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    JOIN clients c ON i.client_id = c.id
    WHERE 1=1
  `;
  const params = [];
  if (invoice_id) { sql += ' AND p.invoice_id = ?'; params.push(invoice_id); }
  if (from) { sql += ' AND p.payment_date >= ?'; params.push(from); }
  if (to) { sql += ' AND p.payment_date <= ?'; params.push(to); }
  sql += ' ORDER BY p.payment_date DESC';

  res.json(db.prepare(sql).all(...params));
});

// POST record a payment
router.post('/', (req, res) => {
  const { invoice_id, amount, payment_date, method, reference, notes } = req.body;
  if (!invoice_id || !amount) return res.status(400).json({ error: 'invoice_id and amount are required' });

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
  if (amount > invoice.balance_due + 0.01) {
    return res.status(400).json({ error: `Payment exceeds balance due ($${invoice.balance_due.toFixed(2)})` });
  }

  const id = uuid();

  const recordPayment = db.transaction(() => {
    db.prepare(`
      INSERT INTO payments (id, invoice_id, amount, payment_date, method, reference, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, invoice_id, amount, payment_date || new Date().toISOString().split('T')[0],
      method || 'other', reference || null, notes || null);

    const newAmountPaid = invoice.amount_paid + amount;
    const newBalance = invoice.total - newAmountPaid;
    const newStatus = newBalance <= 0.01 ? 'paid' : 'partial';

    db.prepare(`
      UPDATE invoices SET amount_paid=?, balance_due=?, status=?, updated_at=datetime('now')
      WHERE id=?
    `).run(newAmountPaid, Math.max(0, newBalance), newStatus, invoice_id);
  });

  recordPayment();

  const payment = db.prepare(`
    SELECT p.*, i.invoice_number FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE p.id = ?
  `).get(id);
  res.status(201).json(payment);
});

// DELETE a payment (reverses the amount)
router.delete('/:id', (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  const reversePayment = db.transaction(() => {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(payment.invoice_id);
    const newAmountPaid = Math.max(0, invoice.amount_paid - payment.amount);
    const newBalance = invoice.total - newAmountPaid;
    const newStatus = newAmountPaid <= 0 ? 'sent' : 'partial';

    db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
    db.prepare(`
      UPDATE invoices SET amount_paid=?, balance_due=?, status=?, updated_at=datetime('now')
      WHERE id=?
    `).run(newAmountPaid, newBalance, newStatus, payment.invoice_id);
  });

  reversePayment();
  res.status(204).send();
});

export default router;
