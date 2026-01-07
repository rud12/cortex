import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Pagination,
  Skeleton,
  TextField,
  Typography
} from '@mui/material';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import { toast } from 'react-toastify';

import { inventoryService } from '../../services/api/inventoryService';
import { visionService } from '../../services/api/visionService';
import { useAuth } from '../../contexts/AuthContext';
import ProductForm from '../../components/inventory/ProductForm';
import ProductTable from '../../components/inventory/ProductTable';

const dedupeById = (list = []) => {
  const map = new Map();
  list.forEach((item) => {
    if (!item?.id) return;
    if (!map.has(item.id)) map.set(item.id, item);
  });
  return Array.from(map.values());
};

const ProductsPage = () => {
  const { roles } = useAuth();
  const canEdit = roles.includes('Administrator') || roles.includes('WarehouseManager');

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [referenceStatusByProduct, setReferenceStatusByProduct] = useState({});
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanFrameRef = useRef(0);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const [res, statusRes] = await Promise.all([
        inventoryService.listProducts(p, 20),
        visionService.getProductReferenceStatus().catch(() => null)
      ]);
      if (!res?.success) throw new Error(res?.error?.message || 'Failed to load');
      setProducts(dedupeById(res.data || []));
      setTotalPages(res.pagination?.totalPages || 1);
      if (statusRes?.success) {
        const map = Object.create(null);
        (statusRes.data?.items || []).forEach((item) => {
          map[item.product_id] = item;
        });
        setReferenceStatusByProduct(map);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  const stopScanner = () => {
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => () => stopScanner(), []);

  useEffect(() => {
    if (!scannerOpen) return undefined;
    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Camera is not available on this browser');
        setScannerOpen(false);
        return;
      }
      if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
        toast.error('Barcode scanner is not supported in this browser');
        setScannerOpen(false);
        return;
      }

      const detector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e']
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});

      const scanLoop = async () => {
        if (cancelled || !videoRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          if (results.length > 0) {
            const scanned = String(results[0].rawValue || '').replace(/[^\d]/g, '');
            setSearch(scanned || String(results[0].rawValue || ''));
            toast.success('Barcode scanned');
            stopScanner();
            setScannerOpen(false);
            return;
          }
        } catch {

        }
        scanFrameRef.current = requestAnimationFrame(scanLoop);
      };
      scanFrameRef.current = requestAnimationFrame(scanLoop);
    };

    start().catch(() => {
      toast.error('Unable to start barcode scanner');
      setScannerOpen(false);
      stopScanner();
    });

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [scannerOpen]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return products;
    const filtered = products.filter((item) => {
      const hay = `${item.name || ''} ${item.sku || ''} ${item.brand || ''} ${item.barcode || ''}`.toLowerCase();
      return hay.includes(keyword);
    });
    return dedupeById(filtered);
  }, [products, search]);

  const onDelete = async (product) => {
    if (!confirm(`Delete ${product.name}?`)) return;
    try {
      const res = await inventoryService.deleteProduct(product.id);
      if (!res?.success) throw new Error(res?.error?.message || 'Delete failed');
      toast.success('Product deleted');
      load(page);
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <div>
          <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -1.2 }}>
            Products
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.66)', mt: 0.5 }}>
            Manage SKUs, pricing, and reorder levels.
          </Typography>
        </div>
        <Button variant="contained" onClick={() => { setEditing(null); setFormOpen(true); }} disabled={!canEdit}>
          New Product
        </Button>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Box className="cortex-card" sx={{ p: 1.25, mb: 1.25 }}>
          <TextField
            fullWidth
            size="small"
            label="Search products"
            placeholder="Name, SKU, brand, barcode"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton edge="end" onClick={() => setScannerOpen(true)} size="small">
                    <CameraAltRoundedIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>
        {loading ? (
          <Box className="cortex-card" sx={{ p: 2 }}>
            <Skeleton variant="rounded" height={36} />
            <Skeleton variant="rounded" height={260} sx={{ mt: 2 }} />
          </Box>
        ) : (
          <ProductTable
            products={filteredProducts}
            referenceStatusByProduct={referenceStatusByProduct}
            canEdit={canEdit}
            onEdit={(p) => { setEditing(p); setFormOpen(true); }}
            onDelete={onDelete}
          />
        )}
      </Box>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
        <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
      </Box>

      <ProductForm
        open={formOpen}
        initial={editing}
        onClose={(saved) => {
          setFormOpen(false);
          setEditing(null);
          if (saved) load(page);
        }}
      />

      <Dialog
        open={scannerOpen}
        onClose={() => {
          stopScanner();
          setScannerOpen(false);
        }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ className: 'cortex-dialog-paper' }}
      >
        <DialogTitle>Scan Barcode</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1.2 }}>
            <Box
              sx={{
                width: '100%',
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.12)',
                bgcolor: 'black',
                aspectRatio: '4 / 3'
              }}
            >
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>
              Point camera at a barcode to fill product search.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => {
                  stopScanner();
                  setScannerOpen(false);
                }}
              >
                Close Scanner
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ProductsPage;
