import PDFDocument from 'pdfkit';
import db from './db.js';

export function generateInvoicePDF(invoiceId, res) {
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, c.company as client_company,
           c.email as client_email, c.phone as client_phone, c.address as client_address
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(invoiceId);

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order').all(invoiceId);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(28).font('Helvetica-Bold').text('INVOICE', 50, 50);
  doc.fontSize(10).font('Helvetica').fillColor('#666666');
  doc.text(invoice.invoice_number, 50, 85);

  // Status badge
  const statusColors = { draft: '#9e9e9e', sent: '#2196f3', paid: '#4caf50', overdue: '#f44336', partial: '#ff9800' };
  const badgeColor = statusColors[invoice.status] || '#9e9e9e';
  doc.roundedRect(450, 50, 100, 24, 4).fill(badgeColor);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff')
    .text(invoice.status.toUpperCase(), 450, 57, { width: 100, align: 'center' });

  // Dates
  doc.fillColor('#333333').fontSize(10).font('Helvetica');
  doc.text(`Issue date: ${invoice.issue_date}`, 350, 90, { width: 200, align: 'right' });
  doc.text(`Due date: ${invoice.due_date}`, 350, 105, { width: 200, align: 'right' });

  // Bill To
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#999999').text('BILL TO', 50, 140);
  doc.font('Helvetica').fillColor('#333333').fontSize(12);
  let y = 158;
  if (invoice.client_company) { doc.font('Helvetica-Bold').text(invoice.client_company, 50, y); y += 18; }
  doc.font('Helvetica').fontSize(10);
  doc.text(invoice.client_name, 50, y); y += 15;
  if (invoice.client_email) { doc.text(invoice.client_email, 50, y); y += 15; }
  if (invoice.client_phone) { doc.text(invoice.client_phone, 50, y); y += 15; }
  if (invoice.client_address) { doc.text(invoice.client_address, 50, y, { width: 250 }); y += 30; }

  // Line items table
  const tableTop = Math.max(y + 20, 260);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#999999');
  doc.text('DESCRIPTION', 50, tableTop);
  doc.text('QTY', 320, tableTop, { width: 50, align: 'right' });
  doc.text('RATE', 380, tableTop, { width: 70, align: 'right' });
  doc.text('AMOUNT', 460, tableTop, { width: 90, align: 'right' });

  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#e0e0e0').stroke();

  let itemY = tableTop + 25;
  doc.font('Helvetica').fillColor('#333333').fontSize(10);
  for (const item of items) {
    doc.text(item.description, 50, itemY, { width: 260 });
    doc.text(String(item.quantity), 320, itemY, { width: 50, align: 'right' });
    doc.text(`$${item.unit_price.toFixed(2)}`, 380, itemY, { width: 70, align: 'right' });
    doc.text(`$${item.amount.toFixed(2)}`, 460, itemY, { width: 90, align: 'right' });
    itemY += 22;
  }

  // Totals
  doc.moveTo(350, itemY + 5).lineTo(550, itemY + 5).strokeColor('#e0e0e0').stroke();
  itemY += 15;

  doc.fontSize(10).font('Helvetica').fillColor('#666666');
  doc.text('Subtotal', 350, itemY, { width: 100, align: 'right' });
  doc.text(`$${invoice.subtotal.toFixed(2)}`, 460, itemY, { width: 90, align: 'right' });
  itemY += 18;

  if (invoice.tax_amount > 0) {
    doc.text(`Tax (${(invoice.tax_rate * 100).toFixed(1)}%)`, 350, itemY, { width: 100, align: 'right' });
    doc.text(`$${invoice.tax_amount.toFixed(2)}`, 460, itemY, { width: 90, align: 'right' });
    itemY += 18;
  }

  doc.font('Helvetica-Bold').fillColor('#333333').fontSize(14);
  doc.text('Total', 350, itemY, { width: 100, align: 'right' });
  doc.text(`$${invoice.total.toFixed(2)}`, 460, itemY, { width: 90, align: 'right' });
  itemY += 25;

  if (invoice.amount_paid > 0) {
    doc.fontSize(10).font('Helvetica').fillColor('#4caf50');
    doc.text('Paid', 350, itemY, { width: 100, align: 'right' });
    doc.text(`-$${invoice.amount_paid.toFixed(2)}`, 460, itemY, { width: 90, align: 'right' });
    itemY += 18;

    doc.font('Helvetica-Bold').fillColor('#f44336').fontSize(12);
    doc.text('Balance Due', 350, itemY, { width: 100, align: 'right' });
    doc.text(`$${invoice.balance_due.toFixed(2)}`, 460, itemY, { width: 90, align: 'right' });
  }

  // Notes
  if (invoice.notes) {
    const notesY = Math.max(itemY + 40, 600);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#999999').text('NOTES', 50, notesY);
    doc.font('Helvetica').fillColor('#666666').fontSize(9).text(invoice.notes, 50, notesY + 15, { width: 300 });
  }

  // Footer
  doc.fontSize(8).font('Helvetica').fillColor('#999999')
    .text('Thank you for your business.', 50, 770, { width: 500, align: 'center' });

  doc.end();
}
