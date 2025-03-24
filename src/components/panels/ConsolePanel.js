import React, { useState, useRef, useEffect } from 'react';

/**
 * Console Panel component for sending commands to the robot.
 * 
 * @param {Object} props Component properties
 * @param {function} props.onSendCommand Function to call when a command is sent
 */
const ConsolePanel = ({ onSendCommand = () => {} }) => {
  const [commandHistory, setCommandHistory] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const consoleEndRef = useRef(null);

  // Sample commands that a user might send to a robot
  const sampleCommands = [
    { command: 'G28', description: 'Home all axes' },
    { command: 'G1 X100 Y100 F1000', description: 'Move to X100 Y100 at feed rate 1000' },
    { command: 'M104 S200', description: 'Set extruder temperature to 200°C' },
    { command: 'M140 S60', description: 'Set bed temperature to 60°C' },
    { command: 'M106 S255', description: 'Set fan speed to maximum' },
  ];

  // Add a command response to the history
  const addCommandResponse = (command, response, isError = false) => {
    setCommandHistory(prev => [
      ...prev, 
      { 
        type: 'command', 
        content: command, 
        timestamp: new Date().toLocaleTimeString() 
      },
      { 
        type: isError ? 'error' : 'response', 
        content: response, 
        timestamp: new Date().toLocaleTimeString() 
      }
    ]);
  };

  // Send a command
  const sendCommand = () => {
    if (!currentCommand.trim()) return;

    // In a real implementation, this would send the command to the robot
    // and get a real response
    
    // For now, simulate a response
    let response;
    let isError = false;

    if (currentCommand.toLowerCase() === 'help') {
      response = 'Available commands:\n' + sampleCommands.map(cmd => 
        `${cmd.command} - ${cmd.description}`
      ).join('\n');
    } else if (currentCommand.toLowerCase() === 'clear') {
      setCommandHistory([]);
      setCurrentCommand('');
      return;
    } else if (currentCommand.startsWith('G28')) {
      response = 'Homing all axes...';
    } else if (currentCommand.startsWith('G1')) {
      response = 'Moving to specified position...';
    } else if (currentCommand.startsWith('M104')) {
      const tempMatch = currentCommand.match(/S(\d+)/);
      const temp = tempMatch ? tempMatch[1] : '0';
      response = `Setting extruder temperature to ${temp}°C`;
    } else if (currentCommand.startsWith('M140')) {
      const tempMatch = currentCommand.match(/S(\d+)/);
      const temp = tempMatch ? tempMatch[1] : '0';
      response = `Setting bed temperature to ${temp}°C`;
    } else if (Math.random() > 0.8) {
      // Occasionally show an error
      response = `Error: Command '${currentCommand}' could not be executed`;
      isError = true;
    } else {
      response = `Command '${currentCommand}' executed successfully`;
    }

    // Add to history
    addCommandResponse(currentCommand, response, isError);
    
    // Call the callback
    onSendCommand(currentCommand);
    
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

  // Auto-scroll to the bottom when command history changes
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [commandHistory]);

  return (
    <div className="panel-content">
      <div className="panel-header">
        <div className="panel-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          Command Console
        </div>
      </div>
      
      <div className="console-container">
        <div className="console-output">
          {commandHistory.map((entry, index) => (
            <div 
              key={index} 
              className={`console-entry console-${entry.type}`}
            >
              {entry.type === 'command' ? (
                <span><span className="console-prompt">&gt;</span> {entry.content}</span>
              ) : (
                <span>{entry.content}</span>
              )}
            </div>
          ))}
          {commandHistory.length === 0 && (
            <div className="console-welcome">
              <p>Welcome to the Robot Command Console.</p>
              <p>Type 'help' for a list of sample commands.</p>
              <p>Type 'clear' to clear the console.</p>
            </div>
          )}
          <div ref={consoleEndRef} />
        </div>
        
        <div className="console-input-container">
          <span className="console-prompt">&gt;</span>
          <input
            type="text"
            className="console-input"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Enter command..."
          />
          <button 
            className="toolbar-button primary"
            onClick={sendCommand}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsolePanel;