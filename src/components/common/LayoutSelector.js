import React, { useState, useEffect, useRef } from 'react';
import dockingManager from '../../services/docking/DockingManager';

/**
 * Layout Selector component - Allows users to switch between predefined
 * and custom layouts, save new layouts, and manage existing ones
 */
const LayoutSelector = ({ dockviewApi }) => {
  const [layouts, setLayouts] = useState([]);
  const [userLayouts, setUserLayouts] = useState([]);
  const [currentLayout, setCurrentLayout] = useState('default');
  const [showDropdown, setShowDropdown] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const dropdownRef = useRef(null);
  const saveDialogRef = useRef(null);

  // Initialize with API
  useEffect(() => {
    if (dockviewApi) {
      dockingManager.initialize(dockviewApi);
      loadLayouts();
    }
  }, [dockviewApi]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        (!saveDialogRef.current || !saveDialogRef.current.contains(event.target))
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load all available layouts
  const loadLayouts = () => {
    // Get predefined layouts
    const predefined = dockingManager.getPredefinedLayouts();
    
    // Get user layouts from localStorage
    const userSaved = [];
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('layout_') && !key.includes('default')) {
          const layoutName = key.substring(7); // Remove 'layout_' prefix
          userSaved.push({
            id: layoutName,
            name: layoutName.charAt(0).toUpperCase() + layoutName.slice(1), 
            isPredefined: false
          });
        }
      }
    }
    
    setLayouts(predefined);
    setUserLayouts(userSaved);
  };

  // Apply a layout with error handling
  const applyLayout = (layoutId) => {
    try {
      console.log('Applying layout:', layoutId);
      const success = dockingManager.loadLayout(layoutId);
      
      if (success) {
        setCurrentLayout(layoutId);
        setShowDropdown(false);
      } else {
        console.warn(`Layout '${layoutId}' could not be loaded`);
      }
    } catch (error) {
      console.error('Error applying layout:', error);
      alert(`Error applying layout: ${error.message}`);
    }
  };

  // Save current layout
  const saveLayout = () => {
    if (!newLayoutName.trim()) return;
    
    try {
      const formattedName = newLayoutName.trim().toLowerCase().replace(/\s+/g, '_');
      dockingManager.saveLayout(formattedName);
      
      setNewLayoutName('');
      setShowSaveDialog(false);
      loadLayouts();
      setCurrentLayout(formattedName);
    } catch (error) {
      console.error('Error saving layout:', error);
      alert(`Error saving layout: ${error.message}`);
    }
  };

  // Delete a layout
  const deleteLayout = (layoutId, event) => {
    event.stopPropagation();
    
    if (window.confirm(`Are you sure you want to delete the "${layoutId}" layout?`)) {
      try {
        localStorage.removeItem(`layout_${layoutId}`);
        loadLayouts();
        
        if (currentLayout === layoutId) {
          applyLayout('default');
        }
      } catch (error) {
        console.error('Error deleting layout:', error);
        alert(`Error deleting layout: ${error.message}`);
      }
    }
  };

  return (
    <div className="layout-selector" style={{ position: 'relative' }}>
      <button 
        className="toolbar-button"
        onClick={() => setShowDropdown(!showDropdown)}
        style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
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
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
        Layout: {currentLayout.charAt(0).toUpperCase() + currentLayout.slice(1)}
      </button>
      
      {showDropdown && (
        <div 
          ref={dropdownRef}
          className="layout-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            zIndex: 1000,
            minWidth: '220px',
            backgroundColor: 'var(--bg-dark)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius)',
            boxShadow: 'var(--shadow-medium)',
            marginTop: '5px',
            padding: '5px 0'
          }}
        >
          <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '5px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Predefined Layouts</h4>
            {layouts.map(layout => (
              <div 
                key={layout.id}
                onClick={() => applyLayout(layout.id)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  backgroundColor: currentLayout === layout.id ? 'var(--bg-light)' : 'transparent',
                  borderRadius: 'var(--border-radius)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{layout.name}</span>
              </div>
            ))}
          </div>
          
          {userLayouts.length > 0 && (
            <div style={{ padding: '5px 10px' }}>
              <h4 style={{ margin: '5px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Custom Layouts</h4>
              {userLayouts.map(layout => (
                <div 
                  key={layout.id}
                  onClick={() => applyLayout(layout.id)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    backgroundColor: currentLayout === layout.id ? 'var(--bg-light)' : 'transparent',
                    borderRadius: 'var(--border-radius)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{layout.name}</span>
                  <button
                    onClick={(e) => deleteLayout(layout.id, e)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--accent-red)',
                      padding: '0 5px'
                    }}
                    title="Delete layout"
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
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div style={{ padding: '10px', borderTop: '1px solid var(--border-color)', marginTop: '5px' }}>
            <button 
              className="toolbar-button"
              onClick={() => setShowSaveDialog(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
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
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Save Current Layout
            </button>
          </div>
        </div>
      )}
      
      {showSaveDialog && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1001
          }}
        >
          <div 
            ref={saveDialogRef}
            style={{
              backgroundColor: 'var(--bg-dark)',
              borderRadius: 'var(--border-radius)',
              padding: '20px',
              width: '300px',
              boxShadow: 'var(--shadow-large)'
            }}
          >
            <h3 style={{ margin: '0 0 15px 0' }}>Save Layout</h3>
            <input 
              type="text" 
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              placeholder="Enter layout name"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-light)',
                color: 'var(--text-primary)',
                marginBottom: '15px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                className="toolbar-button"
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewLayoutName('');
                }}
              >
                Cancel
              </button>
              <button 
                className="toolbar-button primary"
                onClick={saveLayout}
                disabled={!newLayoutName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutSelector;