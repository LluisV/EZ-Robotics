// src/utils/MonacoThemeAdapter.js

/**
 * Monaco Theme Adapter
 * Creates and manages Monaco editor themes that match the application themes
 */

// Define theme mappings between application themes and Monaco editor themes
const themeMap = {
    'dark': 'monaco-dark',
    'light': 'monaco-light',
    'visual-studio': 'monaco-vs',
    'abyss': 'monaco-abyss',
    'dracula': 'monaco-dracula',
    'replit': 'monaco-replit',
    'light-spaced': 'monaco-light',
    'abyss-spaced': 'monaco-abyss'
  };
  
  /**
   * Create and register Monaco themes that correspond to application themes
   * @param {Object} monaco - Monaco editor instance
   */
  export function setupMonacoThemes(monaco) {
    if (!monaco || !monaco.editor) return;
  
    // Dark theme (default)
    monaco.editor.defineTheme('monaco-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: 'E06C75', fontStyle: 'bold' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editorCursor.foreground': '#9cdcfe',
        'editor.lineHighlightBackground': '#2a2d2e',
        'editorLineNumber.foreground': '#5a5a5a',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41'
      }
    });
  
    // Light theme
    monaco.editor.defineTheme('monaco-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000', fontStyle: 'italic' },
        { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
        { token: 'variable', foreground: '267F99' },
        { token: 'number', foreground: '098658' },
        { token: 'type', foreground: 'AF00DB', fontStyle: 'bold' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#333333',
        'editorCursor.foreground': '#000000',
        'editor.lineHighlightBackground': '#f5f5f5',
        'editorLineNumber.foreground': '#999999',
        'editor.selectionBackground': '#add6ff',
        'editor.inactiveSelectionBackground': '#e5ebf1'
      }
    });
  
    // Visual Studio theme
    monaco.editor.defineTheme('monaco-vs', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000', fontStyle: 'italic' },
        { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
        { token: 'variable', foreground: '1f377f' },
        { token: 'number', foreground: '098658' },
        { token: 'type', foreground: '0000FF', fontStyle: 'bold' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#000000',
        'editorCursor.foreground': '#000000',
        'editor.lineHighlightBackground': '#eaeaea',
        'editorLineNumber.foreground': '#2b91af',
        'editor.selectionBackground': '#add6ff',
        'editor.inactiveSelectionBackground': '#e5ebf1'
      }
    });
  
    // Abyss theme
    monaco.editor.defineTheme('monaco-abyss', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '384887', fontStyle: 'italic' },
        { token: 'keyword', foreground: '9872a2', fontStyle: 'bold' },
        { token: 'variable', foreground: '6688cc' },
        { token: 'number', foreground: '00a0a0' },
        { token: 'type', foreground: 'ffa0a0', fontStyle: 'bold' },
      ],
      colors: {
        'editor.background': '#000c18',
        'editor.foreground': '#6688cc',
        'editorCursor.foreground': '#ddbb88',
        'editor.lineHighlightBackground': '#082050',
        'editorLineNumber.foreground': '#4d5980',
        'editor.selectionBackground': '#770811',
        'editor.inactiveSelectionBackground': '#442e3b'
      }
    });
  
    // Dracula theme
    monaco.editor.defineTheme('monaco-dracula', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
        { token: 'variable', foreground: '8be9fd' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'type', foreground: 'f1fa8c', fontStyle: 'bold' },
      ],
      colors: {
        'editor.background': '#282a36',
        'editor.foreground': '#f8f8f2',
        'editorCursor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#44475a',
        'editorLineNumber.foreground': '#6272a4',
        'editor.selectionBackground': '#44475a',
        'editor.inactiveSelectionBackground': '#3b3c4b'
      }
    });
  
    // Replit theme
    monaco.editor.defineTheme('monaco-replit', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '999999', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ce9178', fontStyle: 'bold' },
        { token: 'variable', foreground: '59a8e2' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'type', foreground: 'ff8c40', fontStyle: 'bold' },
      ],
      colors: {
        'editor.background': '#0e1525',
        'editor.foreground': '#e0e0e0',
        'editorCursor.foreground': '#ffffff',
        'editor.lineHighlightBackground': '#1c2333',
        'editorLineNumber.foreground': '#858585',
        'editor.selectionBackground': '#3a5083',
        'editor.inactiveSelectionBackground': '#35405e'
      }
    });
  }
  
  /**
   * Get the Monaco theme corresponding to the application theme
   * @param {string} appTheme - Application theme ID
   * @returns {string} Monaco theme ID
   */
  export function getMonacoTheme(appTheme) {
    return themeMap[appTheme] || 'monaco-dark';
  }
  
  /**
   * Apply a theme to Monaco editor
   * @param {Object} monaco - Monaco editor instance
   * @param {string} appTheme - Application theme ID
   */
  export function applyMonacoTheme(monaco, appTheme) {
    if (!monaco || !monaco.editor) return;
    
    const monacoTheme = getMonacoTheme(appTheme);
    monaco.editor.setTheme(monacoTheme);
  }
  
  export default {
    setupMonacoThemes,
    getMonacoTheme,
    applyMonacoTheme
  };