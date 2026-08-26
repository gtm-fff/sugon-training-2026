import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminPage from '../app/admin/page';
import Home from '../app/page';
import '../app/globals.css';

const Page = window.location.pathname.startsWith('/admin') ? AdminPage : Home;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
