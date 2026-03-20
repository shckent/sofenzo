import { useState, useEffect } from 'react';

export interface Procedure {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
}

export interface UserPreferences {
  products: string[];
}

export function useStore() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({ products: [] });

  // Load from local storage for now (mocking Directus)
  useEffect(() => {
    const savedProcedures = localStorage.getItem('procedures');
    if (savedProcedures) setProcedures(JSON.parse(savedProcedures));

    const savedPreferences = localStorage.getItem('preferences');
    if (savedPreferences) setPreferences(JSON.parse(savedPreferences));
  }, []);

  const addProcedures = (newProcedures: Procedure[]) => {
    setProcedures(prev => {
      const updated = [...prev, ...newProcedures];
      localStorage.setItem('procedures', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleProcedure = (id: string) => {
    setProcedures(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, completed: !p.completed } : p);
      localStorage.setItem('procedures', JSON.stringify(updated));
      return updated;
    });
  };

  const updatePreferences = (newProducts: string[]) => {
    setPreferences(prev => {
      const updated = { products: [...new Set([...prev.products, ...newProducts])] };
      localStorage.setItem('preferences', JSON.stringify(updated));
      return updated;
    });
  };

  return { procedures, addProcedures, toggleProcedure, preferences, updatePreferences };
}
