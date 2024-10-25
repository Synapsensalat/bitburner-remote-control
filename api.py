from fastapi import FastAPI, HTTPException, Response, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Union, Dict
import uuid
import asyncio
import os
from datetime import datetime, timedelta

app = FastAPI()

# Add CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://bitburner-official.github.io",  # Browser version
        "http://localhost:8000",          # Local development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Store commands and results per user
user_commands: Dict[str, list] = {}
user_results: Dict[str, dict] = {}
last_activity: Dict[str, datetime] = {}
passwordless_commands = []
passwordless_results = {}

# Get admin password from environment variable
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD')
if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD environment variable is not set")

class Command(BaseModel):
    command: str
    server_name: Optional[str] = None
    threads: Optional[int] = 1
    args: Optional[List[Union[str, int, float, bool]]] = []
    password: Optional[str] = None  # Make password optional

async def cleanup_inactive_users():
    while True:
        current_time = datetime.now()
        inactive_threshold = current_time - timedelta(hours=1)
        
        inactive_users = [
            password for password, last_time in last_activity.items()
            if last_time < inactive_threshold
        ]
        
        for password in inactive_users:
            user_commands.pop(password, None)
            user_results.pop(password, None)
            last_activity.pop(password, None)
        
        await asyncio.sleep(3600)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_inactive_users())

@app.get("/")
async def home():
    return {"message": "Welcome to the Hybrid Bitburner FastAPI!"}

@app.post("/run-command")
async def run_command(command: Command):
    command_id = str(uuid.uuid4())
    
    # Handle passwordless commands (your Android app)
    if not command.password:
        command_data = {
            "id": command_id,
            "command": command.command,
            "threads": command.threads,
            "args": command.args,
        }
        if command.server_name:
            command_data["server_name"] = command.server_name
        
        passwordless_commands.append(command_data)
        
        result_data = await wait_for_result(command_id, None)
        if result_data:
            result = result_data["result"]
            is_html = result_data.get("isHtml", False)
            if is_html:
                return Response(content=result, media_type="text/html")
            return {"status": "success", "result": result}
    
    # Handle password-protected commands (other users)
    else:
        password = command.password
        if password not in user_commands:
            user_commands[password] = []
            user_results[password] = {}
        
        last_activity[password] = datetime.now()
        
        command_data = {
            "id": command_id,
            "command": command.command,
            "threads": command.threads,
            "args": command.args,
        }
        if command.server_name:
            command_data["server_name"] = command.server_name
        
        user_commands[password].append(command_data)
        
        result_data = await wait_for_result(command_id, password)
        if result_data:
            result = result_data["result"]
            is_html = result_data.get("isHtml", False)
            if is_html:
                return Response(content=result, media_type="text/html")
            return {"status": "success", "result": result}
    
    raise HTTPException(status_code=408, detail="Command execution took too long")

@app.get("/commands")
async def get_next_command(password: str = Header(...)):
    # Your Bitburner script with admin password gets passwordless commands
    if password == ADMIN_PASSWORD:
        if passwordless_commands:
            return passwordless_commands.pop(0)
        return {"command": None}
    
    # Other users get their password-specific commands
    last_activity[password] = datetime.now()
    
    if password not in user_commands:
        user_commands[password] = []
    
    if user_commands[password]:
        return user_commands[password].pop(0)
    
    return {"command": None}

@app.post("/results")
async def post_result(result_data: dict, password: str = Header(...)):
    command_id = result_data["id"]
    result = result_data["result"]
    is_html = result_data.get("isHtml", False)
    
    # Results from your Bitburner script (admin password) go to passwordless results
    if password == ADMIN_PASSWORD:
        passwordless_results[command_id] = {"result": result, "isHtml": is_html}
    else:
        # Results from other users go to their specific results
        if password not in user_results:
            user_results[password] = {}
        
        last_activity[password] = datetime.now()
        user_results[password][command_id] = {"result": result, "isHtml": is_html}
    
    return {"status": "success", "message": "Result received"}

async def wait_for_result(command_id: str, password: str | None, timeout: int = 30):
    waited = 0
    while waited < timeout:
        # Check passwordless results if no password provided
        if password is None:
            if command_id in passwordless_results:
                return passwordless_results.pop(command_id)
        # Check user-specific results if password provided
        elif password in user_results and command_id in user_results[password]:
            return user_results[password].pop(command_id)
        
        await asyncio.sleep(1)
        waited += 1
    return None
