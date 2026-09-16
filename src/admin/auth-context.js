import { createContext, useContext } from 'react';

export const AdminAuthContext = createContext(null);

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('Admin auth provider is missing');
  return context;
}
