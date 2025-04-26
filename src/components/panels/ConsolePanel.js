import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import '../../styles/console.css';

// Maximum number of messages to keep in history
const MAX_HISTORY_SIZE = 1000;

/**
 * Memoized console entry component to prevent unnecessary re-renders
 */
const ConsoleEntry = memo(({ index, entry, getLevelStyle }) => {
  const levelClass = getLevelStyle(entry.type === 'response' ? entry.level : entry.type);
  
  // Pre-parse the content instead of using dangerouslySetInnerHTML
  const renderContent = () => {
    if (entry.type === 'command') {
      return (
        <span className="entry-content">
          <span className="console-prompt">&gt;</span> {entry.content}
        </span>
      );
    }
    
    // Only parse robot messages with the expected format
    if (entry.type === 'response' && entry.content.match(/\[\d+:\d+:\d+\.\d+\]\[CORE \d+\]\[[A-Z]+\s*\]/)) {
      const parts = entry.content.match(/(\[\d+:\d+:\d+\.\d+\])(\[CORE \d+\])(\[[A-Z]+\s*\])(\[[^\]]+\])(.*)/);
      
      if (parts) {
        return (
          <span className="entry-content">
            <span className="timestamp">{parts[1]}</span>
            <span className="core">{parts[2]}</span>
            <span className="level">{parts[3]}</span>
            <span className="module">{parts[4]}</span>
            {parts[5]}
          </span>
        );
      }
    }
    
    // Default rendering for other message types
    return <span className="entry-content">{entry.content}</span>;
  };
  
  return (
    <div className={`console-entry ${levelClass}`}>
      <span className="entry-line-number">{index + 1}</span>
      {renderContent()}
    </div>
  );
});

/**
 * Virtualized list component for rendering only visible entries
 */
const VirtualizedConsoleOutput = memo(({ entries, getLevelStyle, containerRef }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(0);
  
  // Approximate row height - could be improved with dynamic measurement
  const ROW_HEIGHT = 24;
  const BUFFER_SIZE = 20; // Extra rows to render above/below visible area
  
  // Update visible range when scrolling
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, clientHeight } = containerRef.current;
    setScrollTop(scrollTop);
    setClientHeight(clientHeight);
  }, [containerRef]);
  
  // Calculate visible range based on scroll position
  useEffect(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE);
    const end = Math.min(
      entries.length, 
      Math.ceil((scrollTop + clientHeight) / ROW_HEIGHT) + BUFFER_SIZE
    );
    
    setVisibleRange({ start, end });
  }, [scrollTop, clientHeight, entries.length]);
  
  // Add scroll event listener
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    
    // Use passive listener for better scroll performance
    element.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation
    
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll, containerRef]);
  
  // Total scroll height of all entries
  const totalHeight = entries.length * ROW_HEIGHT;
  
  // Only render visible entries
  const visibleEntries = entries.slice(visibleRange.start, visibleRange.end);
  
  return (
    <>
      {/* Spacer for entries above visible range */}
      <div style={{ height: visibleRange.start * ROW_HEIGHT }} />
      
      {/* Only render visible entries */}
      {visibleEntries.map((entry, index) => (
        <ConsoleEntry
          key={visibleRange.start + index}
          index={visibleRange.start + index}
          entry={entry}
          getLevelStyle={getLevelStyle}
        />
      ))}
      
      {/* Spacer for entries below visible range */}
      <div style={{ height: Math.max(0, (entries.length - visibleRange.end) * ROW_HEIGHT) }} />
    </>
  );
});

/**
 * Enhanced Console Panel component for sending commands and viewing filtered messages.
 * Features debug level filtering, styled message output, and performance optimizations.
 */
