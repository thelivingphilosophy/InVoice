/**
 * Tradesman App Color Palette
 * Based on brand colors: #1e4360 (primary) and #f89448 (accent)
 */

// Brand Colors
const primaryColor = '#1e4360';      // Dark blue-gray (main background, headers)
const accentColor = '#f89448';       // Warm orange (main actions, highlights)

// Semantic Colors
const successColor = '#22c55e';      // Green (completed, success states)
const warningColor = '#fbbf24';      // Amber (warnings, pending transcription)
const errorColor = '#ef4444';        // Red (errors, destructive actions)
const infoColor = '#3b82f6';         // Blue (info, pending states)

// Button progression colors (from accent down to complementary)
const buttonPrimary = accentColor;   // #f89448 - Main action (Start Workflow)
const buttonSecondary = '#e67e22';   // Darker orange - Export Jobs
const buttonTertiary = '#d35400';    // Even darker orange - Voice Recorder  
const buttonQuaternary = '#a0522d';  // Brown-orange - Manual Entry

// Neutral Colors
const lightBackground = '#f8fafc';   // Very light gray
const darkBackground = primaryColor; // Use primary color as dark background
const lightText = '#1e293b';         // Dark gray for light mode
const darkText = '#f1f5f9';          // Light gray for dark mode

export const Colors = {
  light: {
    text: lightText,
    background: lightBackground,
    surface: '#ffffff',
    tint: accentColor,
    primary: primaryColor,
    accent: accentColor,
    success: successColor,
    warning: warningColor,
    error: errorColor,
    info: infoColor,
    icon: '#64748b',
    tabIconDefault: '#64748b',
    tabIconSelected: accentColor,
    border: '#e2e8f0',
    muted: '#94a3b8',
    buttonPrimary: buttonPrimary,
    buttonSecondary: buttonSecondary,
    buttonTertiary: buttonTertiary,
    buttonQuaternary: buttonQuaternary,
  },
  dark: {
    text: darkText,
    background: darkBackground,
    surface: primaryColor,
    tint: accentColor,
    primary: primaryColor,
    accent: accentColor,
    success: successColor,
    warning: warningColor,
    error: errorColor,
    info: infoColor,
    icon: '#94a3b8',
    tabIconDefault: '#94a3b8',
    tabIconSelected: accentColor,
    border: '#334155',
    muted: '#64748b',
    buttonPrimary: buttonPrimary,
    buttonSecondary: buttonSecondary,
    buttonTertiary: buttonTertiary,
    buttonQuaternary: buttonQuaternary,
  },
};
