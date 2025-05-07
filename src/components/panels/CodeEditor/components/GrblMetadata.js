import React, { useState, useEffect } from 'react';

/**
 * Enhanced component to display GRBL/FluidNC G-code metadata information
 * With better detection of consecutive coordinate-only moves
 */
const GrblMetadata = ({ code, format, fileName, modified }) => {
  const [metadata, setMetadata] = useState({
    format: format || 'unknown',
    stats: {
      totalLines: 0,
      nonEmptyLines: 0,
      commentLines: 0,
      explicitMoves: 0,
      impliedMoves: 0,
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }
    }
  });
  
  // Calculate metadata when code changes
  useEffect(() => {
    if (!code) return;
    
    // Parse the code to extract metadata
    const stats = analyzeGCode(code);
    
    // Update metadata
    setMetadata({
      format: format || (stats.impliedMoves > 0 ? 'grbl' : 'standard'),
      stats
    });
  }, [code, format]);
  
  /**
   * Analyze G-code to extract metadata
   */
  const analyzeGCode = (gcode) => {
    const lines = gcode.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim()).length;
    const commentLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && (trimmed.startsWith(';') || trimmed.startsWith('('));
    }).length;
    
    // Count explicit and implied moves
    let explicitMoves = 0;
    let impliedMoves = 0;
    let activeGMode = null;
    
    // Calculate bounds
    const bounds = {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity }
    };
    
    let hasCoordinates = false;
    
    lines.forEach(line => {
      // Skip comments and empty lines
      const cleanedLine = cleanLine(line);
      if (!cleanedLine) return;
      
      // Extract tokens
      const tokens = extractTokens(cleanedLine);
      
      // Look for G commands
      const gCommands = tokens.filter(token => /^G[0-3]/.test(token));
      
      // Check for coordinates
      const hasCoords = tokens.some(token => /^[XYZ]-?\d+(\.\d+)?$/.test(token));
      
      // Update active G mode
      if (gCommands.length > 0) {
        activeGMode = gCommands[0];
        if (hasCoords) explicitMoves++;
      } else if (hasCoords && activeGMode) {
        // This is an implied move using the previous G command
        impliedMoves++;
      }
      
      // Update bounds if there are coordinates
      if (hasCoords) {
        const xMatch = cleanedLine.match(/X(-?\d+\.?\d*)/);
        const yMatch = cleanedLine.match(/Y(-?\d+\.?\d*)/);
        const zMatch = cleanedLine.match(/Z(-?\d+\.?\d*)/);
        
        if (xMatch) {
          const x = parseFloat(xMatch[1]);
          bounds.min.x = Math.min(bounds.min.x, x);
          bounds.max.x = Math.max(bounds.max.x, x);
          hasCoordinates = true;
        }
        
        if (yMatch) {
          const y = parseFloat(yMatch[1]);
          bounds.min.y = Math.min(bounds.min.y, y);
          bounds.max.y = Math.max(bounds.max.y, y);
          hasCoordinates = true;
        }
        
        if (zMatch) {
          const z = parseFloat(zMatch[1]);
          bounds.min.z = Math.min(bounds.min.z, z);
          bounds.max.z = Math.max(bounds.max.z, z);
          hasCoordinates = true;
        }
      }
    });
    
    // If no coordinates found, set default bounds
    if (!hasCoordinates) {
      bounds.min = { x: 0, y: 0, z: 0 };
      bounds.max = { x: 0, y: 0, z: 0 };
    }
    
    return {
      totalLines: lines.length,
      nonEmptyLines,
      commentLines,
      explicitMoves,
      impliedMoves,
      bounds
    };
  };
  
  /**
   * Clean a line by removing comments and trimming whitespace
   */
  const cleanLine = (line) => {
    // Handle parentheses comments
    let cleanedLine = line.replace(/\(.*?\)/g, '');
    
    // Handle semicolon comments
    if (cleanedLine.includes(';')) {
      cleanedLine = cleanedLine.split(';')[0];
    }
    
    return cleanedLine.trim();
  };
  
  /**
   * Extract tokens from a line of G-code
   */
  const extractTokens = (line) => {
    const tokenRegex = /([A-Z])(-?\d+\.?\d*)/g;
    const tokens = [];
    let match;
    
    while ((match = tokenRegex.exec(line)) !== null) {
      tokens.push(match[0]);
    }
    
    return tokens;
  };
  
  /**
   * Format dimensions
   */
  const formatDimensions = () => {
    const { min, max } = metadata.stats.bounds;
    const width = max.x - min.x;
    const depth = max.y - min.y;
    const height = max.z - min.z;
    
    if (!isFinite(width) || !isFinite(depth) || !isFinite(height)) {
      return "0 × 0 × 0 mm";
    }
    
    return `${width.toFixed(1)} × ${depth.toFixed(1)} × ${height.toFixed(1)} mm`;
  };
  
  return (
    <div className="grbl-metadata">
      <div className="metadata-content">
        {/* File name as the first item */}
        <div className="grbl-metadata-item">
          <div className="file-name">
            <span className="file-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </span>
            <span className="name">{fileName}</span>
            {modified && <span className="modified-indicator">●</span>}
          </div>
        </div>
        
        {/* Format item */}
        <div className="grbl-metadata-item">
          <span className="grbl-metadata-label">Format:</span>
          <span className="grbl-metadata-value">
            {metadata.format === 'grbl' ? 'GRBL/FluidNC' : 'Standard G-code'}
            {metadata.format === 'grbl' && (
              <span className="file-format-badge grbl">GRBL</span>
            )}
          </span>
        </div>
        
        {/* Lines item */}
        <div className="grbl-metadata-item">
          <span className="grbl-metadata-label">Lines:</span>
          <span className="grbl-metadata-value">
            {metadata.stats.nonEmptyLines}
            <span style={{ opacity: 0.7, marginLeft: '3px', fontSize: '10px' }}>
              ({metadata.stats.commentLines} comments)
            </span>
          </span>
        </div>
        
        {/* Moves item */}
        <div className="grbl-metadata-item">
          <span className="grbl-metadata-label">Moves:</span>
          <span className="grbl-metadata-value">
            {metadata.stats.explicitMoves + metadata.stats.impliedMoves}
            {metadata.stats.impliedMoves > 0 && (
              <span className="implied-count" style={{ fontSize: '10px' }}>
                ({metadata.stats.impliedMoves} implied)
              </span>
            )}
          </span>
        </div>
        
        {/* Dimensions item */}
        <div className="grbl-metadata-item">
          <span className="grbl-metadata-label">Dimensions:</span>
          <span className="grbl-metadata-value bounds-value">
            {formatDimensions()}
            <span className="dimensions-badge">
              {!isFinite(metadata.stats.bounds.max.x - metadata.stats.bounds.min.x) ? 
                "No bounds" : 
                `X:${metadata.stats.bounds.min.x.toFixed(1)}~${metadata.stats.bounds.max.x.toFixed(1)}`
              }
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default GrblMetadata;