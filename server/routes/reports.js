import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET monthly summary
router.get('/summary', (req, res) => {
  const { month, year } = req.query;
  const m = month || String(new Date().getMonth() + 1).padStart(2, '0');
  const y = year || new Date().getFullYear();
  const startDate = `${y}-${m}-01`;
  const endDate = `${y}-${m}-31`;

  const totalBilled = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as amount, COUNT(*) as count
    FROM invoices WHERE issue_date BETWEEN ? AND ?
  `).get(startDate, endDate);

  const totalPaid = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as amount, COUNT(*) as count
    FROM payments WHERE payment_date BETWEEN ? AND ?
  `).get(startDate, endDate);

  const outstanding = db.prepare(`
    SELECT COALESCE(SUM(balance_due), 0) as amount, COUNT(*) as count
    FROM invoices WHERE balance_due > 0 AND status != 'cancelled'
  `).get();

  const overdue = db.prepare(`
    SELECT COALESCE(SUM(balance_due), 0) as amount, COUNT(*) as count
    FROM invoices WHERE status = 'overdue' OR (balance_due > 0 AND due_date < date('now') AND status != 'cancelled')
  `).get();

  res.json({
    period: { month: m, year: y },
    billed: { amount: totalBilled.amount, count: totalBilled.count },
    collected: { amount: totalPaid.amount, count: totalPaid.count },
    outstanding: { amount: outstanding.amount, count: outstanding.count },
    overdue: { amount: overdue.amount, count: overdue.count },
  });
});

// GET revenue by client
router.get('/by-client', (req, res) => {
  const { from, to } = req.query;
  let sql = `
    SELECT c.id, c.name, c.company,
      COUNT(i.id) as invoice_count,
      COALESCE(SUM(i.total), 0) as total_billed,
      COALESCE(SUM(i.amount_paid), 0) as total_paid,
      COALESCE(SUM(i.balance_due), 0) as total_outstanding
    FROM clients c
    LEFT JOIN invoices i ON c.id = i.client_id
  `;
  const params = [];
  if (from && to) {
    sql += ' AND i.issue_date BETWEEN ? AND ?';
    params.push(from, to);
  }
  sql += ' GROUP BY c.id ORDER BY total_billed DESC';

  res.json(db.prepare(sql).all(...params));
});

// GET aging report
router.get('/aging', (req, res) => {
  const unpaid = db.prepare(`
    SELECT i.id, i.invoice_number, i.total, i.balance_due, i.due_date, i.status,
           c.name as client_name, c.company as client_company,
           CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.balance_due > 0 AND i.status != 'cancelled'
    ORDER BY i.due_date ASC
  `).all();

  const buckets = { current: [], '1_30': [], '31_60': [], '61_90': [], '90_plus': [] };
  for (const inv of unpaid) {
    if (inv.days_overdue <= 0) buckets.current.push(inv);
    else if (inv.days_overdue <= 30) buckets['1_30'].push(inv);
    else if (inv.days_overdue <= 60) buckets['31_60'].push(inv);
    else if (inv.days_overdue <= 90) buckets['61_90'].push(inv);
    else buckets['90_plus'].push(inv);
  }

  const totals = {};
  for (const [key, items] of Object.entries(buckets)) {
    totals[key] = items.reduce((sum, i) => sum + i.balance_due, 0);
  }

  res.json({ buckets, totals });
});

// GET monthly trend (last 12 months)
router.get('/trend', (req, res) => {
  const months = db.prepare(`
    SELECT
      strftime('%Y-%m', issue_date) as month,
      COALESCE(SUM(total), 0) as billed,
      COALESCE(SUM(amount_paid), 0) as collected
    FROM invoices
    WHERE issue_date >= date('now', '-12 months')
    GROUP BY strftime('%Y-%m', issue_date)
    ORDER BY month
  `).all();
  res.json(months);
});

export default router;
