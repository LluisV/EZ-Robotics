const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}${colors.bright}Starting FluidNC Robot Control...${colors.reset}`);

// Get Python command for the platform
const getPythonCommand = () => {
  return process.platform === 'win32' ? 'python' : 'python3';
};

// Check Python version
const checkPythonVersion = async () => {
  const pythonCmd = getPythonCommand();
  
  try {
    const { stdout } = await execAsync(`${pythonCmd} --version`);
    const versionMatch = stdout.match(/Python (\d+)\.(\d+)\.(\d+)/);
    
    if (versionMatch) {
      const major = parseInt(versionMatch[1]);
      const minor = parseInt(versionMatch[2]);
      
      console.log(`${colors.green}Found Python ${major}.${minor}${colors.reset}`);
      
      if (major < 3 || (major === 3 && minor < 8)) {
        console.error(`${colors.red}Python 3.8 or higher is required. Found ${major}.${minor}${colors.reset}`);
        return null;
      }
      
      return { major, minor };
    }
  } catch (error) {
    console.error(`${colors.red}Python is not installed or not in PATH${colors.reset}`);
    return null;
  }
  
  return null;
};

// Install Python dependencies with proper error handling
const installPythonDeps = async (pythonVersion) => {
  console.log(`${colors.yellow}Installing Python dependencies...${colors.reset}`);
  
  const pythonCmd = getPythonCommand();
  const backendDir = path.join(__dirname, 'python-backend');
  
  try {
    // First, ensure pip is up to date
    console.log(`${colors.yellow}Updating pip...${colors.reset}`);
    await execAsync(`${pythonCmd} -m pip install --upgrade pip`, { cwd: backendDir });
    
    // For Python 3.12+, install setuptools first
    if (pythonVersion.major === 3 && pythonVersion.minor >= 12) {
      console.log(`${colors.yellow}Installing setuptools for Python 3.12+...${colors.reset}`);
      await execAsync(`${pythonCmd} -m pip install --upgrade setuptools wheel`, { cwd: backendDir });
    }
    
    // Choose the right requirements file
    const requirementsFile = (pythonVersion.major === 3 && pythonVersion.minor < 12) 
      ? 'requirements-py311.txt' 
      : 'requirements.txt';
    
    // Install dependencies
    console.log(`${colors.yellow}Installing from ${requirementsFile}...${colors.reset}`);
    
    return new Promise((resolve, reject) => {
      const pip = spawn(pythonCmd, ['-m', 'pip', 'install', '-r', requirementsFile], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      
      pip.on('close', (code) => {
        if (code === 0) {
          console.log(`${colors.green}Python dependencies installed successfully${colors.reset}`);
          resolve();
        } else {
          reject(new Error('Failed to install Python dependencies'));
        }
      });
      
      pip.on('error', reject);
    });
    
  } catch (error) {
    console.error(`${colors.red}Error during dependency installation:${colors.reset}`, error.message);
    throw error;
  }
};

// Check if dependencies are already installed
const checkDependencies = async () => {
  const pythonCmd = getPythonCommand();
  
  try {
    // Try importing a key dependency
    const { stdout } = await execAsync(`${pythonCmd} -c "import fastapi; print('OK')"`);
    return stdout.trim() === 'OK';
  } catch (error) {
    return false;
  }
};

// Start Python backend
const startPythonBackend = () => {
  console.log(`${colors.yellow}Starting Python backend...${colors.reset}`);
  
  const pythonCmd = getPythonCommand();
  const pythonProcess = spawn(pythonCmd, [path.join('python-backend', 'server.py')], {
    stdio: 'inherit',
    env: { ...process.env, PYTHON_BACKEND_PORT: '8001' }
  });
  
  pythonProcess.on('error', (err) => {
    console.error(`${colors.red}Failed to start Python backend:${colors.reset}`, err);
  });
  
  pythonProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`${colors.red}Python backend exited with code ${code}${colors.reset}`);
    }
  });
  
  return pythonProcess;
};

// Start React app - FIXED for Windows
const startReactApp = () => {
  console.log(`${colors.yellow}Starting React application...${colors.reset}`);
  
  // On Windows, we need to use 'cmd' to run npm scripts
  let command;
  let args;
  
  if (process.platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'npm', 'start'];
  } else {
    command = 'npm';
    args = ['start'];
  }
  
  const reactProcess = spawn(command, args, {
    stdio: 'inherit',
    env: { 
      ...process.env, 
      REACT_APP_PYTHON_BACKEND_PORT: '8001',
      //BROWSER: 'none' // Prevent auto-opening browser
    },
    shell: false // Important for Windows
  });
  
  reactProcess.on('error', (err) => {
    console.error(`${colors.red}Failed to start React app:${colors.reset}`, err);
    console.error('Error details:', err.message);
  });
  
  reactProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`${colors.red}React app exited with code ${code}${colors.reset}`);
    }
  });
  
  return reactProcess;
};

// Alternative React start method using exec
const startReactAppAlternative = async () => {
  console.log(`${colors.yellow}Starting React application (alternative method)...${colors.reset}`);
  
  return new Promise((resolve) => {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    
    exec(`${command} start`, {
      env: { 
        ...process.env, 
        REACT_APP_PYTHON_BACKEND_PORT: '8001',
        BROWSER: 'none'
      }
    }, (error, stdout, stderr) => {
      if (error) {
        console.error(`${colors.red}Error starting React:${colors.reset}`, error);
        return;
      }
      if (stderr) {
        console.error(`${colors.yellow}React stderr:${colors.reset}`, stderr);
      }
      console.log(stdout);
    });
    
    // Return a dummy process object
    resolve({
      kill: () => console.log('Stopping React app...'),
      on: () => {}
    });
  });
};

// Main startup function
const main = async () => {
  let pythonProcess = null;
  let reactProcess = null;
  
  try {
    // Check Python version
    const pythonVersion = await checkPythonVersion();
    if (!pythonVersion) {
      console.error(`${colors.red}Please install Python 3.8 or higher from https://www.python.org/${colors.reset}`);
      process.exit(1);
    }
    
    // Check if dependencies are already installed
    const depsInstalled = await checkDependencies();
    
    if (!depsInstalled) {
      // Install Python dependencies
      const requirementsPath = path.join(__dirname, 'python-backend', 'requirements.txt');
      if (fs.existsSync(requirementsPath)) {
        await installPythonDeps(pythonVersion);
      }
    } else {
      console.log(`${colors.green}Python dependencies already installed${colors.reset}`);
    }
    
    // Start Python backend
    pythonProcess = startPythonBackend();
    
    // Wait for Python to start
    console.log(`${colors.yellow}Waiting for Python backend to initialize...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Start React app
    try {
      reactProcess = startReactApp();
    } catch (err) {
      console.warn(`${colors.yellow}Primary React start method failed, trying alternative...${colors.reset}`);
      reactProcess = await startReactAppAlternative();
    }
    
    console.log(`${colors.green}${colors.bright}Application started successfully!${colors.reset}`);
    console.log(`${colors.cyan}React app will open at: http://localhost:3000${colors.reset}`);
    console.log(`${colors.cyan}Python backend running at: http://localhost:8001${colors.reset}`);
    console.log(`${colors.yellow}Press Ctrl+C to stop both servers${colors.reset}`);
    
    // Handle cleanup
    const cleanup = () => {
      console.log(`\n${colors.yellow}Shutting down...${colors.reset}`);
      
      if (pythonProcess && typeof pythonProcess.kill === 'function') {
        pythonProcess.kill('SIGTERM');
      }
      
      if (reactProcess && typeof reactProcess.kill === 'function') {
        reactProcess.kill('SIGTERM');
      }
      
      // Force exit after a delay
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Handle unexpected exits
    process.on('exit', (code) => {
      if (code !== 0) {
        console.log(`${colors.red}Process exited with code ${code}${colors.reset}`);
      }
    });
    
  } catch (error) {
    console.error(`${colors.red}Startup error:${colors.reset}`, error.message);
    
    // Cleanup on error
    if (pythonProcess && typeof pythonProcess.kill === 'function') {
      pythonProcess.kill();
    }
    if (reactProcess && typeof reactProcess.kill === 'function') {
      reactProcess.kill();
    }
    
    process.exit(1);
  }
};

// Run the main function
main().catch(error => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
  process.exit(1);
});