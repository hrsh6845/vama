import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, Divider, CircularProgress, Alert,
} from '@mui/material';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const publicTheme = createTheme({
  palette: { primary: { main: '#1976d2' }, background: { default: '#f5f5f5' } },
  typography: { fontFamily: 'Roboto, sans-serif' },
});

const statusColors = {
  draft: 'default', sent: 'info', viewed: 'secondary', partial: 'warning',
  paid: 'success', overdue: 'error', cancelled: 'default',
};

export default function PublicInvoiceView() {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/invoices/share/${token}`)
      .then((r) => { if (!r.ok) throw new Error('Invoice not found'); return r.json(); })
      .then(setInvoice)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  );

  if (error) return (
    <ThemeProvider theme={publicTheme}><CssBaseline />
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 8, p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    </ThemeProvider>
  );

  return (
    <ThemeProvider theme={publicTheme}>
      <CssBaseline />
      <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, md: 4 }, mt: 4, mb: 4 }}>
        <Card elevation={2}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
              <Box>
                <Typography variant="h3" fontWeight={700} color="primary">INVOICE</Typography>
                <Typography variant="h6" color="text.secondary">{invoice.invoice_number}</Typography>
              </Box>
              <Chip label={invoice.status.toUpperCase()} color={statusColors[invoice.status]} size="medium"
                sx={{ fontWeight: 600, fontSize: 14 }} />
            </Box>

            {/* Dates */}
            <Box sx={{ display: 'flex', gap: 4, mb: 4 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Issue date</Typography>
                <Typography fontWeight={500}>{invoice.issue_date}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Due date</Typography>
                <Typography fontWeight={500}>{invoice.due_date}</Typography>
              </Box>
            </Box>

            {/* Bill To */}
            <Box sx={{ mb: 4, p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                Bill to
              </Typography>
              <Typography variant="h6" fontWeight={600}>{invoice.client_company || invoice.client_name}</Typography>
              {invoice.client_company && <Typography>{invoice.client_name}</Typography>}
              {invoice.client_email && <Typography color="text.secondary">{invoice.client_email}</Typography>}
              {invoice.client_address && <Typography color="text.secondary">{invoice.client_address}</Typography>}
            </Box>

            {/* Line Items */}
            <Table sx={{ mb: 3 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#fafafa' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Qty</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Rate</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">${item.unit_price.toFixed(2)}</TableCell>
                    <TableCell align="right">${item.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <Box sx={{ display: 'flex', gap: 4, minWidth: 250 }}>
                <Typography color="text.secondary">Subtotal</Typography>
                <Typography fontWeight={500}>${invoice.subtotal.toFixed(2)}</Typography>
              </Box>
              {invoice.tax_amount > 0 && (
                <Box sx={{ display: 'flex', gap: 4, minWidth: 250 }}>
                  <Typography color="text.secondary">Tax</Typography>
                  <Typography fontWeight={500}>${invoice.tax_amount.toFixed(2)}</Typography>
                </Box>
              )}
              <Divider sx={{ width: 250, my: 1 }} />
              <Box sx={{ display: 'flex', gap: 4, minWidth: 250 }}>
                <Typography variant="h6">Total</Typography>
                <Typography variant="h6" fontWeight={700}>${invoice.total.toFixed(2)}</Typography>
              </Box>
              {invoice.amount_paid > 0 && (
                <>
                  <Box sx={{ display: 'flex', gap: 4, minWidth: 250 }}>
                    <Typography color="success.main">Paid</Typography>
                    <Typography color="success.main" fontWeight={500}>-${invoice.amount_paid.toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 4, minWidth: 250 }}>
                    <Typography variant="h6" color="error">Balance Due</Typography>
                    <Typography variant="h6" color="error" fontWeight={700}>${invoice.balance_due.toFixed(2)}</Typography>
                  </Box>
                </>
              )}
            </Box>

            {/* Notes */}
            {invoice.notes && (
              <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #e0e0e0' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Notes</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>{invoice.notes}</Typography>
              </Box>
            )}

            {/* Footer */}
            <Box sx={{ mt: 4, pt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">Thank you for your business.</Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </ThemeProvider>
  );
}
