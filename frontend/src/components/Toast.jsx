
import React, { useState, useEffect } from 'react';

const VARIANT_STYLES = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-black/85 text-white'
};

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    
    window.showToast = (text, duration = 3500, variant = 'info') => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, text, variant }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    };

    return () => {
      try { delete window.showToast; } catch {}
    };
  }, []);

  return (
    
    <div aria-live="polite" className="fixed top-4 right-4 z-50 flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} text={t.text} variant={t.variant} />
      ))}
    </div>
  );
}

function ToastItem({ text, variant = 'info' }) {
 
  const [show, setShow] = useState(false);

  useEffect(() => {
    
    const id = setTimeout(() => setShow(true), 10);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      
      className={`pointer-events-auto transform transition-all duration-250 ease-out
        ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        ${VARIANT_STYLES[variant] || VARIANT_STYLES.info}
        px-4 py-2 rounded-lg shadow-lg max-w-sm`}
      role="status"
    >
      <div className="text-sm">{text}</div>
    </div>
  );
}
