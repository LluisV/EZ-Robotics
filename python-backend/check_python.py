import sys
import subprocess
import os

def check_python_version():
    """Check if Python version is compatible"""
    version = sys.version_info
    print(f"Python version: {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("ERROR: Python 3.8 or higher is required")
        return False
    
    if version.major == 3 and version.minor >= 12:
        print("Python 3.12+ detected. Installing setuptools first...")
        # For Python 3.12+, we need to ensure setuptools is installed
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "setuptools", "wheel"])
        except subprocess.CalledProcessError:
            print("ERROR: Failed to install setuptools")
            return False
    
    return True

if __name__ == "__main__":
    if check_python_version():
        sys.exit(0)
    else:
        sys.exit(1)