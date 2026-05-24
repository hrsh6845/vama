import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Typography, TextField, MenuItem, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, Paper, Alert, Snackbar, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { api } from '../../api';

const emptyItem = { description: '', quantity: 1, unit_price: 0 };

export default function InvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    client_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    tax_rate: 0,
    notes: '',
  });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getClients().then(setClients).catch(console.error);
    if (isEditing) {
      api.getInvoice(id).then((inv) => {
        setForm({
          client_id: inv.client_id,
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          tax_rate: inv.tax_rate,
          notes: inv.notes || '',
        });
        setItems(inv.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })));
      }).catch(console.error);
    }
  }, [id, isEditing]);

  // Auto-set due date 30 days from issue date
  useEffect(() => {
    if (form.issue_date && !form.due_date) {
      const due = new Date(form.issue_date);
      due.setDate(due.getDate() + 30);
      setForm((f) => ({ ...f, due_date: due.toISOString().split('T')[0] }));
    }
  }, [form.issue_date]);

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const addItem = () => setItems([...items, { ...emptyItem }]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const subtotal = items.reduce((sum, i) => sum + (i.quantity || 0) * (i.unit_price || 0), 0);
  const taxAmount = subtotal * (form.tax_rate || 0);
  const total = subtotal + taxAmount;

  const handleSave = async () => {
    if (!form.client_id) return setSnackbar({ open: true, message: 'Please select a client', severity: 'error' });
    if (items.length === 0 || !items[0].description) {
      return setSnackbar({ open: true, message: 'Add at least one line item', severity: 'error' });
    }
    setSaving(true);
    try {
      const payload = { ...form, items };
      if (isEditing) {
        await api.updateInvoice(id, payload);
        setSnackbar({ open: true, message: 'Invoice updated', severity: 'success' });
      } else {
        const inv = await api.createInvoice(payload);
        setSnackbar({ open: true, message: `Invoice ${inv.invoice_number} created`, severity: 'success' });
        setTimeout(() => navigate('/invoices'), 1000);
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/invoices')}><ArrowBackIcon /></IconButton>
        <Typography variant="h4">{isEditing ? 'Edit Invoice' : 'New Invoice'}</Typography>
      </Box>

      <Card elevation={0} sx={{ border: '1px solid #e0e0e0', mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Invoice Details</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <TextField
              select label="Client" required value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })} fullWidth
            >
              <MenuItem value="">Select a client...</MenuItem>
              {clients.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</MenuItem>
              ))}
            </TextField>
            <Box />
            <TextField
              label="Issue Date" type="date" value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
              InputLabelProps={{ shrink: true }} fullWidth
            />
            <TextField
              label="Due Date" type="date" value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              InputLabelProps={{ shrink: true }} fullWidth
            />
            <TextField
              label="Tax Rate (%)" type="number" value={(form.tax_rate * 100) || 0}
              onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) / 100 || 0 })}
              inputProps={{ min: 0, max: 100, step: 0.1 }} fullWidth
            />
          </Box>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: '1px solid #e0e0e0', mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Line Items</Typography>
            <Button startIcon={<AddIcon />} onClick={addItem} size="small">Add Item</Button>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#fafafa' }}>
                  <TableCell sx={{ fontWeight: 600, width: '50%' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Qty</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Unit Price ($)</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
                  <TableCell sx={{ width: 50 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <TextField
                        variant="standard" fullWidth placeholder="Description"
                        value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        variant="standard" type="number" sx={{ width: 70 }}
                        inputProps={{ min: 1, style: { textAlign: 'right' } }}
                        value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        variant="standard" type="number" sx={{ width: 100 }}
                        inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right' } }}
                        value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={500}>${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}</Typography>
                    </TableCell>
                    <TableCell>
                      {items.length > 1 && (
                        <IconButton size="small" onClick={() => removeItem(idx)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 4, minWidth: 250 }}>
              <Typography color="text.secondary">Subtotal</Typography>
              <Typography fontWeight={500}>${subtotal.toFixed(2)}</Typography>
            </Box>
            {form.tax_rate > 0 && (
              <Box sx={{ display: 'flex', gap: 4, minWidth: 250 }}>
                <Typography color="text.secondary">Tax ({(form.tax_rate * 100).toFixed(1)}%)</Typography>
                <Typography fontWeight={500}>${taxAmount.toFixed(2)}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 4, minWidth: 250 }}>
              <Typography variant="h6">Total</Typography>
              <Typography variant="h6" color="primary">${total.toFixed(2)}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: '1px solid #e0e0e0', mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Notes</Typography>
          <TextField
            fullWidth multiline rows={3} placeholder="Payment terms, additional info..."
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={() => navigate('/invoices')} size="large">Cancel</Button>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}
          disabled={saving} size="large">
          {saving ? 'Saving...' : isEditing ? 'Update Invoice' : 'Create Invoice'}
        </Button>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
