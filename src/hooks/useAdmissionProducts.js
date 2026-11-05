import { useEffect, useState } from 'react';
import { loadAdmissionProducts } from '../lib/catalog';

export default function useAdmissionProducts() {
  const [state, setState] = useState({ products: [], loading: true, error: '' });

  useEffect(() => {
    let active = true;
    let timer;
    const refresh = async () => {
      try {
        const products = await loadAdmissionProducts();
        if (!active) return;
        setState({ products, loading: false, error: '' });
        timer = window.setTimeout(refresh, 60_000);
      } catch (error) {
        if (active) setState({ products: [], loading: false, error: error.message });
      }
    };
    refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  return state;
}
