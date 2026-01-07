import React, { useEffect, useRef, useState } from 'react';

const isEditableTarget = (target) => {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.isContentEditable);
};

const BarcodeScannerInput = ({ onScan, enabled = true, resetAfterMs = 110 }) => {
  const [buffer, setBuffer] = useState('');
  const lastKeyTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const handleKey = (e) => {
      if (!enabled) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      const now = Date.now();
      if (now - lastKeyTimeRef.current > resetAfterMs) {
        setBuffer('');
      }

      if (e.key === 'Enter') {
        if (buffer.trim().length > 0) {
          onScan?.(buffer.trim());
          setBuffer('');
        }
      } else if (e.key && e.key.length === 1) {
        setBuffer((prev) => prev + e.key);
      }

      lastKeyTimeRef.current = now;
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enabled, buffer, onScan, resetAfterMs]);

  return null;
};

export default BarcodeScannerInput;

