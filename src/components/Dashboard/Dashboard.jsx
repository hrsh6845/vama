import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../../api';

const COLORS = ['#1976d2', '#7c4dff', '#4caf50', '#ff9800', '#f44336', '#00bcd4', '#e91e63'];

function MetricCard({ icon, label, value, color, subtext }) {
  return (
    <Card elevation={0} sx={{ border: '1px solid #e0e0e0', flex: 1, minWidth: 180 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '20px !important' }}>
        <Box sx={{ bgcolor: `${color}15`, p: 1.5, borderRadius: 2, display: 'flex' }}>
          {React.cloneElement(icon, { sx: { color, fontSize: 28 } })}
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="h5" fontWeight={600} color={color}>{value}</Typography>
          {subtext && <Typography variant="caption" color="text.secondary">{subtext}</Typography>}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const [byClient, setByClient] = useState([]);
  const [aging, setAging] = useState(null);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    Promise.all([
      api.getSummary(month, year),
      api.getByClient(),
      api.getAging(),
      api.getTrend(),
    ]).then(([s, c, a, t]) => {
      setSummary(s);
      setByClient(c.filter((cl) => cl.invoice_count > 0));
      setAging(a);
      setTrend(t);
    }).catch(console.error);
  }, [month, year]);

  const agingData = aging ? [
    { name: 'Current', value: aging.totals.current || 0 },
    { name: '1-30 days', value: aging.totals['1_30'] || 0 },
    { name: '31-60 days', value: aging.totals['31_60'] || 0 },
    { name: '61-90 days', value: aging.totals['61_90'] || 0 },
    { name: '90+ days', value: aging.totals['90_plus'] || 0 },
  ].filter((d) => d.value > 0) : [];

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: new Date(2026, i).toLocaleString('default', { month: 'long' }),
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Dashboard</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField select size="small" value={month} onChange={(e) => setMonth(e.target.value)} sx={{ width: 140 }}>
            {months.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" value={year} onChange={(e) => setYear(e.target.value)} sx={{ width: 100 }}>
            {[2024, 2025, 2026].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>
        </Box>
      </Box>

      {/* Metric Cards */}
      {summary && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <MetricCard icon={<TrendingUpIcon />} label="Billed this month" color="#1976d2"
            value={`$${summary.billed.amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`}
            subtext={`${summary.billed.count} invoices`} />
          <MetricCard icon={<CheckCircleIcon />} label="Collected this month" color="#4caf50"
            value={`$${summary.collected.amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`}
            subtext={`${summary.collected.count} payments`} />
          <MetricCard icon={<AccountBalanceIcon />} label="Total outstanding" color="#ff9800"
            value={`$${summary.outstanding.amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`}
            subtext={`${summary.outstanding.count} invoices`} />
          <MetricCard icon={<WarningIcon />} label="Overdue" color="#f44336"
            value={`$${summary.overdue.amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`}
            subtext={`${summary.overdue.count} invoices`} />
        </Box>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Revenue Trend */}
        <Card elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Revenue Trend (12 months)</Typography>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="billed" fill="#1976d2" name="Billed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" fill="#4caf50" name="Collected" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Aging Chart */}
        <Card elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Aging Report</Typography>
            {agingData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={agingData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: $${value.toFixed(0)}`}>
                    {agingData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">No outstanding invoices</Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Revenue by Client */}
      <Card elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Revenue by Client</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#fafafa' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Invoices</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Total Billed</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Paid</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Outstanding</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byClient.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Typography fontWeight={500}>{c.name}</Typography>
                      {c.company && <Typography variant="caption" color="text.secondary">{c.company}</Typography>}
                    </TableCell>
                    <TableCell align="right">{c.invoice_count}</TableCell>
                    <TableCell align="right">${c.total_billed.toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>${c.total_paid.toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ color: c.total_outstanding > 0 ? 'error.main' : 'text.primary', fontWeight: c.total_outstanding > 0 ? 600 : 400 }}>
                      ${c.total_outstanding.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
