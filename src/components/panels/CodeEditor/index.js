// Main export file for the CodeEditor module

import CodeEditorPanel from './CodeEditorPanel';

// Re-export hooks if needed externally
import useEditorState from './hooks/useEditorState';
import useFileOperations from './hooks/useFileOperations';
import useTransfer from './hooks/useTransfer';

// Re-export components if needed externally
import CodeEditor from './components/CodeEditor';
import EditorHeader from './components/EditorHeader';
import EditorFooter from './components/EditorFooter';
import TransformPanel from './components/TransformPanel';
import TransferProgress from './components/TransferProgress';

// Default export is the main panel component
export default CodeEditorPanel;

// Named exports for individual components and hooks
export {
  // Components
  CodeEditor,
  EditorHeader,
  EditorFooter,
  TransformPanel,
  TransferProgress,
  
  // Hooks
  useEditorState,
  useFileOperations,
  useTransfer
};