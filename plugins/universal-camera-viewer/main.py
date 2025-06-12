import cv2
import base64
import asyncio
import time
import requests
import gc
from typing import Dict, Any, Optional, List
import numpy as np
import platform

class UniversalCameraStream:
    def __init__(self):
        self.cap = None
        self.streaming = False
        self.camera_url = None
        self.frame_count = 0
        self.camera_type = None
        self.camera_settings = {}
        
    def get_available_devices(self) -> List[Dict[str, Any]]:
        """Get list of available USB camera devices"""
        devices = []
        
        # Test USB devices 0-9
        for i in range(10):
            cap = cv2.VideoCapture(i)
            if cap.isOpened():
                # Try to read a frame to confirm it works
                ret, frame = cap.read()
                if ret and frame is not None:
                    # Get device info if available
                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    
                    device_info = {
                        'index': i,
                        'name': f'Camera {i}',
                        'resolution': f'{width}x{height}',
                        'available': True
                    }
                    devices.append(device_info)
                cap.release()
        
        return devices
    
    def initialize_camera(self, settings: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize camera connection based on type"""
        try:
            # Clean up any existing camera connection
            if self.cap:
                self.cap.release()
                self.cap = None
                
            self.camera_settings = settings
            self.camera_type = settings.get('type', 'rtsp')
            self.frame_count = 0
            
            if self.camera_type == 'rtsp':
                return self._initialize_rtsp_camera(settings)
            elif self.camera_type == 'usb':
                return self._initialize_usb_camera(settings)
            elif self.camera_type == 'mjpeg':
                return self._initialize_mjpeg_camera(settings)
            elif self.camera_type == 'http':
                return self._initialize_http_camera(settings)
            else:
                return {"success": False, "error": f"Unsupported camera type: {self.camera_type}"}
                
        except Exception as e:
            return {"success": False, "error": f"Camera initialization error: {str(e)}"}
    
    def _initialize_rtsp_camera(self, settings: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize RTSP camera (IP cameras, Tapo, etc.)"""
        ip = settings.get('ip', '')
        port = settings.get('port', '554')
        username = settings.get('username', 'admin')
        password = settings.get('password', '')
        
        if not ip:
            return {"success": False, "error": "IP address is required for RTSP cameras"}
        
        # Common RTSP URL patterns
        rtsp_urls = [
            f"rtsp://{username}:{password}@{ip}:{port}/stream1",
            f"rtsp://{username}:{password}@{ip}:{port}/stream2",
            f"rtsp://{username}:{password}@{ip}/stream1",
            f"rtsp://{username}:{password}@{ip}/stream2",
            f"rtsp://{username}:{password}@{ip}:{port}/h264",
            f"rtsp://{username}:{password}@{ip}:{port}/live",
            f"rtsp://{username}:{password}@{ip}:{port}/video.mp4"
        ]
        
        return self._test_urls(rtsp_urls, f"RTSP camera at {ip}", password)
    
    def _initialize_usb_camera(self, settings: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize USB camera"""
        device_index = settings.get('usbDevice', 0)
        
        try:
            cap = cv2.VideoCapture(device_index)
            
            if not cap.isOpened():
                return {"success": False, "error": f"Could not open USB camera at index {device_index}"}
            
            # Set buffer size to reduce latency
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            # Set resolution if specified
            resolution = settings.get('resolution', 'auto')
            if resolution != 'auto':
                width, height = map(int, resolution.split('x'))
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
            
            # Test frame capture
            ret, frame = cap.read()
            if not ret or frame is None:
                cap.release()
                return {"success": False, "error": "USB camera opened but cannot capture frames"}
            
            self.cap = cap
            self.camera_url = f"USB Device {device_index}"
            
            # Get actual resolution
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            
            return {
                "success": True,
                "resolution": f"{width}x{height}",
                "fps": fps,
                "device": f"USB Device {device_index}"
            }
            
        except Exception as e:
            return {"success": False, "error": f"USB camera error: {str(e)}"}
    
    def _initialize_mjpeg_camera(self, settings: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize MJPEG stream camera"""
        ip = settings.get('ip', '')
        port = settings.get('port', '8080')
        
        if not ip:
            return {"success": False, "error": "IP address is required for MJPEG cameras"}
        
        # Common MJPEG URL patterns
        mjpeg_urls = [
            f"http://{ip}:{port}/video.mjpg",
            f"http://{ip}:{port}/mjpg/video.mjpg",
            f"http://{ip}:{port}/video.cgi",
            f"http://{ip}:{port}/mjpeg",
            f"http://{ip}:{port}/video",
            f"http://{ip}:{port}/stream.mjpg"
        ]
        
        return self._test_urls(mjpeg_urls, f"MJPEG camera at {ip}")
    
    def _initialize_http_camera(self, settings: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize HTTP camera with custom URL"""
        custom_url = settings.get('customUrl', '')
        
        if not custom_url:
            return {"success": False, "error": "Custom URL is required for HTTP cameras"}
        
        return self._test_urls([custom_url], "HTTP camera")
    
    def _test_urls(self, urls: List[str], camera_description: str, password_to_hide: str = None) -> Dict[str, Any]:
        """Test multiple URLs and return success with the first working one"""
        for url in urls:
            try:
                print(f"Testing {camera_description}: {url.replace(password_to_hide, '***') if password_to_hide else url}")
                
                cap = cv2.VideoCapture(url)
                
                # Set timeouts
                cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
                cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                
                # Set resolution if specified
                resolution = self.camera_settings.get('resolution', 'auto')
                if resolution != 'auto':
                    width, height = map(int, resolution.split('x'))
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
                
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        self.cap = cap
                        self.camera_url = url
                        
                        # Get camera properties
                        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        fps = cap.get(cv2.CAP_PROP_FPS)
                        
                        print(f"Successfully connected to {camera_description}")
                        
                        # Clean up the test frame
                        del frame
                        
                        return {
                            "success": True,
                            "resolution": f"{width}x{height}",
                            "fps": fps,
                            "url": url.replace(password_to_hide, '***') if password_to_hide else url
                        }
                    else:
                        cap.release()
                else:
                    cap.release()
                    
            except Exception as e:
                print(f"Error testing {url}: {e}")
                continue
        
        return {"success": False, "error": f"Failed to connect to {camera_description} with any URL"}
    
    def capture_frame(self) -> Optional[str]:
        """Capture a single frame and return as base64 encoded JPEG"""
        if not self.cap or not self.cap.isOpened():
            return None
            
        try:
            ret, frame = self.cap.read()
            
            if not ret or frame is None:
                return None
            
            self.frame_count += 1
            
            # Resize frame if too large (for performance)
            height, width = frame.shape[:2]
            max_width = 1280  # Configurable max width
            
            if width > max_width:
                scale = max_width / width
                new_width = int(width * scale)
                new_height = int(height * scale)
                frame = cv2.resize(frame, (new_width, new_height))
            
            # Encode frame as JPEG with lower quality for better performance
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 75]
            _, buffer = cv2.imencode('.jpg', frame, encode_param)
            
            # Convert to base64
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            
            # Explicitly delete the frame and buffer immediately
            del frame
            del buffer
            
            # Force immediate garbage collection every 50 frames
            if self.frame_count % 50 == 0:
                gc.collect()
            
            return frame_base64
            
        except Exception as e:
            print(f"Error capturing frame: {e}")
            return None
    
    def stop_camera(self):
        """Stop camera and release resources"""
        self.streaming = False
        
        if self.cap:
            self.cap.release()
            self.cap = None
        
        self.camera_url = None
        self.camera_type = None
        self.frame_count = 0
        
        # Force garbage collection
        gc.collect()
        
        print("Camera stopped and resources released")

# Global camera instance
camera = UniversalCameraStream()

def initialize():
    """Called when plugin is loaded"""
    print("Universal Camera Viewer plugin initialized")
    return {"status": "ready"}

def get_available_devices() -> Dict[str, Any]:
    """Get list of available USB camera devices"""
    try:
        devices = camera.get_available_devices()
        return {"devices": devices}
    except Exception as e:
        return {"devices": [], "error": str(e)}

def initialize_camera(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Initialize camera connection"""
    return camera.initialize_camera(settings)

def stop_camera() -> Dict[str, Any]:
    """Stop camera streaming"""
    camera.stop_camera()
    return {"success": True}

async def stream_frames(refresh_rate: int = 500):
    """Async generator for streaming camera frames"""
    camera.streaming = True
    
    # Convert refresh rate from milliseconds to seconds
    delay = max(refresh_rate / 1000.0, 0.01)  # Minimum 10ms
    
    consecutive_failures = 0
    max_failures = 5
    last_frame_time = 0
    gc_counter = 0
    
    try:
        while camera.streaming:
            current_time = time.time()
            
            # Enforce frame rate limiting
            time_since_last = current_time - last_frame_time
            if time_since_last < delay:
                await asyncio.sleep(delay - time_since_last)
                continue
            
            frame_data = camera.capture_frame()
            
            if frame_data:
                consecutive_failures = 0  # Reset failure counter
                last_frame_time = current_time
                gc_counter += 1
                
                yield {
                    "frame": frame_data,
                    "timestamp": current_time,
                    "frame_count": camera.frame_count,
                    "camera_type": camera.camera_type
                }
                
                # Clear frame_data reference immediately
                frame_data = None
                
                # More aggressive garbage collection
                if gc_counter % 30 == 0:
                    gc.collect(0)  # Collect only generation 0 (fastest)
                    gc_counter = 0
                    
                # Full collection less frequently
                if camera.frame_count % 200 == 0:
                    gc.collect()  # Full collection
                    
            else:
                consecutive_failures += 1
                yield {
                    "error": f"Failed to capture frame (attempt {consecutive_failures})",
                    "timestamp": current_time
                }
                
                # If too many consecutive failures, stop streaming
                if consecutive_failures >= max_failures:
                    yield {
                        "error": f"Too many consecutive failures ({max_failures}), stopping stream",
                        "timestamp": current_time
                    }
                    break
                
                # Wait longer on error
                await asyncio.sleep(min(delay * 2, 2.0))
                continue
            
            # Minimal sleep to yield control
            await asyncio.sleep(0.001)
            
    except Exception as e:
        print(f"Streaming error: {e}")
        yield {
            "error": f"Streaming error: {str(e)}",
            "timestamp": time.time()
        }
    finally:
        camera.streaming = False
        # Force full cleanup
        gc.collect()
        print("Frame streaming stopped")

def get_camera_status() -> Dict[str, Any]:
    """Get current camera status"""
    return {
        "connected": camera.cap is not None and camera.cap.isOpened(),
        "streaming": camera.streaming,
        "frame_count": camera.frame_count,
        "camera_type": camera.camera_type,
        "camera_url": camera.camera_url.replace(camera.camera_settings.get('password', ''), '***') if camera.camera_url else None
    }

def cleanup():
    """Called when plugin is unloaded"""
    camera.stop_camera()
    gc.collect()
    print("Universal Camera Viewer plugin cleaned up")
    return {"status": "cleaned"}