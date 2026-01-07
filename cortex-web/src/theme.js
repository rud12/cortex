import { createTheme } from '@mui/material/styles';

export const buildCortexTheme = (mode = 'dark') => {
  const dark = mode !== 'light';


  const surface = dark ? '#131720' : '#FFFFFF';
  const surfaceElevated = dark ? '#1C2233' : '#EEF1F6';
  const borderStrong = dark ? '#252D3D' : '#C8D0DC';
  const borderSoft = dark ? 'rgba(120,135,160,0.13)' : '#DDE3EC';
  const surfaceBorder = `1px solid ${borderStrong}`;
  const surfaceShadow = dark
    ? '0 16px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)'
    : '0 8px 28px rgba(14,23,38,0.10), 0 2px 6px rgba(14,23,38,0.06)';

  const accent = dark ? '#C9A96E' : '#2C4A7C';
  const accentHover = dark ? '#B8936A' : '#1F3560';
  const secondary = dark ? '#4A9E8E' : '#3A7D6E';

  return createTheme({
    palette: {
      mode: dark ? 'dark' : 'light',
      primary: {
        main: accent,
        contrastText: dark ? '#0D0F14' : '#FFFFFF'
      },
      secondary: {
        main: secondary
      },
      success: {
        main: dark ? '#4A9E8E' : '#3A7D6E'
      },
      warning: {
        main: dark ? '#C8903A' : '#B5692A'
      },
      error: {
        main: dark ? '#C05050' : '#A83838'
      },
      background: {
        default: dark ? '#0D0F14' : '#F5F7FA',
        paper: surface
      },
      text: dark
        ? {
            primary:   '#E8EAF0',
            secondary: '#8A95A8'
          }
        : {
            primary:   '#0E1726',
            secondary: '#4A5568'
          }
    },
    typography: {
      fontFamily: '"Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      h1: { fontSize: '32px', fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.5px' },
      h2: { fontSize: '24px', fontWeight: 650, lineHeight: 1.4,  letterSpacing: '-0.3px' },
      h3: { fontSize: '20px', fontWeight: 600, lineHeight: 1.45, letterSpacing: '-0.2px' },
      body1: { fontSize: '16px', lineHeight: 1.6 },
      body2: { fontSize: '14px', lineHeight: 1.55 },
      caption: { fontSize: '12px', lineHeight: 1.45 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' }
    },
    shape: {
      borderRadius: 10
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none'
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          root: {
            '& .MuiBackdrop-root': {
              backgroundColor: dark ? 'rgba(5, 8, 18, 0.72)' : 'rgba(14, 23, 38, 0.22)'
            }
          },
          paper: {
            background: surfaceElevated,
            border: surfaceBorder,
            boxShadow: surfaceShadow,
            maxHeight: 'min(92vh, 900px)'
          }
        }
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }
        }
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            maxHeight: '70vh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            backgroundColor: surface,
            border: surfaceBorder,
            boxShadow: surfaceShadow
          },
          list: {
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }
        }
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            maxHeight: '75vh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            backgroundColor: surface,
            border: surfaceBorder,
            boxShadow: surfaceShadow
          }
        }
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            backgroundColor: surface,
            border: surfaceBorder,
            boxShadow: surfaceShadow
          },
          listbox: {
            backgroundColor: surface
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            background: dark ? '#0D1019' : '#FFFFFF',
            '& fieldset': {
              borderColor: borderStrong
            },
            '&:hover fieldset': {
              borderColor: dark ? '#3A4560' : '#A0ABBE'
            },
            '&.Mui-focused fieldset': {
              borderColor: accent
            }
          }
        }
      },
      MuiInputLabel: {
        styleOverrides: {
          root: dark
            ? { color: '#8A95A8' }
            : { color: '#4A5568' }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: borderStrong
          }
        }
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: borderSoft
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderColor: borderStrong,
            fontWeight: 500
          }
        }
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: dark
            ? {}
            : { color: '#0E1726' }
        }
      },
      MuiSelect: {
        styleOverrides: {
          icon: dark
            ? { color: '#8A95A8' }
            : { color: '#4A5568' }
        }
      },
      MuiMenuItem: {
        styleOverrides: {
          root: dark
            ? {
                '&.Mui-selected': {
                  backgroundColor: 'rgba(201,169,110,0.14)'
                },
                '&.Mui-selected:hover': {
                  backgroundColor: 'rgba(201,169,110,0.22)'
                }
              }
            : {
                '&.Mui-selected': {
                  backgroundColor: 'rgba(44,74,124,0.10)'
                },
                '&.Mui-selected:hover': {
                  backgroundColor: 'rgba(44,74,124,0.17)'
                }
              }
        }
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: dark ? '#1C2233' : '#0E1726',
            color: dark ? '#E8EAF0' : '#FFFFFF',
            fontSize: '12px',
            borderRadius: 6
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: 'all 0.18s ease'
          },
          containedPrimary: {
            backgroundColor: accent,
            color: dark ? '#0D0F14' : '#FFFFFF',
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: accentHover,
              boxShadow: dark
                ? '0 4px 16px rgba(201,169,110,0.28)'
                : '0 4px 14px rgba(44,74,124,0.26)'
            }
          },
          outlinedPrimary: {
            borderColor: accent,
            color: accent,
            '&:hover': {
              borderColor: accentHover,
              backgroundColor: dark
                ? 'rgba(201,169,110,0.07)'
                : 'rgba(44,74,124,0.06)'
            }
          },
          textPrimary: {
            color: accent,
            '&:hover': {
              backgroundColor: dark
                ? 'rgba(201,169,110,0.07)'
                : 'rgba(44,74,124,0.06)'
            }
          }
        }
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: dark ? '#1C2233' : '#EEF1F6'
            },
            transition: 'background-color 0.15s ease'
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'all 0.18s ease',
            '&:hover': {
              backgroundColor: dark
                ? 'rgba(201,169,110,0.10)'
                : 'rgba(44,74,124,0.08)'
            }
          }
        }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: 'all 0.15s ease',
            '&.Mui-selected': {
              backgroundColor: dark
                ? 'rgba(201,169,110,0.12)'
                : 'rgba(44,74,124,0.10)',
              '&:hover': {
                backgroundColor: dark
                  ? 'rgba(201,169,110,0.18)'
                  : 'rgba(44,74,124,0.15)'
              }
            }
          }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            letterSpacing: '0.01em',
            transition: 'color 0.15s ease',
            '&.Mui-selected': {
              fontWeight: 600
            }
          }
        }
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 2,
            borderRadius: 2
          }
        }
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundColor: dark ? '#252D3D' : '#DDE3EC'
          }
        }
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            '&.Mui-checked': {
              color: accent
            },
            '&.Mui-checked + .MuiSwitch-track': {
              backgroundColor: accent
            }
          }
        }
      }
    }
  });
};
