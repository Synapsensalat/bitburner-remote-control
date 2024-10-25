# Bitburner Remote Control
Control your Bitburner instance through a REST API from your phone.

## Features
- Remote command execution in Bitburner
- Terminal-themed response
- Basic commands: ps, ls, stats, any .js script as command works as well
- Custom command support
- Android control via [HTTP Shortcuts](https://github.com/Waboodoo/HTTP-Shortcuts)

## Quick Start
### 1. In Bitburner
Copy `remote-control.js` to your home server and run:
```bash
run remote-control.js your-password
```

### 2. On Android
Install [HTTP Shortcuts](https://github.com/Waboodoo/HTTP-Shortcuts) and import:
```bash
curl -X POST "https://bitburner-remote-api.onrender.com/run-command" \
     -H "Content-Type: application/json" \
     -d '{
           "command": "stats",
           "server_name": "home",
           "threads": 1,
           "args": [],
           "password": "your-password"
         }'
```
The public API is available at `https://bitburner-remote-api.onrender.com`

## Commands
### Built-in Commands
- `ps`: List running processes
- `ls`: List files
- `stats`: Show player stats

Any `.js` script can be executed by using its name as the command, returning success or failure:
```json
{"command": "basic-hack.js", "password": "your-password", "server_name": "home", "threads": 42, "args": ["n00dles"]}
```

### Request Format
```json
{
    "command": "string",      // Required: Command name
    "password": "string",     // Required: Your password
    "server_name": "string",  // Optional: Target server
    "threads": number,        // Optional: Thread count
    "args": array            // Optional: Command arguments
}
```

### Examples
```json
{"command": "ls", "server_name": "home", "password": "your-password"}
{"command": "stats", "password": "your-password"}
```

## Adding Custom Commands
### In Bitburner
```javascript
const commandHandlers = {
    'mycommand': executeMyCommand,
};
function executeMyCommand(ns, serverName) {
    return MatrixUI.wrap("Title", `<pre>output</pre>`);
}
```

### In HTTP Shortcuts
1. Duplicate existing shortcut
2. Change command and parameters
```json
{
    "command": "mycommand",
    "args": ["arg1", "arg2"],
    "password": "your-password"
}
```

## Self-Hosting
### Requirements
- Python 3.8+
- FastAPI
- uvicorn

### Setup
1. Clone repository
2. Create environment variable: `ADMIN_PASSWORD` (Enables running commands without a password, if the password in Bitburner matches it)
3. Install dependencies: `pip install -r requirements.txt`
4. Run: `uvicorn api:app --host 0.0.0.0 --port 8000`

### Deploy to Render
1. Fork this repository
2. Create a new Web Service on Render
3. Link your repository
4. Add environment variable: `ADMIN_PASSWORD`
5. Deploy

## Security Notes
1. Passwords are sent as plain text - self-host if you need security
2. Use unique password (it's just to identify users - **don't reuse**)
3. Inactive users cleaned up after 1 hour
4. Public API is on free tier - may have downtime
