/**
 * Remote Control Script for Bitburner
 * This script allows remote control of your Bitburner instance through a REST API.
 **/
export async function main(ns) {
    if (!ns.args[0]) {
        ns.tprint('ERROR: Password required. Usage: run remote-control.js YOUR_PASSWORD');
        return;
    }

    const userPassword = ns.args[0];
    
    // API configuration - modify baseUrl if hosting the API elsewhere
    const API_CONFIG = {
        baseUrl: "https://bitburner-remote-api.onrender.com/",
        endpoints: {
            commands: "commands",
            results: "results"
        },
        pollingInterval: 1000, // Time between API checks in milliseconds
        password: userPassword
    };

    // Available command handlers
    const commandHandlers = {
        'ps': executePs,      // List running processes
        'ls': executeLs,      // List files
        'stats': executeStats, // Show player stats
    };

    // Main control loop
    while (true) {
        try {
            await processCommand(ns, API_CONFIG, commandHandlers);
        } catch (error) {
            ns.print(`Error in main loop: ${error}`);
        }
        await ns.sleep(API_CONFIG.pollingInterval);
    }
}

/**
 * Process incoming commands from the API
 */
async function processCommand(ns, config, handlers) {
    const commandUrl = config.baseUrl + config.endpoints.commands;
    const resultUrl = config.baseUrl + config.endpoints.results;

    const response = await fetch(commandUrl, {
        headers: {
            'password': config.password
        }
    });
    
    const { command, id: commandId, server_name = 'home', threads = 1, args = [] } = await response.json();

    if (!command) return;

    try {
        let result;
        if (handlers[command]) {
            result = await handlers[command](ns, server_name);
        } else {
            result = await executeUnknownCommand(ns, command, server_name, threads, args);
        }
        
        await fetch(resultUrl, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "password": config.password 
            },
            body: JSON.stringify({ id: commandId, result, isHtml: true })
        });
    } catch (error) {
        ns.print(`Error executing command ${command}: ${error}`);
    }
}

// Matrix-style UI configuration for command outputs
const MatrixUI = {
    styles: {
        base: `
            body {
                background-color: black;
                color: #00FF00;
                font-family: 'Courier New', Courier, monospace;
                padding: 20px 20px 20px 0;
                line-height: 1.5;
            }
            h2 {
                color: #00FF00;
                text-align: center;
                margin-bottom: 20px;
            }
            pre {
                margin: 0;
                padding: 0;
                white-space: pre;
                overflow-x: auto;
            }
            ul {
                list-style-type: none;
                padding: 0;
                margin: 0;
            }
            li {
                margin-bottom: 15px;
            }
            .file-exe { color: #00FFFF; }
            .file-cct { color: #FF00FF; }
            .file-txt, .file-lit { color: #00FF00; }
            .file-js { color: #FFFF00; }
            .stat-label { color: #00FFFF; }
            .stat-value { color: #00FF00; }
        `,
    },

    wrap: (title, content) => `
        <html>
        <head>
            <title>${title}</title>
            <style>${MatrixUI.styles.base}</style>
        </head>
        <body>
            <h2>${title}</h2>
            ${content}
        </body>
        </html>
    `,

    formatStat: (label, value) => `
        <li><span class="stat-label">${label}:</span> <span class="stat-value">${value}</span></li>
    `,

    getFileClass: (filename) => {
        const ext = filename.split('.').pop();
        return `file-${ext}`;
    }
};

/**
 * Execute a command that isn't handled by a specific handler
 */
async function executeUnknownCommand(ns, command, serverName, threads = 1, args = []) {
    try {
        const execPid = ns.exec(command, serverName, threads, ...args);
        const resultMessage = execPid === 0 
            ? `Failed to execute command: ${command} on ${serverName}`
            : `Executed ${command} with PID ${execPid} on ${serverName}`;

        return MatrixUI.wrap(command, `<pre>${resultMessage}</pre>`);
    } catch (error) {
        return MatrixUI.wrap(command, `<pre>Error executing command: ${error}</pre>`);
    }
}

/**
 * Display player statistics
 */
function executeStats(ns) {
    const player = ns.getPlayer();
    const stats = [
        ['Money', `$${ns.formatNumber(ns.getServerMoneyAvailable("home"))}`],
        ['Hacking Level', ns.getHackingLevel()],
        ['Hacking XP', ns.formatNumber(player.exp.hacking)],
        ['Script Income', `$${ns.formatNumber(ns.getTotalScriptIncome()[0])} / sec`],
        ['Script XP', `${ns.getTotalScriptExpGain().toFixed(2)} / sec`],
        ['Hacknet Production', ns.formatPercent(ns.getHacknetMultipliers().production)],
        ['Hacking Speed', ns.formatPercent(ns.getHackingMultipliers().speed)],
        ['Hacking Chance', ns.formatPercent(ns.getHackingMultipliers().chance)],
        ['Factions', player.factions.join(", ")],
        ['Jobs', Object.entries(player.jobs).map(([company, job]) => `${company}: ${job}`).join(", ")],
        ['Location', player.location],
        ['Total Playtime', ns.tFormat(player.totalPlaytime)]
    ];

    const content = `<ul>${stats.map(([label, value]) => MatrixUI.formatStat(label, value)).join('')}</ul>`;
    return MatrixUI.wrap("Player Stats", content);
}

/**
 * List running processes on a server
 */
function executePs(ns, serverName) {
    const processes = ns.ps(serverName);
    const content = `<ul>${processes.map(process => 
        `<li>${process.filename} (PID: ${process.pid}, Threads: ${process.threads})</li>`
    ).join('')}</ul>`;
    
    return MatrixUI.wrap("Process List", content);
}

/**
 * List files on a server
 */
function executeLs(ns, serverName) {
    const files = ns.ls(serverName);
    const content = `<ul>${files.map(file => 
        `<li class="${MatrixUI.getFileClass(file)}">${file}</li>`
    ).join('')}</ul>`;

    return MatrixUI.wrap(`Files on ${serverName}`, content);
}
