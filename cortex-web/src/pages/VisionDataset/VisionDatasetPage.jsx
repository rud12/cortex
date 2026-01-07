import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography
} from '@mui/material';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { toast } from 'react-toastify';

import { inventoryService } from '../../services/api/inventoryService';
import { visionService } from '../../services/api/visionService';

const menuProps = {
  PaperProps: {
    sx: {
      backgroundColor: '#101626',
      backdropFilter: 'none',
      border: '1px solid rgba(255,255,255,0.2)'
    }
  }
};

const VisionDatasetPage = () => {
  const [loading, setLoading] = useState(true);
  const [selectedLoading, setSelectedLoading] = useState(false);

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const [referenceImages, setReferenceImages] = useState([]);
  const [referenceFiles, setReferenceFiles] = useState([]);
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await inventoryService.listProducts(1, 500);
      if (!res?.success) throw new Error(res?.error?.message || 'Failed to load products');
      const list = res.data || [];
      setProducts(list);
      if (!selectedProductId && list.length > 0) {
        setSelectedProductId(list[0].id);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedProductData = async (productId) => {
    if (!productId) {
      setReferenceImages([]);
      setSelectedLoading(false);
      return;
    }

    setSelectedLoading(true);
    try {
      const refs = await visionService.listProductReferenceImages(productId, 500, null);
      setReferenceImages(refs?.success ? refs.data?.items || [] : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load dataset data');
    } finally {
      setSelectedLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!selectedProductId) {
      setReferenceImages([]);
      return;
    }
    loadSelectedProductData(selectedProductId);
  }, [selectedProductId]);

  const uploadReferenceImages = async () => {
    if (!selectedProductId) {
      toast.error('Select product first');
      return;
    }
    if (referenceFiles.length === 0) {
      toast.error('Choose images first');
      return;
    }

    setReferenceUploading(true);
    try {
      const res = await visionService.uploadProductReferenceImages(
        selectedProductId,
        referenceFiles
      );
      if (!res?.success) throw new Error(res?.error?.message || 'Upload failed');
      setReferenceFiles([]);
      await loadSelectedProductData(selectedProductId);
      toast.success('Reference images uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setReferenceUploading(false);
    }
  };

  const deleteReferenceImage = async (imageId, variantId = null) => {
    if (!selectedProductId || !imageId) return;
    setDeletingId(imageId);
    try {
      const res = await visionService.deleteProductReferenceImage(selectedProductId, imageId, variantId || null);
      if (!res?.success) throw new Error(res?.error?.message || 'Delete failed');
      setReferenceImages((prev) => prev.filter((item) => item.id !== imageId));
      toast.success('Reference image deleted');
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <Box sx={{ p: 2, display: 'grid', gap: 2 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -1.2 }}>
          Vision Dataset
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.66)', mt: 0.5 }}>
          Upload only reference images for products.
        </Typography>
      </Box>

      <Paper className="cortex-card" sx={{ p: 2, display: 'grid', gap: 1.2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography>Loading products...</Typography>
          </Box>
        ) : (
          <>
            <TextField
              select
              label="Select Product"
              fullWidth
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              SelectProps={{ MenuProps: menuProps }}
            >
              {products.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </MenuItem>
              ))}
            </TextField>
          </>
        )}
      </Paper>

      {selectedProduct ? (
        <Paper className="cortex-card" sx={{ p: 2, display: 'grid', gap: 1.4 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Reference Images</Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr auto' }, gap: 1 }}>
            <Button variant="outlined" component="label">
              Choose Images
              <input
                type="file"
                hidden
                multiple
                accept="image/*"
                onChange={(e) => setReferenceFiles(Array.from(e.target.files || []))}
              />
            </Button>
            <Button variant="contained" onClick={uploadReferenceImages} disabled={referenceUploading}>
              {referenceUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </Box>

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.68)' }}>
            {referenceFiles.length} file(s) selected
          </Typography>

          {selectedLoading ? (
            <Typography variant="caption">Loading images...</Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(3, minmax(0, 1fr))',
                  md: 'repeat(4, minmax(0, 1fr))'
                },
                gap: 1,
                maxHeight: 520,
                overflowY: 'auto',
                pr: 0.5
              }}
            >
              {referenceImages.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 1.5,
                    p: 1,
                    position: 'relative'
                  }}
                >
                  <IconButton
                    size="small"
                    aria-label="Delete reference image"
                    onClick={() => deleteReferenceImage(item.id, item.variant_id || null)}
                    disabled={deletingId === item.id}
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      zIndex: 1,
                      border: '1px solid rgba(255,255,255,0.12)',
                      backgroundColor: 'rgba(10,12,18,0.75)',
                      color: '#ff7b7b',
                      '&:hover': { backgroundColor: 'rgba(10,12,18,0.95)' }
                    }}
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                  <img
                    src={visionService.datasetAssetUrl(item.file_path)}
                    alt="Reference"
                    style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)' }}
                  />
                </Box>
              ))}
              {referenceImages.length === 0 && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.68)' }}>
                  No images uploaded yet.
                </Typography>
              )}
            </Box>
          )}
        </Paper>
      ) : null}
    </Box>
  );
};

export default VisionDatasetPage;
