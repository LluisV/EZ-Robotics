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
    if (entry.type === 'sent') {
      return (
        <span className="entry-content">
          <span className="console-prompt">&gt;</span> {entry.content}
        </span>
      );
    }
    
    // Parse FluidNC error codes
    if (entry.type === 'response' && entry.level === 'ERROR') {
      const errorMatch = entry.content.match(/\[ERROR:(\d+)\](.*)/);
      if (errorMatch) {
        const errorCode = errorMatch[1];
        const errorMsg = errorMatch[2].trim();
        const fullErrorDescription = getErrorDescription(errorCode, errorMsg);
        
        return (
          <span className="entry-content">
            <span className="error-code">[ERROR:{errorCode}]</span> {fullErrorDescription}
          </span>
        );
      }
    }
    
    // Parse FluidNC alarm codes
    if (entry.type === 'response' && entry.content.match(/\[ALARM:(\d+)\]/)) {
      const alarmMatch = entry.content.match(/\[ALARM:(\d+)\](.*)/);
      if (alarmMatch) {
        const alarmCode = alarmMatch[1];
        const alarmMsg = alarmMatch[2] ? alarmMatch[2].trim() : '';
        const fullAlarmDescription = getAlarmDescription(alarmCode, alarmMsg);
        
        return (
          <span className="entry-content">
            <span className="alarm-code">[ALARM:{alarmCode}]</span> {fullAlarmDescription}
          </span>
        );
      }
    }
    
    // Parse startup messages
    if (entry.content.match(/\[MSG:Firmware: FluidNC/)) {
      return (
        <span className="entry-content startup-message">
          {entry.content}
        </span>
      );
    }
    
    // Parse status messages with position data - SIMPLIFIED
    if (entry.content.startsWith('<') && entry.content.includes('|MPos:')) {
      try {
        const statusMatch = entry.content.match(/<([^|]+)\|/);
        const mPosMatch = entry.content.match(/MPos:([^,|]+),([^,|]+),([^,|]+)/);
        
        if (statusMatch && mPosMatch) {
          const status = statusMatch[1];
          const x = parseFloat(mPosMatch[1]).toFixed(3);
          const y = parseFloat(mPosMatch[2]).toFixed(3);
          const z = parseFloat(mPosMatch[3]).toFixed(3);
          
          return (
            <span className="entry-content status-message">
              <span className={`status-indicator-console ${status.toLowerCase()}`}>{status}</span>
              <span className="position-label">X:</span><span className="position-value">{x}</span>
              <span className="position-label">Y:</span><span className="position-value">{y}</span>
              <span className="position-label">Z:</span><span className="position-value">{z}</span>
            </span>
          );
        }
      } catch (e) {
        // If parsing fails, fall back to default rendering
      }
    }
    
    // Parse robot messages with the expected format
    if (entry.type === 'response' && entry.content.match(/\[\d+:\d+:\d+\.\d+\]\[CORE \d+\]\[[A-Z]+\s*\]/)) {
      const parts = entry.content.match(/(\[\d+:\d+:\d+\.\d+\])(\[CORE \d+\])(\[[A-Z]+\s*\])(\[[^\]]+\])(.*)/);
      
      if (parts) {
        return (
          <span className="entry-content">
            <span className="timestamp">{parts[1]}</span>
            <span className="core">{parts[2]}</span>
            <span className={`level level-${entry.level ? entry.level.toLowerCase() : 'info'}`}>{parts[3]}</span>
            <span className="module">{parts[4]}</span>
            {parts[5]}
          </span>
        );
      }
    }
    
    // Add specific handling for probe results
    if (entry.content.match(/\[PRB:/)) {
      const prbMatch = entry.content.match(/\[PRB:([^,]+),([^,]+),([^:]+):(\d)\]/);
      if (prbMatch) {
        const x = parseFloat(prbMatch[1]).toFixed(3);
        const y = parseFloat(prbMatch[2]).toFixed(3);
        const z = parseFloat(prbMatch[3]).toFixed(3);
        const success = prbMatch[4] === '1';
        
        return (
          <span className="entry-content probe-result">
            <span className="probe-label">PROBE</span>
            <span className="position-label">X:</span><span className="position-value">{x}</span>
            <span className="position-label">Y:</span><span className="position-value">{y}</span>
            <span className="position-label">Z:</span><span className="position-value">{z}</span>
            <span className={`probe-status ${success ? 'success' : 'failure'}`}>
              {success ? 'SUCCESS' : 'FAILED'}
            </span>
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
      <span className="entry-type-tag">{getTypeTag(entry)}</span>
      {renderContent()}
    </div>
  );
});

// Get a styled type tag based on message type
function getTypeTag(entry) {
  if (entry.type === 'sent') {
    return <span className="type-tag sent-tag">SENT</span>;
  } else if (entry.type === 'system') {
    return <span className="type-tag system-tag">SYS</span>;
  } else if (entry.type === 'error') {
    return <span className="type-tag error-tag">ERR</span>;
  } else if (entry.type === 'response') {
    if (entry.level === 'ERROR') {
      return <span className="type-tag error-tag">ERR</span>;
    } else if (entry.level === 'WARN') {
      return <span className="type-tag warning-tag">WARN</span>;
    } else if (entry.level === 'INFO') {
      return <span className="type-tag info-tag">INFO</span>;
    } else if (entry.level === 'DEBUG') {
      return <span className="type-tag debug-tag">DEBUG</span>;
    } else if (entry.level === 'TELEMETRY') {
      return <span className="type-tag telemetry-tag">TELEM</span>;
    } else if (entry.content.startsWith('<')) {
      return <span className="type-tag status-tag">STATUS</span>;
    } else if (entry.content.match(/\[MSG:/)) {
      return <span className="type-tag message-tag">MSG</span>;
    } else if (entry.content.match(/\[PRB:/)) {
      return <span className="type-tag probe-tag">PROBE</span>;
    } else if (entry.content.match(/\[ALARM:/)) {
      return <span className="type-tag alarm-tag">ALARM</span>;
    } else {
      return <span className="type-tag response-tag">RESP</span>;
    }
  }
  
  return <span className="type-tag default-tag">LOG</span>;
}

// Get description for FluidNC error codes
function getErrorDescription(code, defaultMsg) {
  const errorDescriptions = {
    '1': 'G-code words consist of a letter and a value. Letter was not found',
    '2': 'Numeric value format is not valid or missing an expected value',
    '3': 'Grbl \'$\' system command was not recognized or supported',
    '4': 'Negative value received for an expected positive value',
    '5': 'Homing cycle is not enabled via settings',
    '6': 'Minimum step pulse time must be greater than 3usec',
    '7': 'EEPROM read failed. Reset and restored to default values',
    '8': 'Grbl \'$\' command cannot be used unless Grbl is IDLE',
    '9': 'G-code locked out during alarm or jog state',
    '10': 'Soft limits cannot be enabled without homing also enabled',
    '11': 'Max characters per line exceeded',
    '12': 'Grbl \'$\' setting value exceeds expected range',
    '13': 'Grbl \'$\' setting disabled or temporarily disabled during this cycle',
    '14': 'Unsupported or invalid g-code command found in block',
    '15': 'More g-code words found in block than letters supported by capabilities',
    '16': 'G-code words found in block that aren\'t supported or valid',
    '17': 'Modal group violation',
    '18': 'Coordinate systems G54-G59 are not supported',
    '19': 'Only G0 and G1 motion modes are supported',
    '20': 'Unsupported or invalid g-code command found in block',
    '21': 'Feedrate has not yet been set or is undefined',
    '22': 'G-code command requires an integer value',
    '23': 'Multiple g-code commands found in one block',
    '24': 'Coordinate system cannot be changed during a gcode job',
    '25': 'G59.x work coordinate systems are not supported',
    '26': 'G0/1 command requiring an axis word was not provided any',
    '27': 'Invalid target for G0/1 specified',
    '28': 'Invalid target for G2/3 specified',
    '29': 'G2/3 arc radius error',
    '30': 'G2/3 arc radius error',
    '31': 'G2/3 arc radius error',
    '32': 'G2/3 arc radius error',
    '33': 'G2/3 arc radius error',
    '34': 'G2/3 arc radius error',
    '35': 'G2/3 arc radius error',
    '36': 'G2/3 arc radius error',
    '37': 'G43.1/M6 tool number error',
    '38': 'Invalid tool number',
    '39': 'Command requires xyz axis letter'
  };
  
  return errorDescriptions[code] || defaultMsg || `Unknown error code: ${code}`;
}

// Get description for FluidNC alarm codes
function getAlarmDescription(code, defaultMsg) {
  const alarmDescriptions = {
    '1': 'Hard limit triggered - machine position is likely lost due to sudden stop',
    '2': 'Soft limit alarm - G-code motion target exceeds machine travel',
    '3': 'Reset while in motion - G-code motion may not complete as expected',
    '4': 'Probe fail - Probe did not contact the workpiece within the programmed travel',
    '5': 'Probe fail - Probe initial state check failed',
    '6': 'Homing fail - Reset during active homing cycle',
    '7': 'Homing fail - Safety door was opened during active homing cycle',
    '8': 'Homing fail - Cycle failed to clear limit switch when pulling off',
    '9': 'Homing fail - Could not find limit switch within search distance',
    '10': 'Homing fail - Homing is disabled in settings',
    '11': 'Homing fail - Pull-off travel failed to clear limit switch',
    '12': 'Homing fail - Could not find second limit switch for calibration',
    '13': 'Failed to get out of limit switches - Check wiring and mechanism'
  };
  
  return alarmDescriptions[code] || defaultMsg || `Unknown alarm code: ${code}`;
}

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
const FluidNCConsolePanel = ({ onSendCommand = () => {} }) => {
  const [commandHistory, setCommandHistory] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [debugLevels, setDebugLevels] = useState({
    ERROR: true,    // DEBUG_ERROR (0)
    WARNING: true,  // DEBUG_WARNING (1)
    INFO: true,     // DEBUG_INFO (2)
    DEBUG: false,   // DEBUG_VERBOSE (3)
    SENT: true,     // User sent commands
    RESPONSE: true, // General responses
    SYSTEM: true,   // System messages
    TELEMETRY: false, // Status messages (position reports)
    ALARM: true,    // Alarm messages
    PROBE: true     // Probe results
  });
  
  const consoleEndRef = useRef(null);
  const consoleOutputRef = useRef(null);
  const inputRef = useRef(null);
  const isScrollingRef = useRef(false);
  const lastScrollTime = useRef(0);

  // Parse message level from robot message format - memoized
  const parseMessageLevel = useCallback((message) => {
    if (message.includes('[TELEMETRY]')) {
      return 'TELEMETRY';
    }
    
    // Check for ALARM messages
    if (message.match(/\[ALARM:/)) {
      return 'ERROR'; // Categorize alarms as errors for filtering
    }
    
    // Check for ERROR messages
    if (message.match(/\[ERROR:/)) {
      return 'ERROR';
    }
    
    // Check for status messages
    if (message.startsWith('<') && message.includes('|MPos:')) {
      return 'TELEMETRY';
    }
    
    // Check for probe results
    if (message.match(/\[PRB:/)) {
      return 'PROBE';
    }
    
    // Message format: [timestamp][CORE #][LEVEL][Module] Message
    const levelMatch = message.match(/\[\d+:\d+:\d+\.\d+\]\[CORE \d+\]\[([A-Z]+)\s*\]/);
    if (levelMatch) {
      return levelMatch[1].trim();
    }
    
    // Check for standard message types
    if (message.match(/\[MSG:/)) {
      return 'INFO';
    }
    
    // Default response level
    return 'RESPONSE';
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
      case 'sent':
        return 'console-sent';
      case 'response':
        return 'console-response';
      case 'error':
        return 'console-error';
      case 'system':
        return 'console-system';
      case 'TELEMETRY':
        return 'console-telemetry';
      case 'ALARM':
        return 'console-alarm';
      case 'PROBE':
        return 'console-probe';
      default:
        return '';
    }
  }, []);

  // Add a command or response to the history with size limiting
  const addEntry = useCallback((type, content, level = null) => {
    // Skip "ok" messages
    if (type === 'response' && content.trim() === 'ok') {
      return;
    }
    
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
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

    // Add command to history - using 'sent' instead of 'command' type
    addEntry('sent', currentCommand);
    
    // Handle help command
    if (currentCommand.toLowerCase() === 'help') {
      const helpResponse = 'FluidNC Console Commands:\n' + 
        '- clear: Clear console\n' +
        '- help: Show this help\n' +
        '- ?: Request status report\n' +
        '- $?: View available $ commands\n' +
        '- $H: Run homing cycle\n' +
        '- $X: Unlock machine after alarm';
      
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
        // Simulate a response for demonstration if no serial connection
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
    const sentCommands = commandHistory.filter(item => item.type === 'sent').map(item => item.content);
    
    if (sentCommands.length === 0) return;
    
    let newIndex = historyIndex + direction;
    
    if (newIndex < -1) newIndex = -1;
    if (newIndex >= sentCommands.length) newIndex = sentCommands.length - 1;
    
    setHistoryIndex(newIndex);
    
    if (newIndex === -1) {
      setCurrentCommand('');
    } else {
      setCurrentCommand(sentCommands[sentCommands.length - 1 - newIndex]);
    }
  }, [commandHistory, historyIndex]);

  // Handle key press - memoized
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      sendCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateHistory(1); // Go to previous command
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateHistory(-1); // Go to next command
    } else if (e.key === 'Escape') {
      setCurrentCommand('');
      setHistoryIndex(-1);
    } else if (e.ctrlKey && e.key === 'l') {
      // Ctrl+L to clear console (common in terminals)
      e.preventDefault();
      setCommandHistory([]);
    } else if (e.ctrlKey && e.key === 'k') {
      // Ctrl+K to clear input
      e.preventDefault();
      setCurrentCommand('');
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
    if (entry.type === 'sent') {
      return 'SENT';
    } else if (entry.type === 'error') {
      return 'ERROR';
    } else if (entry.type === 'system') {
      return 'SYSTEM';
    } else if (entry.level) {
      // Special cases based on content
      if (entry.content.match(/\[ALARM:/)) {
        return 'ALARM';
      }
      
      if (entry.content.match(/\[PRB:/)) {
        return 'PROBE';
      }
      
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

  // Handle focus on the input field when clicking on the console output
  const handleConsoleClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Listen for serial data events
  useEffect(() => {
    const handleSerialData = (event) => {
      if (event.detail && event.detail.data) {
        // Determine if this is a status/telemetry message
        const isStatusMessage = event.detail.isStatusMessage || 
                               (event.detail.data.startsWith('<') && event.detail.data.includes('|MPos:'));
        
        // Skip status messages if TELEMETRY filter is disabled
        if (isStatusMessage && !debugLevels.TELEMETRY) {
          return;
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
        } else if (data.includes('[ERROR]') || data.includes('error') || data.match(/\[ERROR:/)) {
          messageLevel = 'ERROR';
        } else if (data.includes('[WARN]') || data.includes('warning')) {
          messageLevel = 'WARN';
        } else if (data.includes('[INFO]') || data.match(/\[MSG:/)) {
          messageLevel = 'INFO';
        } else if (data.includes('[DEBUG]')) {
          messageLevel = 'DEBUG';
        } else if (data.match(/\[ALARM:/)) {
          messageLevel = 'ALARM';
        } else if (data.match(/\[PRB:/)) {
          messageLevel = 'PROBE';
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
    
    // Simulate initial connection message
    addEntry('system', `FluidNC Console ready`);
    
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
  }, [addEntry, debugLevels.TELEMETRY]);

return (
  <div className="console-container">
    {/* Simplified Toolbar with filters in a grid and actions on the right */}
    <div className="console-toolbar">
      {/* Filter options in a grid */}
      <div className="console-filters">
        {/* Error filter */}
        <div 
          className={`filter-option ${debugLevels.ERROR ? 'active' : ''}`}
          onClick={() => toggleDebugLevel('ERROR')}
          title="Show ERROR messages (Ctrl+1)"
        >
          <span className="filter-indicator error"></span>
          <span className="filter-label">ERROR</span>
        </div>
        
        {/* Warning filter */}
        <div 
          className={`filter-option ${debugLevels.WARNING ? 'active' : ''}`}
          onClick={() => toggleDebugLevel('WARNING')}
          title="Show WARNING messages (Ctrl+2)"
        >
          <span className="filter-indicator warning"></span>
          <span className="filter-label">WARN</span>
        </div>
        
        {/* Info filter */}
        <div 
          className={`filter-option ${debugLevels.INFO ? 'active' : ''}`}
          onClick={() => toggleDebugLevel('INFO')}
          title="Show INFO messages (Ctrl+3)"
        >
          <span className="filter-indicator info"></span>
          <span className="filter-label">INFO</span>
        </div>
        
        {/* Debug filter */}
        <div 
          className={`filter-option ${debugLevels.DEBUG ? 'active' : ''}`}
          onClick={() => toggleDebugLevel('DEBUG')}
          title="Show DEBUG messages (Ctrl+4)"
        >
          <span className="filter-indicator debug"></span>
          <span className="filter-label">DEBUG</span>
        </div>
        
        {/* Sent filter */}
        <div 
          className={`filter-option ${debugLevels.SENT ? 'active' : ''}`}
          onClick={() => toggleDebugLevel('SENT')}
          title="Show sent commands"
        >
          <span className="filter-indicator sent"></span>
          <span className="filter-label">SENT</span>
        </div>
        
        {/* Response filter */}
        <div 
          className={`filter-option ${debugLevels.RESPONSE ? 'active' : ''}`}
          onClick={() => toggleDebugLevel('RESPONSE')}
          title="Show general responses"
        >
          <span className="filter-indicator response"></span>
          <span className="filter-label">RESP</span>
        </div>
        
        {/* System filter */}
        <div 
          className={`filter-option ${debugLevels.SYSTEM ? 'active' : ''}`}
          onClick={() => toggleDebugLevel('SYSTEM')}
          title="Show system messages"
        >
          <span className="filter-indicator system"></span>
          <span className="filter-label">SYS</span>
        </div>

        {/* Telemetry filter */}
        <div 
          className={`filter-option ${debugLevels.TELEMETRY ? 'active' : ''}`}
          onClick={() => toggleDebugLevel('TELEMETRY')}
          title="Show position reports (toggle with T key)"
        >
          <span className="filter-indicator telemetry"></span>
          <span className="filter-label">STATUS</span>
        </div>
        
        {/* Alarm filter */}
        <div 
          className={`filter-option ${debugLevels.ALARM ? 'active' : ''}`}
          onClick={() => toggleDebugLevel('ALARM')}
          title="Show ALARM messages"
        >
          <span className="filter-indicator alarm"></span>
          <span className="filter-label">ALARM</span>
        </div>
        
        {/* Probe filter */}
        <div 
          className={`filter-option ${debugLevels.PROBE ? 'active' : ''}`}
          onClick={() => toggleDebugLevel('PROBE')}
          title="Show PROBE results"
        >
          <span className="filter-indicator probe"></span>
          <span className="filter-label">PROBE</span>
        </div>
      </div>

      {/* Action buttons (always right-aligned) */}
      <div className="console-actions">
        {/* Auto-scroll button */}
        {!autoScroll && (
          <button 
            className="toolbar-button"
            onClick={() => {
              setAutoScroll(true);
              consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            title="Scroll to bottom (End)"
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
        )}
        
        {/* Clear button */}
        <button 
          className="toolbar-button"
          onClick={() => setCommandHistory([])}
          title="Clear console (Ctrl+L)"
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
      onClick={handleConsoleClick}
    >
      {commandHistory.length === 0 && (
        <div className="console-welcome">
          <p>Welcome to the FluidNC Command Console.</p>
          <p>Type 'help' for a list of available commands.</p>
          <p>Type 'clear' or press Ctrl+L to clear the console.</p>
          <p>Use up/down arrows to navigate command history.</p>
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
    
    {/* Input area with command execution button */}
    <div className="console-input-container">
      <div className="console-input-wrapper">
        <span className="console-prompt">&gt;</span>
        <input
          type="text"
          className="console-input"
          value={currentCommand}
          onChange={(e) => setCurrentCommand(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Enter command... (↑↓ for history)"
          autoFocus
          ref={inputRef}
          spellCheck="false"
        />
        <button 
          className="send-button"
          onClick={sendCommand}
          title="Send command (Enter)"
          disabled={!currentCommand.trim()}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
      
      {/* Status bar with useful information */}
      <div className="console-status-bar">
        <div className="status-item">
          <span className="status-label">Connection:</span>
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
        <div className="status-item">
          <span className="status-label">Auto-scroll:</span>
          <span className={`status-value ${autoScroll ? "enabled" : "disabled"}`}>
            {autoScroll ? "On" : "Off"}
          </span>
        </div>
        <div className="status-item keyboard-shortcuts">
          <span className="kbd" title="History navigation">↑↓</span>
          <span className="kbd" title="Clear console">Ctrl+L</span>
        </div>
      </div>
    </div>
  </div>
);
};

export default FluidNCConsolePanel;