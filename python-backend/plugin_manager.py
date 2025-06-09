import asyncio
import json
import os
import subprocess
import sys
import tempfile
import venv
from typing import Dict, Any, Optional, AsyncGenerator
import importlib.util
import logging
from pathlib import Path
import aiofiles
import base64
from functools import partial
import inspect

logger = logging.getLogger(__name__)

class PluginManager:
    def __init__(self):
        self.plugins: Dict[str, PluginInstance] = {}
        self.plugins_dir = Path("plugins")
        self.plugins_dir.mkdir(exist_ok=True)
        
    async def initialize(self):
        """Initialize the plugin manager"""
        logger.info("Plugin manager initialized")
        
    async def cleanup(self):
        """Clean up all plugins"""
        for plugin_id in list(self.plugins.keys()):
            await self.unload_plugin(plugin_id)
            
    async def load_plugin(self, plugin_id: str, python_code: str, requirements: list) -> Dict[str, Any]:
        """Load a plugin with its Python code"""
        try:
            # Create plugin directory
            plugin_dir = self.plugins_dir / plugin_id
            plugin_dir.mkdir(exist_ok=True)
            
            # Save Python code first
            main_file = plugin_dir / "main.py"
            async with aiofiles.open(main_file, 'w') as f:
                await f.write(python_code)
            
            # For now, skip virtual environment creation to simplify
            # Just install requirements globally if any
            if requirements:
                await self._install_requirements_global(requirements)
                
            # Create plugin instance
            plugin = PluginInstance(plugin_id, plugin_dir, None)
            await plugin.load()
            
            self.plugins[plugin_id] = plugin
            
            logger.info(f"Plugin {plugin_id} loaded successfully")
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Error loading plugin {plugin_id}: {e}")
            return {"success": False, "error": str(e)}
            
    async def _create_venv(self, venv_dir: Path):
        """Create virtual environment - FIXED"""
        loop = asyncio.get_event_loop()
        # Use partial to pass the arguments correctly
        create_venv_func = partial(venv.create, str(venv_dir), with_pip=True)
        await loop.run_in_executor(None, create_venv_func)
        
    async def _install_requirements_global(self, requirements: list):
        """Install requirements globally (simplified approach)"""
        if not requirements:
            return
            
        # Filter out empty lines and comments
        clean_requirements = [
            req.strip() for req in requirements 
            if req.strip() and not req.strip().startswith('#')
        ]
        
        if not clean_requirements:
            return
            
        logger.info(f"Installing requirements: {clean_requirements}")
        
        try:
            # Create a temporary requirements file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write('\n'.join(clean_requirements))
                req_file = f.name
            
            # Install using subprocess
            process = await asyncio.create_subprocess_exec(
                sys.executable, '-m', 'pip', 'install', '-r', req_file,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.warning(f"Failed to install some requirements: {stderr.decode()}")
            else:
                logger.info("Requirements installed successfully")
                
        except Exception as e:
            logger.warning(f"Error installing requirements: {e}")
        finally:
            # Clean up temp file
            try:
                os.unlink(req_file)
            except:
                pass
                
    async def _install_requirements(self, venv_dir: Path, requirements: list):
        """Install requirements in virtual environment"""
        pip_path = venv_dir / ("Scripts" if sys.platform == "win32" else "bin") / "pip"
        
        # Create temporary requirements file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write('\n'.join(requirements))
            req_file = f.name
            
        try:
            # Install requirements
            process = await asyncio.create_subprocess_exec(
                str(pip_path), 'install', '-r', req_file,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise Exception(f"Failed to install requirements: {stderr.decode()}")
                
        finally:
            os.unlink(req_file)
            
    async def execute_plugin_function(
        self, 
        plugin_id: str, 
        function_name: str, 
        args: list, 
        kwargs: dict
    ) -> Dict[str, Any]:
        """Execute a function in a plugin"""
        plugin = self.plugins.get(plugin_id)
        if not plugin:
            return {"error": f"Plugin {plugin_id} not loaded"}
            
        try:
            result = await plugin.execute_function(function_name, args, kwargs)
            return {"result": result}
        except Exception as e:
            logger.error(f"Error executing function {function_name} in plugin {plugin_id}: {e}")
            return {"error": str(e)}
            
    async def stream_plugin_function(
        self,
        plugin_id: str,
        stream_id: str,
        function_name: str,
        args: list,
        kwargs: dict
    ) -> AsyncGenerator[Any, None]:
        """Stream data from a plugin function"""
        plugin = self.plugins.get(plugin_id)
        if not plugin:
            raise Exception(f"Plugin {plugin_id} not loaded")
            
        async for data in plugin.stream_function(stream_id, function_name, args, kwargs):
            yield data
            
    async def stop_stream(self, plugin_id: str, stream_id: str):
        """Stop a streaming operation"""
        plugin = self.plugins.get(plugin_id)
        if plugin:
            await plugin.stop_stream(stream_id)
            
    async def unload_plugin(self, plugin_id: str):
        """Unload a plugin"""
        plugin = self.plugins.pop(plugin_id, None)
        if plugin:
            await plugin.unload()
            logger.info(f"Plugin {plugin_id} unloaded")
            
    async def stop_plugin(self, plugin_id: str):
        """Stop plugin execution"""
        plugin = self.plugins.get(plugin_id)
        if plugin:
            await plugin.stop()
            
    def get_loaded_plugins(self) -> list:
        """Get list of loaded plugins"""
        return list(self.plugins.keys())


class PluginInstance:
    """Represents a loaded plugin instance"""
    
    def __init__(self, plugin_id: str, plugin_dir: Path, venv_dir: Optional[Path]):
        self.plugin_id = plugin_id
        self.plugin_dir = plugin_dir
        self.venv_dir = venv_dir
        self.process: Optional[asyncio.subprocess.Process] = None
        self.module = None
        self.streams: Dict[str, asyncio.Task] = {}
        
    async def load(self):
        """Load the plugin module"""
        # Add the plugin directory to Python path temporarily
        sys.path.insert(0, str(self.plugin_dir))
        
        try:
            # Import the plugin module
            spec = importlib.util.spec_from_file_location(
                f"plugin_{self.plugin_id}",
                self.plugin_dir / "main.py"
            )
            self.module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(self.module)
            
            # Initialize plugin if it has an init function
            if hasattr(self.module, 'initialize'):
                result = await self._run_in_executor(self.module.initialize)
                logger.info(f"Plugin {self.plugin_id} initialization result: {result}")
        finally:
            # Remove from path
            sys.path.remove(str(self.plugin_dir))
            
    async def execute_function(self, function_name: str, args: list, kwargs: dict) -> Any:
        """Execute a function in the plugin"""
        if not hasattr(self.module, function_name):
            raise Exception(f"Function {function_name} not found in plugin")
            
        func = getattr(self.module, function_name)
        
        # Check if it's an async function
        if asyncio.iscoroutinefunction(func):
            return await func(*args, **kwargs)
        else:
            # Run in executor to avoid blocking
            return await self._run_in_executor(func, *args, **kwargs)
        
    async def stream_function(
        self, 
        stream_id: str, 
        function_name: str, 
        args: list, 
        kwargs: dict
    ) -> AsyncGenerator[Any, None]:
        """Stream data from a plugin function"""
        if not hasattr(self.module, function_name):
            raise Exception(f"Function {function_name} not found in plugin")
            
        func = getattr(self.module, function_name)
        
        # Create a queue for streaming data
        queue = asyncio.Queue()
        
        # Start the streaming task
        task = asyncio.create_task(
            self._run_streaming_function(queue, func, args, kwargs)
        )
        self.streams[stream_id] = task
        
        try:
            while True:
                # Get data from queue with timeout
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=10.0)
                except asyncio.TimeoutError:
                    logger.warning(f"Stream {stream_id} timeout waiting for data")
                    break
                
                # Check for end of stream
                if data is None:
                    break
                    
                yield data
                
        finally:
            # Clean up
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            self.streams.pop(stream_id, None)
            
    async def _run_streaming_function(self, queue: asyncio.Queue, func, args, kwargs):
        """Run a streaming function and put results in queue"""
        try:
            # Check if the function is an async generator function
            if inspect.isasyncgenfunction(func):
                # It's an async generator function (async def with yield)
                async for data in func(*args, **kwargs):
                    await queue.put(data)
            elif inspect.isgeneratorfunction(func):
                # It's a regular generator function (def with yield)
                for data in func(*args, **kwargs):
                    await queue.put(data)
            elif asyncio.iscoroutinefunction(func):
                # It's an async function that might return a generator
                result = await func(*args, **kwargs)
                
                if hasattr(result, '__aiter__'):
                    # It returned an async generator
                    async for data in result:
                        await queue.put(data)
                elif hasattr(result, '__iter__'):
                    # It returned a regular generator
                    for data in result:
                        await queue.put(data)
                else:
                    raise Exception(f"Async function {func.__name__} did not return a generator")
            else:
                # It's a regular function that might return a generator
                result = func(*args, **kwargs)
                
                if hasattr(result, '__iter__'):
                    # It's a regular generator
                    for data in result:
                        await queue.put(data)
                else:
                    raise Exception(f"Function {func.__name__} did not return a generator")
                    
        except Exception as e:
            logger.error(f"Error in streaming function: {e}")
            raise
        finally:
            await queue.put(None)  # Signal end of stream
            
    async def stop_stream(self, stream_id: str):
        """Stop a specific stream"""
        task = self.streams.pop(stream_id, None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            
    async def stop(self):
        """Stop all plugin operations"""
        # Cancel all streams
        for task in self.streams.values():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        self.streams.clear()
        
    async def unload(self):
        """Unload the plugin"""
        await self.stop()
        
        # Run cleanup if available
        if self.module and hasattr(self.module, 'cleanup'):
            await self._run_in_executor(self.module.cleanup)
            
    async def _run_in_executor(self, func, *args, **kwargs):
        """Run a function in executor to avoid blocking"""
        loop = asyncio.get_event_loop()
        # Use partial to handle functions with arguments
        if args or kwargs:
            func_with_args = partial(func, *args, **kwargs)
            return await loop.run_in_executor(None, func_with_args)
        else:
            return await loop.run_in_executor(None, func)