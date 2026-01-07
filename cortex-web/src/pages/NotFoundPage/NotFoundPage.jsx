import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';

const NotFoundPage = () => {
  return (
    <Box sx={{ p: 4 }}>
      <Box className="cortex-card p-6">
        <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -1.1 }}>
          404
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 1 }}>
          The page you&apos;re looking for doesn&apos;t exist.
        </Typography>
        <Button component={Link} to="/dashboard" variant="contained" sx={{ mt: 3 }}>
          Go to Dashboard
        </Button>
      </Box>
    </Box>
  );
};

export default NotFoundPage;
