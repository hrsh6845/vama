import React, { useState, useEffect } from 'react';
import {
  Box, Button, Typography, TextField, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, Alert, Snackbar, Card, CardContent,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { api } from '../../api';

const methodLabels = {
  bank_transfer: 'Bank Transfer', cash: 'Cash', check: 'Check',
  paypal: 'PayPal', stripe: 'Stripe', other: 'Other',
};

export default function PaymentTracker() {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    invoice_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0],
    method: 'bank_transfer', reference: '', notes: '',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadData = async () => {
    try {
      const [paymentsData, invoicesData] = await Promise.all([
        api.getPayments(),
        api.getInvoices(),
      ]);
      setPayments(paymentsData);
      setInvoices(invoicesData.filter((i) => i.balance_due > 0 && i.status !== 'cancelled'));
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  useEffect(() => { loadData(); }, []);

  const selectedInvoice = invoices.find((i) => i.id === form.invoice_id);

  const handleSave = async () => {
    try {
      await api.createPayment({
        ...form,
        amount: parseFloat(form.amount),
      });
      setSnackbar({ open: true, message: 'Payment recorded', severity: 'success' });
      setDialogOpen(false);
      setForm({ invoice_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], method: 'bank_transfer', reference: '', notes: '' });
      loadData();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this payment? The invoice balance will be restored.')) return;
    try {
      await api.deletePayment(id);
      setSnackbar({ open: true, message: 'Payment deleted and invoice balance restored', severity: 'success' });
      loadData();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  // Summary stats
  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Payments</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} size="large"
          disabled={invoices.length === 0}>
          Record Payment
        </Button>
      </Box>

      <Card elevation={0} sx={{ border: '1px solid #e0e0e0', mb: 3, bgcolor: '#f8f9fa' }}>
        <CardContent sx={{ display: 'flex', gap: 4, alignItems: 'center', py: '16px !important' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Total collected</Typography>
            <Typography variant="h5" color="success.main" fontWeight={600}>${totalCollected.toFixed(2)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Payments recorded</Typography>
            <Typography variant="h5" fontWeight={600}>{payments.length}</Typography>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#fafafa' }}>
              <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Invoice</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Method</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Reference</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell>{p.payment_date}</TableCell>
                <TableCell><Typography fontWeight={500}>{p.invoice_number}</Typography></TableCell>
                <TableCell>{p.client_name}</TableCell>
                <TableCell align="right">
                  <Typography fontWeight={500} color="success.main">${p.amount.toFixed(2)}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={methodLabels[p.method] || p.method} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{p.reference || '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleDelete(p.id)} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No payments recorded yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Record Payment Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            select label="Invoice" required value={form.invoice_id}
            onChange={(e) => setForm({ ...form, invoice_id: e.target.value, amount: '' })} fullWidth
          >
            {invoices.map((inv) => (
              <MenuItem key={inv.id} value={inv.id}>
                {inv.invoice_number} — {inv.client_name} (Balance: ${inv.balance_due.toFixed(2)})
              </MenuItem>
            ))}
          </TextField>

          {selectedInvoice && (
            <Alert severity="info" sx={{ py: 0 }}>
              Balance due: <strong>${selectedInvoice.balance_due.toFixed(2)}</strong>
            </Alert>
          )}

          <TextField
            label="Amount ($)" type="number" required value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            inputProps={{ min: 0, step: 0.01, max: selectedInvoice?.balance_due }} fullWidth
          />
          <TextField
            label="Payment Date" type="date" value={form.payment_date}
            onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
            InputLabelProps={{ shrink: true }} fullWidth
          />
          <TextField
            select label="Payment Method" value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })} fullWidth
          >
            {Object.entries(methodLabels).map(([val, label]) => (
              <MenuItem key={val} value={val}>{label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Reference / Transaction ID" value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })} fullWidth />
          <TextField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            fullWidth multiline rows={2} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}
            disabled={!form.invoice_id || !form.amount || parseFloat(form.amount) <= 0}>
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
