import React, { useState, useRef, useEffect } from 'react';
import communicationService from '../../services/communication/CommunicationService';
import '../../styles/console.css';

/**
 * Enhanced Console Panel component for sending commands and viewing filtered messages.
 * Features debug level filtering and styled message output.
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

  // Sample commands that a user might send to a robot
  const sampleCommands = [
    { command: 'G28', description: 'Home all axes' },
    { command: 'G1 X100 Y100 F1000', description: 'Move to X100 Y100 at feed rate 1000' },
    { command: 'M104 S200', description: 'Set extruder temperature to 200°C' },
    { command: 'M140 S60', description: 'Set bed temperature to 60°C' },
    { command: 'M106 S255', description: 'Set fan speed to maximum' },
  ];

  // Parse message level from robot message format
  const parseMessageLevel = (message) => {
    if (message.includes('[TELEMETRY]')) {
      return 'TELEMETRY';
    }
    // Message format: [timestamp][CORE #][LEVEL][Module] Message
    const levelMatch = message.match(/\[\d+:\d+:\d+\.\d+\]\[CORE \d+\]\[([A-Z]+)\s*\]/);
    if (levelMatch) {
      return levelMatch[1].trim();
    }
    return null;
  };

  // Get level-specific styles
  const getLevelStyle = (level) => {
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
  };

  // Add a command or response to the history
  const addEntry = (type, content) => {
    const timestamp = new Date().toLocaleTimeString();
    let level = type;
    
    // For responses, try to parse the level from the message
    if (type === 'response') {
      const parsedLevel = parseMessageLevel(content);
      if (parsedLevel) {
        level = parsedLevel;
      }
    }
    
    setCommandHistory(prev => [
      ...prev, 
      {
        type,
        level,
        content,
        timestamp
      }
    ]);
  };

  // Send a command
  const sendCommand = () => {
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
      // In a real implementation, this would send to communication service
      communicationService.sendCommand(currentCommand)
        .then(response => {
          // Process actual response from the robot
          if (response) {
            addEntry('response', response);
          }
        })
        .catch(error => {
          addEntry('error', `Error: ${error.message}`);
        });
      
      // Call the callback
      onSendCommand(currentCommand);
    }
    
    // Clear current command
    setCurrentCommand('');
    setHistoryIndex(-1);
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateHistory(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateHistory(1);
    }
  };

  // Navigate through command history
  const navigateHistory = (direction) => {
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
  };

  // Toggle a debug level filter
  const toggleDebugLevel = (level) => {
    setDebugLevels(prev => ({
      ...prev,
      [level]: !prev[level]
    }));
  };

  // Check if a message should be visible based on current filters
  const isMessageVisible = (entry) => {
    // Map entry types/levels to filter keys
    let filterKey;

    if (entry.type === 'command') {
      filterKey = 'COMMAND';
    } else if (entry.type === 'error') {
      filterKey = 'ERROR';
    } else if (entry.type === 'system') {
      filterKey = 'SYSTEM';
    } else if (entry.level) {
      // Use parsed level for responses
      if (['ERROR', 'WARN', 'INFO', 'DEBUG', 'TELEMETRY'].includes(entry.level)) {
        filterKey = entry.level;
        // Normalize WARN to WARNING for filter
        if (filterKey === 'WARN') filterKey = 'WARNING';
      } else {
        filterKey = 'RESPONSE';
      }
    } else {
      filterKey = 'RESPONSE';
    }
    
    return debugLevels[filterKey];
  };

  // Auto-scroll to the bottom when command history changes
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [commandHistory, autoScroll]);

  // Listen for messages from the communication service
  useEffect(() => {
    const handleResponse = (data) => {
      if (data && data.response) {
        addEntry('response', data.response);
      }
    };

    const handleError = (data) => {
      if (data && data.error) {
        addEntry('error', typeof data.error === 'string' ? data.error : data.error.message || 'Unknown error');
      }
    };

    // Register event listeners
    communicationService.on('response', handleResponse);
    communicationService.on('error', handleError);
    
    // Clean up listeners on unmount
    return () => {
      communicationService.removeListener('response', handleResponse);
      communicationService.removeListener('error', handleError);
    };
  }, []);

  // Handle scroll to detect if user has scrolled up manually
  const handleScroll = () => {
    if (!consoleOutputRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = consoleOutputRef.current;
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 10;
    
    if (isScrolledToBottom !== autoScroll) {
      setAutoScroll(isScrolledToBottom);
    }
  };
  

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
              consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            title="Scroll to bottom"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M12 3v18"></path>
              <path d="M6 15l6 6 6-6"></path>
            </svg>
          </button>
          
          <button 
            className="toolbar-button"
            onClick={() => setCommandHistory([])}
            title="Clear console"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
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
        
        {commandHistory.filter(isMessageVisible).map((entry, index) => {
          const levelClass = getLevelStyle(entry.type === 'response' ? entry.level : entry.type);
          
          // Format robot messages with syntax highlighting
          const formattedContent = entry.type === 'response' && entry.content.match(/\[\d+:\d+:\d+\.\d+\]\[CORE \d+\]\[[A-Z]+\s*\]/) 
            ? entry.content.replace(
                /(\[\d+:\d+:\d+\.\d+\])(\[CORE \d+\])(\[[A-Z]+\s*\])(\[[^\]]+\])(.*)/g, 
                '<span class="timestamp">$1</span><span class="core">$2</span><span class="level">$3</span><span class="module">$4</span>$5'
              )
            : entry.content;
          
          return (
            <div 
              key={index} 
              className={`console-entry ${levelClass}`}
            >
              <span className="entry-line-number">{index + 1}</span>
              
              {entry.type === 'command' ? (
                <span className="entry-content">
                  <span className="console-prompt">&gt;</span> {entry.content}
                </span>
              ) : (
                <span 
                  className="entry-content"
                  dangerouslySetInnerHTML={{ __html: formattedContent }}
                />
              )}
            </div>
          );
        })}
        
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
            <span className={`status-value ${communicationService.getConnectionInfo().status === "connected" ? "connected" : "disconnected"}`}>
              {communicationService.getConnectionInfo().status === "connected" ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Debug Level:</span>
            <span className="status-value">
              {Object.entries(debugLevels)
                .filter(([_, enabled]) => enabled)
                .map(([level]) => level.charAt(0))
                .join('')}
            </span>
          </div>
          <div className="status-indicator-wrapper">
            <button 
              className="toolbar-button send-button"
              onClick={sendCommand}
              title="Send command (Enter)"
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