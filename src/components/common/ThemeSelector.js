import React from 'react';

/**
 * Theme selector component for changing the UI theme
 * 
 * @param {Object} props Component properties
 * @param {string} props.currentTheme Current selected theme
 * @param {Function} props.onThemeChange Function to call when theme is changed
 * @param {Object[]} props.availableThemes List of available themes
 */
const ThemeSelector = ({ currentTheme, onThemeChange, availableThemes }) => {
  return (
    <div className="theme-selector">
      <select 
        value={currentTheme}
        onChange={(e) => onThemeChange(e.target.value)}
        className="toolbar-select"
        title="Select Theme"
      >
        {availableThemes.map(theme => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ThemeSelector;