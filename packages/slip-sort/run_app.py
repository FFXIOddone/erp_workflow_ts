#!/usr/bin/env python3
"""
Packing Slip Manager - Desktop Application Wrapper
Uses PyWebView to run the app as a native desktop window
"""

import os
import sys
import threading
import time
import webview
import uvicorn
from pathlib import Path

# Add backend to path
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Configuration
APP_TITLE = "Packing Slip Manager"
WINDOW_WIDTH = 1400
WINDOW_HEIGHT = 900
API_HOST = "127.0.0.1"
API_PORT = 8000
DEV_MODE = os.environ.get("DEV_MODE", "0") == "1"


def start_api_server():
    """Start the FastAPI backend server in a separate thread."""
    os.chdir(BACKEND_DIR)
    uvicorn.run(
        "main:app",
        host=API_HOST,
        port=API_PORT,
        log_level="warning",
        reload=False
    )


def wait_for_server(host: str, port: int, timeout: float = 10.0) -> bool:
    """Wait for the API server to be ready."""
    import socket
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex((host, port))
            sock.close()
            if result == 0:
                return True
        except Exception:
            pass
        time.sleep(0.2)
    
    return False


def main():
    """Main entry point."""
    print(f"Starting {APP_TITLE}...")
    
    # Start API server in background thread
    api_thread = threading.Thread(target=start_api_server, daemon=True)
    api_thread.start()
    
    # Wait for server to be ready
    print("Waiting for API server...")
    if not wait_for_server(API_HOST, API_PORT):
        print("ERROR: API server failed to start")
        sys.exit(1)
    
    print("API server ready!")
    
    # Determine URL based on mode
    if DEV_MODE:
        # In dev mode, connect to Vite dev server
        url = "http://localhost:5185"
    else:
        # In production, serve from API server's static files
        url = f"http://{API_HOST}:{API_PORT}"
    
    # Create and run the window
    window = webview.create_window(
        APP_TITLE,
        url,
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        resizable=True,
        min_size=(1024, 700),
        text_select=True
    )
    
    # Start the GUI event loop (blocks until window is closed)
    webview.start(debug=DEV_MODE)
    
    print("Application closed.")


if __name__ == "__main__":
    main()
