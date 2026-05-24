import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import ClientManager from './components/ClientManager/ClientManager';
import InvoiceList from './components/InvoiceList/InvoiceList';
import InvoiceForm from './components/InvoiceForm/InvoiceForm';
import PaymentTracker from './components/PaymentTracker/PaymentTracker';
import PublicInvoiceView from './components/PublicInvoiceView/PublicInvoiceView';

export default function App() {
  return (
    <Routes>
      {/* Public route - no layout */}
      <Route path="/view/:token" element={<PublicInvoiceView />} />

      {/* App routes with sidebar layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<ClientManager />} />
        <Route path="/invoices" element={<InvoiceList />} />
        <Route path="/invoices/new" element={<InvoiceForm />} />
        <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
        <Route path="/payments" element={<PaymentTracker />} />
      </Route>
    </Routes>
  );
}
