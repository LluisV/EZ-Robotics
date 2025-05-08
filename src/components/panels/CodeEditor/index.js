// Main export file for the CodeEditor module

import CodeEditorPanel from './CodeEditorPanel';

// Re-export hooks if needed externally
import useTransfer from './hooks/useTransfer';

// Re-export components if needed externally
import EditorHeader from './components/EditorHeader';
import EditorFooter from './components/EditorFooter';
import TransformPanel from './components/TransformPanel';

// Default export is the main panel component
export default CodeEditorPanel;

// Named exports for individual components and hooks
export {
  // Components
  EditorHeader,
  EditorFooter,
  TransformPanel,
  
  // Hooks
  useTransfer
};