import asyncio
import json
import logging
import os
import sys
from typing import Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from plugin_manager import PluginManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="FluidNC Plugin Python Backend")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Plugin manager instance
plugin_manager = PluginManager()

# Store active WebSocket connections per plugin
connections: Dict[str, WebSocket] = {}

@app.on_event("startup")
async def startup_event():
    """Initialize the plugin manager on startup"""
    logger.info("Starting FluidNC Plugin Python Backend")
    await plugin_manager.initialize()

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    logger.info("Shutting down FluidNC Plugin Python Backend")
    await plugin_manager.cleanup()

@app.websocket("/ws/{plugin_id}")
async def websocket_endpoint(websocket: WebSocket, plugin_id: str):
    """WebSocket endpoint for plugin communication"""
    await websocket.accept()
    connections[plugin_id] = websocket
    logger.info(f"Plugin {plugin_id} connected via WebSocket")
    
    try:
        while True:
            # Receive message from web client
            data = await websocket.receive_json()
            
            # Process the message
            response = await handle_plugin_message(plugin_id, data)
            
            # Send response back
            if response:
                await websocket.send_json(response)
                
    except WebSocketDisconnect:
        logger.info(f"Plugin {plugin_id} disconnected")
        connections.pop(plugin_id, None)
        await plugin_manager.stop_plugin(plugin_id)
    except Exception as e:
        logger.error(f"Error in WebSocket connection for plugin {plugin_id}: {e}")
        connections.pop(plugin_id, None)

async def handle_plugin_message(plugin_id: str, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Handle messages from plugin web clients"""
    msg_type = message.get("type")
    msg_id = message.get("id")
    
    try:
        if msg_type == "load":
            # Load plugin Python code
            result = await plugin_manager.load_plugin(
                plugin_id, 
                message.get("pythonCode"),
                message.get("requirements", [])
            )
            return {
                "id": msg_id,
                "type": "load_response",
                "success": result["success"],
                "error": result.get("error")
            }
            
        elif msg_type == "execute":
            # Execute plugin function
            result = await plugin_manager.execute_plugin_function(
                plugin_id,
                message.get("function"),
                message.get("args", []),
                message.get("kwargs", {})
            )
            return {
                "id": msg_id,
                "type": "execute_response",
                "result": result.get("result"),
                "error": result.get("error")
            }
            
        elif msg_type == "stream_start":
            # Start a streaming operation
            stream_id = message.get("streamId")
            function = message.get("function")
            args = message.get("args", [])
            kwargs = message.get("kwargs", {})
            
            # Start streaming in background
            asyncio.create_task(
                handle_stream(plugin_id, stream_id, function, args, kwargs)
            )
            
            return {
                "id": msg_id,
                "type": "stream_start_response",
                "streamId": stream_id,
                "success": True
            }
            
        elif msg_type == "stream_stop":
            # Stop a streaming operation
            stream_id = message.get("streamId")
            await plugin_manager.stop_stream(plugin_id, stream_id)
            return {
                "id": msg_id,
                "type": "stream_stop_response",
                "streamId": stream_id,
                "success": True
            }
            
        elif msg_type == "unload":
            # Unload plugin
            await plugin_manager.unload_plugin(plugin_id)
            return {
                "id": msg_id,
                "type": "unload_response",
                "success": True
            }
            
    except Exception as e:
        logger.error(f"Error handling message for plugin {plugin_id}: {e}")
        return {
            "id": msg_id,
            "type": "error",
            "error": str(e)
        }

async def handle_stream(plugin_id: str, stream_id: str, function: str, args: list, kwargs: dict):
    """Handle streaming operations"""
    websocket = connections.get(plugin_id)
    if not websocket:
        return
        
    try:
        async for data in plugin_manager.stream_plugin_function(
            plugin_id, stream_id, function, args, kwargs
        ):
            if plugin_id not in connections:
                break
                
            await websocket.send_json({
                "type": "stream_data",
                "streamId": stream_id,
                "data": data
            })
    except Exception as e:
        logger.error(f"Error in stream {stream_id} for plugin {plugin_id}: {e}")
        if websocket and plugin_id in connections:
            await websocket.send_json({
                "type": "stream_error",
                "streamId": stream_id,
                "error": str(e)
            })

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "plugins": plugin_manager.get_loaded_plugins()}

if __name__ == "__main__":
    port = int(os.getenv("PYTHON_BACKEND_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)