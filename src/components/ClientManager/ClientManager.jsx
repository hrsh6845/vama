import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Card, CardContent, Typography, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Alert, Snackbar, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { api } from '../../api';

const emptyClient = { name: '', email: '', phone: '', whatsapp: '', company: '', address: '', notes: '' };

export default function ClientManager() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [form, setForm] = useState(emptyClient);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [loading, setLoading] = useState(true);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getClients(search);
      setClients(data);
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadClients(); }, [loadClients]);

  const handleOpen = (client = null) => {
    setEditingClient(client);
    setForm(client ? { ...client } : emptyClient);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingClient) {
        await api.updateClient(editingClient.id, form);
        setSnackbar({ open: true, message: 'Client updated', severity: 'success' });
      } else {
        await api.createClient(form);
        setSnackbar({ open: true, message: 'Client created', severity: 'success' });
      }
      setDialogOpen(false);
      loadClients();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this client?')) return;
    try {
      await api.deleteClient(id);
      setSnackbar({ open: true, message: 'Client deleted', severity: 'success' });
      loadClients();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Clients</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} size="large">
          Add Client
        </Button>
      </Box>

      <TextField
        fullWidth placeholder="Search clients..." variant="outlined" value={search}
        onChange={(e) => setSearch(e.target.value)} sx={{ mb: 3 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
      />

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#fafafa' }}>
              <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Company</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id} hover>
                <TableCell>
                  <Typography fontWeight={500}>{client.name}</Typography>
                </TableCell>
                <TableCell>{client.company || '—'}</TableCell>
                <TableCell>{client.email || '—'}</TableCell>
                <TableCell>
                  {client.phone || '—'}
                  {client.whatsapp && (
                    <Chip icon={<WhatsAppIcon />} label="WA" size="small" color="success"
                      variant="outlined" sx={{ ml: 1 }} />
                  )}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleOpen(client)} color="primary">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(client.id)} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No clients found. Add your first client to get started.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingClient ? 'Edit Client' : 'Add Client'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Name" required value={form.name} onChange={setField('name')} fullWidth />
          <TextField label="Company" value={form.company} onChange={setField('company')} fullWidth />
          <TextField label="Email" type="email" value={form.email} onChange={setField('email')} fullWidth />
          <TextField label="Phone" value={form.phone} onChange={setField('phone')} fullWidth />
          <TextField label="WhatsApp Number" value={form.whatsapp} onChange={setField('whatsapp')} fullWidth
            helperText="Include country code, e.g. +1234567890" />
          <TextField label="Address" value={form.address} onChange={setField('address')} fullWidth multiline rows={2} />
          <TextField label="Notes" value={form.notes} onChange={setField('notes')} fullWidth multiline rows={2} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name}>Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
