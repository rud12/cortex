import React, { useMemo, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { motion } from 'framer-motion';
import { Box, Button, Typography } from '@mui/material';

const TYPE = 'CHART_CARD';

const SIZE_MAP = {
  small: { w: 320, h: 240 },
  medium: { w: 440, h: 320 },
  large: { w: 660, h: 420 }
};

const sizeBtnSx = (active) => ({
  minWidth: 36,
  px: 0,
  py: 0.25,
  fontWeight: 900,
  opacity: active ? 1 : 0.6
});

const DraggableChartCard = ({ id, index, title, size = 'medium', onSizeChange, moveCard, children }) => {
  const ref = useRef(null);
  const dims = SIZE_MAP[size] || SIZE_MAP.medium;

  const [{ isDragging }, drag] = useDrag({
    type: TYPE,
    item: { id, index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() })
  });

  const [, drop] = useDrop({
    accept: TYPE,
    hover: (item) => {
      if (!ref.current) return;
      if (item.index === index) return;
      moveCard?.(item.index, index);
      item.index = index;
    }
  });

  drag(drop(ref));

  const wrapperStyle = useMemo(
    () => ({
      width: '100%',
      maxWidth: dims.w,
      height: dims.h,
      minWidth: 0,
      overflow: 'hidden',
      opacity: isDragging ? 0.65 : 1
    }),
    [dims.h, dims.w, isDragging]
  );

  return (
    <motion.div
      ref={ref}
      layout
      style={wrapperStyle}
      className="cortex-card"
    >
      <Box sx={{ p: size === 'small' ? 1.25 : 2, height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr', gap: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 900 }} noWrap>
            {title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" variant={size === 'small' ? 'contained' : 'outlined'} sx={sizeBtnSx(size === 'small')} onClick={() => onSizeChange?.('small')}>S</Button>
            <Button size="small" variant={size === 'medium' ? 'contained' : 'outlined'} sx={sizeBtnSx(size === 'medium')} onClick={() => onSizeChange?.('medium')}>M</Button>
            <Button size="small" variant={size === 'large' ? 'contained' : 'outlined'} sx={sizeBtnSx(size === 'large')} onClick={() => onSizeChange?.('large')}>L</Button>
          </Box>
        </Box>

        <Box sx={{ minHeight: 0, minWidth: 0, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
    </motion.div>
  );
};

export default DraggableChartCard;