const ConsolePanel = ({ onSendCommand = () => {} }) => {
  const [commandHistory, setCommandHistory] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [debugLevels, setDebugLevels] = useState({
    ERROR: true,    // DEBUG_ERROR (0)
    WARNING: true,  // DEBUG_WARNING (1)
    INFO: true,     // DEBUG_INFO (2)
    DEBUG: true,    // DEBUG_VERBOSE (3)
    COMMAND: true,  // User commands
    RESPONSE: true, // General responses
    SYSTEM: true,   // System messages
    TELEMETRY: false // New telemetry filter, OFF by default
  });
  
  const consoleEndRef = useRef(null);
  const consoleOutputRef = useRef(null);
  const isScrollingRef = useRef(false);
  const lastScrollTime = useRef(0);

  // Sample commands that a user might send to a robot
  const sampleCommands = [
    { command: 'G28', description: 'Home all axes' },
    { command: 'G1 X100 Y100 F1000', description: 'Move to X100 Y100 at feed rate 1000' },
    { command: 'M104 S200', description: 'Set extruder temperature to 200°C' },
    { command: 'M140 S60', description: 'Set bed temperature to 60°C' },
    { command: 'M106 S255', description: 'Set fan speed to maximum' },
  ];

  // Parse message level from robot message format - memoized
  const parseMessageLevel = useCallback((message) => {
    if (message.includes('[TELEMETRY]')) {
      return 'TELEMETRY';
    }
    // Message format: [timestamp][CORE #][LEVEL][Module] Message
    const levelMatch = message.match(/\[\d+:\d+:\d+\.\d+\]\[CORE \d+\]\[([A-Z]+)\s*\]/);
    if (levelMatch) {
      return levelMatch[1].trim();
    }
    return null;
  }, []);

  // Get level-specific styles - memoized
  const getLevelStyle = useCallback((level) => {
    switch(level) {
      case 'ERROR':
        return 'console-error';
      case 'WARN':
        return 'console-warning';
      case 'INFO':
        return 'console-info';
      case 'DEBUG':
        return 'console-debug';
      case 'command':
        return 'console-command';
      case 'response':
        return 'console-response';
      case 'error':
        return 'console-error';
      case 'system':
        return 'console-system';
      case 'TELEMETRY':
        return 'console-telemetry';
      default:
        return '';
    }
  }, []);

  // Add a command or response to the history with size limiting
  const addEntry = useCallback((type, content, level = null) => {
    const timestamp = new Date().toLocaleTimeString();
    let messageLevel = level || type;
    
    // For responses, try to parse the level from the message if not provided
    if (type === 'response' && !level) {
      const parsedLevel = parseMessageLevel(content);
      if (parsedLevel) {
        messageLevel = parsedLevel;
      }
    }
    
    setCommandHistory(prev => {
      const newHistory = [
        ...prev, 
        {
          type,
          level: messageLevel,
          content,
          timestamp
        }
      ];
      
      // Limit history size to prevent memory issues
      if (newHistory.length > MAX_HISTORY_SIZE) {
        return newHistory.slice(-MAX_HISTORY_SIZE);
      }
      
      return newHistory;
    });
  }, [parseMessageLevel]);

  // Send a command - memoized
  const sendCommand = useCallback(() => {
    if (!currentCommand.trim()) return;

    // Special command handling
    if (currentCommand.toLowerCase() === 'clear') {
      setCommandHistory([]);
      setCurrentCommand('');
      return;
    }

    // Add command to history
    addEntry('command', currentCommand);
    
    // Handle help command
    if (currentCommand.toLowerCase() === 'help') {
      const helpResponse = 'Available commands:\n' + sampleCommands.map(cmd => 
        `${cmd.command} - ${cmd.description}`
      ).join('\n');
      addEntry('system', helpResponse);
    } else {
      // Send to serial port if connected
      if (window.sendSerialData) {
        window.sendSerialData(currentCommand)
          .then(success => {
            if (!success) {
              addEntry('error', 'Failed to send command: No serial connection');
            }
          })
          .catch(error => {
            addEntry('error', `Error sending command: ${error.message}`);
          });
      } else {
        addEntry('error', 'Serial connection not available');
      }

      // Also call the original callback
      onSendCommand(currentCommand);
    }
    
    // Clear current command
    setCurrentCommand('');
    setHistoryIndex(-1);
  }, [currentCommand, addEntry, onSendCommand]);

  // Navigate through command history - memoized
  const navigateHistory = useCallback((direction) => {
    const commandsOnly = commandHistory.filter(item => item.type === 'command').map(item => item.content);
    
    if (commandsOnly.length === 0) return;
    
    let newIndex = historyIndex + direction;
    
    if (newIndex < -1) newIndex = -1;
    if (newIndex >= commandsOnly.length) newIndex = commandsOnly.length - 1;
    
    setHistoryIndex(newIndex);
    
    if (newIndex === -1) {
      setCurrentCommand('');
    } else {
      setCurrentCommand(commandsOnly[commandsOnly.length - 1 - newIndex]);
    }
  }, [commandHistory, historyIndex]);

  // Handle key press - memoized
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      sendCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateHistory(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateHistory(1);
    }
  }, [sendCommand, navigateHistory]);

  // Toggle a debug level filter - memoized
  const toggleDebugLevel = useCallback((level) => {
    setDebugLevels(prev => ({
      ...prev,
      [level]: !prev[level]
    }));
  }, []);

  // Check if a message should be visible based on current filters - memoized
  const getMessageFilterKey = useCallback((entry) => {
    // Map entry types/levels to filter keys
    if (entry.type === 'command') {
      return 'COMMAND';
    } else if (entry.type === 'error') {
      return 'ERROR';
    } else if (entry.type === 'system') {
      return 'SYSTEM';
    } else if (entry.level) {
      // Use parsed level for responses
      if (['ERROR', 'WARN', 'INFO', 'DEBUG', 'TELEMETRY'].includes(entry.level)) {
        let filterKey = entry.level;
        // Normalize WARN to WARNING for filter
        if (filterKey === 'WARN') filterKey = 'WARNING';
        return filterKey;
      } else {
        return 'RESPONSE';
      }
    } else {
      return 'RESPONSE';
    }
  }, []);
  
  // Filter visible messages - memoized to prevent recalculation on every render
  const visibleMessages = useMemo(() => {
    return commandHistory.filter(entry => {
      const filterKey = getMessageFilterKey(entry);
      return debugLevels[filterKey];
    });
  }, [commandHistory, debugLevels, getMessageFilterKey]);

  // Throttled scroll handler to improve performance
  const handleScroll = useCallback(() => {
    if (!consoleOutputRef.current || isScrollingRef.current) return;
    
    const now = Date.now();
    if (now - lastScrollTime.current < 100) {
      // Throttle scroll events to max 10 per second
      return;
    }
    
    lastScrollTime.current = now;
    isScrollingRef.current = true;
    
    requestAnimationFrame(() => {
      if (!consoleOutputRef.current) {
        isScrollingRef.current = false;
        return;
      }
      
      const { scrollTop, scrollHeight, clientHeight } = consoleOutputRef.current;
      const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 10;
      
      if (isScrolledToBottom !== autoScroll) {
        setAutoScroll(isScrolledToBottom);
      }
      
      isScrollingRef.current = false;
    });
  }, [autoScroll]);

  // Auto-scroll to the bottom when command history changes
  useEffect(() => {
    if (autoScroll && consoleEndRef.current && !isScrollingRef.current) {
      // Use requestAnimationFrame to make scrolling smoother
      requestAnimationFrame(() => {
        consoleEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    }
  }, [visibleMessages.length, autoScroll]);

  // Listen for serial data events
  useEffect(() => {
    const handleSerialData = (event) => {
      if (event.detail && event.detail.data) {
        // Determine if this is a status/telemetry message
        const isStatusMessage = event.detail.isStatusMessage || 
                               (event.detail.data.startsWith('<') && event.detail.data.includes('|MPos:'));
        
        // Only show status messages if TELEMETRY filter is enabled
        if (isStatusMessage && !debugLevels.TELEMETRY) {
          return; // Skip showing telemetry messages when filter is off
        }
        
        // Determine the message type/level for styling
        let messageType = 'response';
        let messageLevel = 'INFO';
        
        const data = event.detail.data.trim();
      
        // Skip simple "ok" messages
        if (data === "ok") {
          return;
        }
        
        // Parse message type based on content
        if (isStatusMessage) {
          messageType = 'response';
          messageLevel = 'TELEMETRY';
        } else if (data.includes('[ERROR]') || data.includes('error')) {
          messageLevel = 'ERROR';
        } else if (data.includes('[WARN]') || data.includes('warning')) {
          messageLevel = 'WARN';
        } else if (data.includes('[INFO]')) {
          messageLevel = 'INFO';
        } else if (data.includes('[DEBUG]')) {
          messageLevel = 'DEBUG';
        }
        
        // Add the received data to the console
        addEntry(messageType, data, messageLevel);
      }
    };
    
    // Listen for serial connection status changes
    const handleSerialConnection = (event) => {
      if (event.detail) {
        const { connected, port } = event.detail;
        addEntry('system', connected 
          ? `Connected to ${port?.usbProductName || 'serial port'}`
          : 'Disconnected from serial port');
      }
    };
    
    // Listen for console entries from other components
    const handleConsoleEntry = (event) => {
      if (event.detail) {
        const { type, content, level } = event.detail;
        addEntry(type, content, level);
      }
    };
    
    // Add event listeners
    document.addEventListener('serialdata', handleSerialData);
    document.addEventListener('serialconnection', handleSerialConnection);
    document.addEventListener('consoleEntry', handleConsoleEntry);
    
    // Clean up
    return () => {
      document.removeEventListener('serialdata', handleSerialData);
      document.removeEventListener('serialconnection', handleSerialConnection);
      document.removeEventListener('consoleEntry', handleConsoleEntry);
    };
  }, [addEntry]);
  

  return (
    <div className="console-container">
      {/* Debug level filters */}
      <div className="console-toolbar">
        {/* Compact filter section - just buttons */}
        <div className="toolbar-section">
          <div className="console-filters">
            <div 
              className={`filter-option ${debugLevels.ERROR ? 'active' : ''}`}
              onClick={() => toggleDebugLevel('ERROR')}
              title="Show ERROR messages (level 0)"
            >
              <span className="filter-indicator error"></span>
              <span className="filter-label">ERROR</span>
            </div>
            
            <div 
              className={`filter-option ${debugLevels.WARNING ? 'active' : ''}`}
              onClick={() => toggleDebugLevel('WARNING')}
              title="Show WARNING messages (level 1)"
            >
              <span className="filter-indicator warning"></span>
              <span className="filter-label">WARN</span>
            </div>
            
            <div 
              className={`filter-option ${debugLevels.INFO ? 'active' : ''}`}
              onClick={() => toggleDebugLevel('INFO')}
              title="Show INFO messages (level 2)"
            >
              <span className="filter-indicator info"></span>
              <span className="filter-label">INFO</span>
            </div>
            
            <div 
              className={`filter-option ${debugLevels.DEBUG ? 'active' : ''}`}
              onClick={() => toggleDebugLevel('DEBUG')}
              title="Show DEBUG messages (level 3)"
            >
              <span className="filter-indicator debug"></span>
              <span className="filter-label">DEBUG</span>
            </div>
          </div>
        </div>
        
        <div className="toolbar-divider"></div>
        
        <div className="toolbar-section">
          <div className="console-filters">
            <div 
              className={`filter-option ${debugLevels.COMMAND ? 'active' : ''}`}
              onClick={() => toggleDebugLevel('COMMAND')}
              title="Show user commands"
            >
              <span className="filter-indicator command"></span>
              <span className="filter-label">CMD</span>
            </div>
            
            <div 
              className={`filter-option ${debugLevels.RESPONSE ? 'active' : ''}`}
              onClick={() => toggleDebugLevel('RESPONSE')}
              title="Show general responses"
            >
              <span className="filter-indicator response"></span>
              <span className="filter-label">RESP</span>
            </div>
            
            <div 
              className={`filter-option ${debugLevels.SYSTEM ? 'active' : ''}`}
              onClick={() => toggleDebugLevel('SYSTEM')}
              title="Show system messages"
            >
              <span className="filter-indicator system"></span>
              <span className="filter-label">SYS</span>
            </div>

            <div 
              className={`filter-option ${debugLevels.TELEMETRY ? 'active' : ''}`}
              onClick={() => toggleDebugLevel('TELEMETRY')}
              title="Show TELEMETRY messages"
            >
              <span className="filter-indicator telemetry"></span>
              <span className="filter-label">TELEM</span>
            </div>
          </div>
        </div>
        
        <div className="toolbar-spacer"></div>
        
        <div className="console-actions">
          <button 
            className="toolbar-button"
            onClick={() => {
              setAutoScroll(true);
              consoleEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }}
            title="Scroll to bottom"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M12 3v18"></path>
              <path d="M6 15l6 6 6-6"></path>
            </svg>
          </button>
          
          <button 
            className="toolbar-button"
            onClick={() => setCommandHistory([])}
            title="Clear console"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Console output area */}
      <div 
        className="console-output" 
        ref={consoleOutputRef}
        onScroll={handleScroll}
      >
        {commandHistory.length === 0 && (
          <div className="console-welcome">
            <p>Welcome to the Robot Command Console.</p>
            <p>Type 'help' for a list of sample commands.</p>
            <p>Type 'clear' to clear the console.</p>
          </div>
        )}
        
        {commandHistory.length > 0 && (
          <VirtualizedConsoleOutput 
            entries={visibleMessages}
            getLevelStyle={getLevelStyle}
            containerRef={consoleOutputRef}
          />
        )}
        
        <div ref={consoleEndRef} />
      </div>
      
      {/* Input area */}
      <div className="console-input-container">
        <div className="console-input-wrapper">
          <span className="console-prompt">&gt;</span>
          <input
            type="text"
            className="console-input"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Enter command... (Press Enter to send)"
            autoFocus
          />
        </div>
        <div className="console-status-bar">
          <div className="status-item">
            <span className="status-label">Status:</span>
            <span className={`status-value ${window.sendSerialData ? "connected" : "disconnected"}`}>
              {window.sendSerialData ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Messages:</span>
            <span className="status-value">
              {visibleMessages.length}/{commandHistory.length}
            </span>
          </div>
          <div className="status-indicator-wrapper">
            <button 
              className="toolbar-button send-button"
              onClick={sendCommand}
              title="Send command (Enter)"
              disabled={!window.sendSerialData && currentCommand !== 'help' && currentCommand !== 'clear'}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsolePanel;