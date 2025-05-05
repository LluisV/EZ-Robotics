const path = require('path');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
  // Your existing webpack configuration...
  
  // Specify output with a publicPath for workers
  output: {
    // Your existing output configuration...
    publicPath: '/',
    globalObject: 'self', // Important for web workers
  },
  
  plugins: [
    // Your existing plugins...
    
    // Add Monaco Editor webpack plugin with enhanced configuration
    new MonacoWebpackPlugin({
      // Available languages
      languages: ['javascript', 'typescript', 'html', 'css', 'json'],
      
      // Filename format for better caching
      filename: 'monaco-editor-[name].worker.js',
      
      // Monaco features to include
      features: [
        // Core features for editor functionality
        'clipboard', 'find', 'folding', 'format', 'hover', 
        'links', 'suggest', 'wordHighlighter', 'wordOperations',
        
        // Additional features (you can remove ones you don't need)
        'accessibilityHelp', 'bracketMatching', 'caretOperations',
        'codeAction', 'codelens', 'colorDetector', 'comment', 'contextmenu',
        'coreCommands', 'cursorUndo', 'dnd', 'fontZoom',
        'gotoError', 'gotoLine', 'gotoSymbol', 'inPlaceReplace',
        'inspectTokens', 'linesOperations', 'multicursor', 'parameterHints',
        'quickCommand', 'quickOutline', 'referenceSearch', 'rename', 'smartSelect',
        'snippets', 'toggleHighContrast', 'toggleTabFocusMode',
        'transpose', 'wordPartOperations'
      ],
      
      // Custom language for G-code
      customLanguages: [
        {
          label: 'gcode',
          entry: 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution',
        }
      ]
    })
  ],
  
  resolve: {
    // Your existing resolve configuration...
    alias: {
      // Your existing aliases...
      'monaco-editor': path.resolve(__dirname, 'node_modules/monaco-editor')
    }
  },
  
  // Add specific rules for Monaco workers
  module: {
    // Your existing rules...
    rules: [
      // Add this rule for Monaco workers
      {
        test: /\.worker\.js$/,
        use: { loader: 'worker-loader' }
      },
      // Your other rules...
    ]
  },
  
  // Add these optimizations for better performance
  optimization: {
    // Your existing optimization...
    splitChunks: {
      cacheGroups: {
        monaco: {
          test: /[\\/]node_modules[\\/]monaco-editor[\\/]/,
          name: 'monaco-editor',
          chunks: 'all',
        },
        // Your other cache groups...
      }
    }
  }
};