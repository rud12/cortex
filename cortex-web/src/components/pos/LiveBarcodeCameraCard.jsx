import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'qr_code'];

const LiveBarcodeCameraCard = ({
  enabled = true,
  onDetected,
  cacheStatus = { loading: false, loadedProducts: 0, loadedPages: 0, totalPages: 0 },
  onRefreshCache
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(0);
  const mountedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const latchedCodeRef = useRef('');
  const noCodeSinceRef = useRef(0);
  const scanBusyRef = useRef(false);

  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const [lastScan, setLastScan] = useState('');

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const stopCamera = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
    scanBusyRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const scanLoop = useCallback(() => {
    if (!mountedRef.current || !enabled || !videoRef.current || !detectorRef.current) return;

    frameRef.current = requestAnimationFrame(scanLoop);
    if (scanBusyRef.current) return;
    scanBusyRef.current = true;

    detectorRef.current
      .detect(videoRef.current)
      .then((results) => {
        if (!Array.isArray(results) || results.length === 0) {
          if (!noCodeSinceRef.current) {
            noCodeSinceRef.current = Date.now();
          }
          if (noCodeSinceRef.current && Date.now() - noCodeSinceRef.current > 550) {
            latchedCodeRef.current = '';
          }
          return;
        }

        noCodeSinceRef.current = 0;
        const code = String(results[0]?.rawValue || '').trim();
        if (!code) return;
        if (latchedCodeRef.current === code) return;

        latchedCodeRef.current = code;
        setLastScan(code);
        onDetectedRef.current?.(code);
      })
      .catch(() => {

      })
      .finally(() => {
        scanBusyRef.current = false;
      });
  }, [enabled]);

  const startCamera = useCallback(async () => {
    if (!enabled) return;

    stopCamera();
    setState('starting');
    setMessage('');
    latchedCodeRef.current = '';
    noCodeSinceRef.current = 0;

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      setMessage('Camera is not available in this browser.');
      return;
    }
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
      setState('unsupported');
      setMessage('BarcodeDetector is not supported in this browser.');
      return;
    }

    try {
      let detector = null;
      try {
        detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
      } catch {
        detector = new window.BarcodeDetector();
      }
      detectorRef.current = detector;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});

      setState('running');
      setMessage('Camera live. Point barcode to the frame for auto-add.');
      frameRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      setState('error');
      setMessage(err?.message || 'Unable to start camera scanner.');
      stopCamera();
    }
  }, [enabled, scanLoop, stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [enabled, startCamera, stopCamera]);

  useEffect(() => {
    const onPageHide = () => stopCamera();
    const onVisibility = () => {
      if (document.hidden) stopCamera();
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [stopCamera]);

  return (
    <Box className="cortex-card" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
        Live Barcode Camera
      </Typography>

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.66)', display: 'block', mt: 0.4 }}>
        {cacheStatus.loading
          ? `Loading catalog... (${cacheStatus.loadedPages}/${cacheStatus.totalPages || '...'} pages)`
          : `Catalog ready: ${Number(cacheStatus.loadedProducts || 0)} products cached`}
      </Typography>

      <Box
        sx={{
          mt: 1.5,
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.16)',
          overflow: 'hidden',
          minHeight: 220,
          bgcolor: '#04060f'
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '220px',
            objectFit: 'cover',
            display: state === 'running' ? 'block' : 'none'
          }}
        />

        {state !== 'running' ? (
          <Box
            sx={{
              height: 220,
              display: 'grid',
              placeItems: 'center',
              color: 'rgba(255,255,255,0.76)',
              px: 2,
              textAlign: 'center',
              fontSize: 13
            }}
          >
            {state === 'starting' ? 'Starting camera...' : message || 'Camera is not active.'}
          </Box>
        ) : null}
      </Box>

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.70)', display: 'block', mt: 1.2 }}>
        {message}
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.70)', display: 'block', mt: 0.4 }}>
        Last scan: {lastScan || '—'}
      </Typography>

      <Box sx={{ mt: 1.4, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={startCamera}>
          Restart Camera
        </Button>
        <Button variant="outlined" onClick={onRefreshCache}>
          Refresh Cache
        </Button>
      </Box>
    </Box>
  );
};

export default LiveBarcodeCameraCard;
