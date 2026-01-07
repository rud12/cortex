import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

import { useAuth } from '../../contexts/AuthContext';
import { chatService } from '../../services/api/chatService';

const STORAGE_KEY = 'cortex_admin_chat_history_v1';

const loadHistory = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveHistory = (messages) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  } catch {
  }
};

const AdminChatbotWidget = () => {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes('Administrator');

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => loadHistory());
  const [loading, setLoading] = useState(false);
  const [failedMessage, setFailedMessage] = useState('');
  const viewportRef = useRef(null);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [messages, loading, open]);

  const pushMessage = (role, text, meta) => {
    const payload = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role,
      text,
      meta: meta || null
    };
    setMessages((prev) => [...prev, payload].slice(-30));
  };

  const sendMessage = async (value) => {
    const messageText = String(value || '').trim();
    if (!messageText || loading) return;

    setInput('');
    setFailedMessage('');
    pushMessage('user', messageText);
    setLoading(true);

    try {
      const sessionId = user?.id ? `user-${user.id}` : 'user-';
      const result = await chatService.query({
        sessionId,
        question: messageText
      });
      const data = result?.data || {};
      const reply = data.reply || 'No response generated.';
      pushMessage('assistant', reply, {
        mode: data.mode,
        confidence: data.confidence_score,
        traceId: data.trace_id
      });
    } catch (err) {
      const text = err?.response?.data?.error?.message || 'Failed to get AI response. Please retry.';
      pushMessage('assistant', text, { mode: 'error' });
      setFailedMessage(messageText);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: (theme) => theme.zIndex.modal + 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 1
      }}
    >
      {open && (
        <Paper
          elevation={14}
          className="backdrop-blur-sm"
          sx={{
            width: { xs: 'calc(100vw - 20px)', sm: 380 },
            height: { xs: '72vh', sm: 520 },
            maxHeight: 560,
            borderRadius: 3,
            overflow: 'hidden',
            display: 'grid',
            gridTemplateRows: 'auto 1fr auto',
            bgcolor: 'background.paper'
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 1.5, py: 1.2, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Admin AI Assistant</Typography>
              <Typography variant="caption" color="text.secondary">Business analytics chat</Typography>
            </Box>
            <IconButton size="small" onClick={() => setOpen(false)}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box
            ref={viewportRef}
            sx={{
              overflowY: 'auto',
              px: 1.25,
              py: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}
          >
            {messages.length === 0 && (
              <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Ask things like: Why did sales increase this week?
                </Typography>
              </Paper>
            )}

            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  maxWidth: '90%',
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  bgcolor: message.role === 'user' ? 'primary.main' : 'background.default',
                  color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  borderRadius: 2,
                  px: 1.2,
                  py: 0.9,
                  border: (theme) =>
                    message.role === 'user' ? 'none' : `1px solid ${theme.palette.divider}`
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.text}
                </Typography>
                {message.meta?.mode && message.meta.mode !== 'error' && (
                  <Typography variant="caption" color="text.secondary">
                    {message.meta.mode}
                    {Number.isFinite(message.meta.confidence) ? ` · confidence ${Math.round(message.meta.confidence)}%` : ''}
                  </Typography>
                )}
              </Box>
            ))}

            {loading && (
              <Box sx={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5 }}>
                <CircularProgress size={14} />
                <Typography variant="body2" color="text.secondary">Thinking...</Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ borderTop: (theme) => `1px solid ${theme.palette.divider}`, p: 1 }}>
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                value={input}
                size="small"
                fullWidth
                multiline
                maxRows={3}
                placeholder="Ask about business trends..."
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage(input);
                  }
                }}
              />
              <IconButton color="primary" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
                <SendRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>

            {failedMessage && !loading && (
              <Button
                startIcon={<RefreshRoundedIcon />}
                size="small"
                sx={{ mt: 0.8 }}
                onClick={() => sendMessage(failedMessage)}
              >
                Retry last message
              </Button>
            )}
          </Box>
        </Paper>
      )}

      <IconButton
        color="primary"
        onClick={() => setOpen((prev) => !prev)}
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          boxShadow: 5,
          '&:hover': { bgcolor: 'primary.dark' }
        }}
      >
        <ChatRoundedIcon />
      </IconButton>
    </Box>
  );
};

export default AdminChatbotWidget;
