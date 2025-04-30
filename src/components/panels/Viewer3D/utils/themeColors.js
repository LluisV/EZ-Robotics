/**
 * Get theme colors based on current document theme
 * 
 * @returns {Object} Theme color definitions
 */
export function getThemeColors() {
    // Check the current theme class on document.documentElement
    const themeClass = document.documentElement.className || '';
    
    // Default dark theme colors
    const colors = {
      background: '#1a1a1a',
      gridPrimary: '#444444',
      gridSecondary: '#333333',
      xAxis: '#cc3333',
      yAxis: '#00aa55',
      zAxis: '#0077cc',
      robotPosition: '#ffaa00',
      stlDefault: '#d9eaff',
      stlSelected: '#ffcc66',
      worldCoord: '#888888',
      workCoord: '#ffaa33'
    };
  
    // Adjust colors based on theme
    if (themeClass.includes('theme-light') || themeClass.includes('theme-light-spaced')) {
      colors.background = '#f0f0f0';
      colors.gridPrimary = '#cccccc';
      colors.gridSecondary = '#aaaaaa';
      colors.xAxis = '#aa0000';
      colors.yAxis = '#007700';
      colors.zAxis = '#0000aa';
      colors.robotPosition = '#ff8800';
      colors.stlDefault = '#7088aa';
      colors.stlSelected = '#ee9944';
      colors.worldCoord = '#666666';
      colors.workCoord = '#ee8800';
    } else if (themeClass.includes('theme-visual-studio')) {
      colors.background = '#1e1e1e';
      colors.gridPrimary = '#3f3f3f';
      colors.gridSecondary = '#2d2d2d';
      colors.stlDefault = '#569cd6';
      colors.stlSelected = '#ce9178';
      colors.worldCoord = '#777777';
      colors.workCoord = '#d7ba7d';
    } else if (themeClass.includes('theme-dracula')) {
      colors.background = '#282a36';
      colors.gridPrimary = '#44475a';
      colors.gridSecondary = '#383a4c';
      colors.xAxis = '#ff5555';
      colors.yAxis = '#50fa7b';
      colors.zAxis = '#8be9fd';
      colors.robotPosition = '#ffb86c';
      colors.stlDefault = '#bd93f9';
      colors.stlSelected = '#ffb86c';
      colors.worldCoord = '#6272a4';
      colors.workCoord = '#ffb86c';
    } else if (themeClass.includes('theme-abyss') || themeClass.includes('theme-abyss-spaced')) {
      colors.background = '#000c18';
      colors.gridPrimary = '#223344';
      colors.gridSecondary = '#111a22';
      colors.xAxis = '#ff628c';
      colors.yAxis = '#3ad900';
      colors.zAxis = '#5ccfe6';
      colors.robotPosition = '#ff9d00';
      colors.stlDefault = '#82aaff';
      colors.stlSelected = '#ff9d00';
      colors.worldCoord = '#557799';
      colors.workCoord = '#eebb77';
    } else if (themeClass.includes('theme-replit')) {
      colors.background = '#f5f9fc';
      colors.gridPrimary = '#dddddd';
      colors.gridSecondary = '#eeeeee';
      colors.xAxis = '#e91e63';
      colors.yAxis = '#13c2c2';
      colors.zAxis = '#1890ff';
      colors.robotPosition = '#fa8c16';
      colors.stlDefault = '#9254de';
      colors.stlSelected = '#fa8c16';
      colors.worldCoord = '#595959';
      colors.workCoord = '#fa8c16';
    }
    
    return colors;
  }
  
  /**
   * Add a listener for theme changes that will call the callback when the theme changes
   * 
   * @param {Function} callback Function to call when theme changes
   * @returns {Function} Function to remove the listener
   */
  export function addThemeChangeListener(callback) {
    // Create a MutationObserver to watch for class/style changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' || mutation.attributeName === 'style') {
          callback();
        }
      });
    });
  
    // Start observing document.documentElement
    observer.observe(document.documentElement, { attributes: true });
  
    // Return a function to remove the observer
    return () => observer.disconnect();
  }