/**
 * Utility functions for handling file uploads and imports
 */

/**
 * Process selected STL files and pass them to the StlManager
 * 
 * @param {FileList} files Selected files from input element
 * @param {Object} stlManager StlManager instance
 * @returns {Promise<Array>} Array of loaded file IDs
 */
export const processStlFiles = async (files, stlManager) => {
    if (!files || files.length === 0 || !stlManager) {
      return [];
    }
  
    // Convert FileList to Array for easier manipulation
    const fileArray = Array.from(files);
    const loadedIds = [];
  
    // Process each STL file
    for (const file of fileArray) {
      // Only process STL files
      if (!file.name.toLowerCase().endsWith('.stl')) {
        console.warn(`File ${file.name} is not an STL file and will be skipped.`);
        continue;
      }
  
      try {
        // Read the file as ArrayBuffer
        const fileContent = await readFileAsArrayBuffer(file);
        
        // Load the STL model
        const fileId = stlManager.loadStlModel(file.name, fileContent);
        
        if (fileId) {
          loadedIds.push(fileId);
        }
      } catch (error) {
        console.error(`Error processing STL file ${file.name}:`, error);
      }
    }
  
    return loadedIds;
  };
  
  /**
   * Read a file as ArrayBuffer
   * 
   * @param {File} file File to read
   * @returns {Promise<ArrayBuffer>} File content as ArrayBuffer
   */
  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      
      reader.onerror = (e) => {
        reject(new Error(`Error reading file ${file.name}: ${e.target.error}`));
      };
      
      reader.readAsArrayBuffer(file);
    });
  };
  
  /**
   * Handle file selection from file input
   * 
   * @param {Event} event Change event from file input
   * @param {Object} stlManager StlManager instance
   * @param {Function} callback Optional callback after files are processed
   */
  export const handleFileSelection = async (event, stlManager, callback) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
  
    const loadedIds = await processStlFiles(files, stlManager);
    
    // Reset the file input value to allow selecting the same files again
    event.target.value = null;
    
    // Call callback if provided
    if (callback && typeof callback === 'function') {
      callback(loadedIds);
    }
  };