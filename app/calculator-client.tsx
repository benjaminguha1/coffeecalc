'use client';

import { useEffect } from 'react';

export default function CalculatorClient({
  username,
  role,
}: {
  username: string;
  role: 'admin' | 'staff';
}) {
  useEffect(() => {
    void import('../src/main.js');
  }, []);

  return <div id="app" data-username={username} data-role={role} />;
}
