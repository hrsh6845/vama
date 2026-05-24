import db from './db.js';
import crypto from 'crypto';

const uuid = () => crypto.randomUUID();

const clients = [
  { id: uuid(), name: 'Acme Corp', email: 'billing@acme.com', phone: '+1-555-0101', whatsapp: '+15550101', company: 'Acme Corporation', address: '123 Main St, New York, NY 10001' },
  { id: uuid(), name: 'Globex Inc', email: 'accounts@globex.io', phone: '+1-555-0202', whatsapp: '+15550202', company: 'Globex Industries', address: '456 Oak Ave, San Francisco, CA 94102' },
  { id: uuid(), name: 'Wayne Enterprises', email: 'finance@wayne.com', phone: '+1-555-0303', whatsapp: '+15550303', company: 'Wayne Enterprises', address: '789 Gotham Blvd, Gotham, NJ 07001' },
];

const insertClient = db.prepare(`
  INSERT INTO clients (id, name, email, phone, whatsapp, company, address)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertInvoice = db.prepare(`
  INSERT INTO invoices (id, invoice_number, client_id, status, issue_date, due_date, subtotal, tax_rate, tax_amount, total, amount_paid, balance_due, share_token)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertItem = db.prepare(`
  INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, amount, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertPayment = db.prepare(`
  INSERT INTO payments (id, invoice_id, amount, payment_date, method, reference)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const seed = db.transaction(() => {
  // Clear existing data
  db.exec('DELETE FROM payments; DELETE FROM invoice_items; DELETE FROM invoices; DELETE FROM clients;');

  // Insert clients
  for (const c of clients) {
    insertClient.run(c.id, c.name, c.email, c.phone, c.whatsapp, c.company, c.address);
  }

  // Create sample invoices
  const invoices = [
    { id: uuid(), number: 'INV-2026-001', clientIdx: 0, status: 'paid', issueDate: '2026-04-01', dueDate: '2026-04-30', items: [{ desc: 'Website Redesign', qty: 1, price: 5000 }] },
    { id: uuid(), number: 'INV-2026-002', clientIdx: 1, status: 'sent', issueDate: '2026-05-01', dueDate: '2026-05-31', items: [{ desc: 'Mobile App Phase 1', qty: 1, price: 12000 }, { desc: 'UI/UX Design', qty: 1, price: 3000 }] },
    { id: uuid(), number: 'INV-2026-003', clientIdx: 2, status: 'overdue', issueDate: '2026-03-15', dueDate: '2026-04-15', items: [{ desc: 'SEO Audit', qty: 1, price: 2500 }, { desc: 'Content Strategy', qty: 1, price: 1500 }] },
    { id: uuid(), number: 'INV-2026-004', clientIdx: 0, status: 'draft', issueDate: '2026-05-20', dueDate: '2026-06-20', items: [{ desc: 'Monthly Maintenance', qty: 1, price: 1200 }] },
  ];

  for (const inv of invoices) {
    const subtotal = inv.items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const taxRate = 0;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;
    const amountPaid = inv.status === 'paid' ? total : 0;
    const balanceDue = total - amountPaid;
    const shareToken = crypto.randomBytes(16).toString('hex');

    insertInvoice.run(inv.id, inv.number, clients[inv.clientIdx].id, inv.status, inv.issueDate, inv.dueDate, subtotal, taxRate, taxAmount, total, amountPaid, balanceDue, shareToken);

    inv.items.forEach((item, idx) => {
      insertItem.run(uuid(), inv.id, item.desc, item.qty, item.price, item.qty * item.price, idx);
    });

    if (inv.status === 'paid') {
      insertPayment.run(uuid(), inv.id, total, '2026-04-25', 'bank_transfer', 'TXN-98765');
    }
  }
});

seed();
console.log('Database seeded successfully with sample data.');
