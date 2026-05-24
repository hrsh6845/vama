import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, Chip, IconButton, TextField, MenuItem, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import SendIcon from '@mui/icons-material/Send';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { api } from '../../api';

const statusColors = {
  draft: 'default', sent: 'info', viewed: 'secondary', partial: 'warning',
  paid: 'success', overdue: 'error', cancelled: 'default',
};

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [shareDialog, setShareDialog] = useState({ open: false, invoice: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadInvoices = async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const data = await api.getInvoices(params);
      setInvoices(data);
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  useEffect(() => { loadInvoices(); }, [statusFilter]);

  const handleStatusChange = async (invoice, newStatus) => {
    try {
      await api.updateInvoice(invoice.id, { status: newStatus });
      setSnackbar({ open: true, message: `Invoice marked as ${newStatus}`, severity: 'success' });
      loadInvoices();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      await api.deleteInvoice(id);
      setSnackbar({ open: true, message: 'Invoice deleted', severity: 'success' });
      loadInvoices();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleWhatsAppShare = (invoice) => {
    const shareUrl = `${window.location.origin}/view/${invoice.share_token}`;
    const message = encodeURIComponent(
      `Hi ${invoice.client_name},\n\nHere's your invoice ${invoice.invoice_number} for $${invoice.total.toFixed(2)}.\n\nView it here: ${shareUrl}\n\nThank you!`
    );
    const waNumber = invoice.client_whatsapp?.replace(/[^0-9]/g, '') || '';
    const waUrl = waNumber
      ? `https://wa.me/${waNumber}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(waUrl, '_blank');

    // Mark as sent
    if (invoice.status === 'draft') {
      handleStatusChange(invoice, 'sent');
    }
  };

  const handleViewPublic = (invoice) => {
    window.open(`/view/${invoice.share_token}`, '_blank');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Invoices</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/invoices/new')} size="large">
          New Invoice
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          select label="Filter by status" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 200 }} size="small"
        >
          <MenuItem value="">All statuses</MenuItem>
          {['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'].map((s) => (
            <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>
          ))}
        </TextField>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#fafafa' }}>
              <TableCell sx={{ fontWeight: 600 }}>Invoice #</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Due Date</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Total</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Balance</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id} hover>
                <TableCell>
                  <Typography fontWeight={500}>{inv.invoice_number}</Typography>
                </TableCell>
                <TableCell>{inv.client_name}</TableCell>
                <TableCell>{inv.issue_date}</TableCell>
                <TableCell>{inv.due_date}</TableCell>
                <TableCell align="right">${inv.total.toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ color: inv.balance_due > 0 ? 'error.main' : 'success.main', fontWeight: 500 }}>
                  ${inv.balance_due.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Chip label={inv.status} color={statusColors[inv.status]} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Share via WhatsApp">
                    <IconButton size="small" onClick={() => handleWhatsAppShare(inv)} sx={{ color: '#25d366' }}>
                      <WhatsAppIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View public link">
                    <IconButton size="small" onClick={() => handleViewPublic(inv)} color="primary">
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Download PDF">
                    <IconButton size="small" onClick={() => window.open(api.getPDFUrl(inv.id), '_blank')} color="primary">
                      <PictureAsPdfIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {inv.status === 'draft' && (
                    <Tooltip title="Mark as sent">
                      <IconButton size="small" onClick={() => handleStatusChange(inv, 'sent')} color="info">
                        <SendIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => navigate(`/invoices/${inv.id}/edit`)} color="primary">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {inv.status !== 'paid' && (
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDelete(inv.id)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No invoices found.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
