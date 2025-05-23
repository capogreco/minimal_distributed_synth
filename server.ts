// minimal deno server with websocket signaling and kv message queuing

const kv = await Deno.openKv ()
const connections = new Map ()

// load env variables
const TWILIO_ACCOUNT_SID = Deno.env.get ("TWILIO_ACCOUNT_SID")
const TWILIO_AUTH_TOKEN = Deno.env.get ("TWILIO_AUTH_TOKEN")

// get TURN credentials from Twilio
async function get_turn_credentials () {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        return null
    }
    
    try {
        const auth = btoa (`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
        const response = await fetch (
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Tokens.json`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Basic ${auth}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        )
        
        if (!response.ok) {
            console.error (`Twilio error: ${response.status}`)
            return null
        }
        
        const data = await response.json ()
        return data.ice_servers
    } catch (error) {
        console.error (`Error fetching TURN credentials: ${error}`)
        return null
    }
}

// serve static files and handle websocket upgrade
async function handle_request (request) {
    const url = new URL (request.url)
    
    // websocket upgrade
    if (request.headers.get ("upgrade") === "websocket") {
        const { socket, response } = Deno.upgradeWebSocket (request)
        const temp_id = crypto.randomUUID ()
        let client_id = temp_id
        
        socket.addEventListener ("open", () => {
            console.log (`client connected: ${temp_id}`)
            connections.set (temp_id, { socket, actual_id: null })
        })
        
        socket.addEventListener ("message", async (event) => {
            const data = JSON.parse (event.data)
            
            // handle client registration
            if (data.type === "register") {
                const old_id = client_id
                client_id = data.client_id
                connections.delete (old_id)
                connections.set (client_id, { socket, actual_id: client_id })
                console.log (`client registered as: ${client_id}`)
                start_polling_for_client (client_id, socket)
                return
            }
            
            await handle_websocket_message (client_id, event.data)
        })
        
        socket.addEventListener ("close", () => {
            console.log (`client disconnected: ${client_id}`)
            connections.delete (client_id)
        })
        
        return response
    }
    
    // handle ice servers request
    if (url.pathname === "/ice-servers") {
        const ice_servers = await get_turn_credentials ()
        
        if (ice_servers) {
            return new Response (JSON.stringify ({ ice_servers }), {
                headers: { "content-type": "application/json" }
            })
        } else {
            // fallback to just STUN
            return new Response (JSON.stringify ({
                ice_servers: [{ urls: "stun:stun.l.google.com:19302" }]
            }), {
                headers: { "content-type": "application/json" }
            })
        }
    }
    
    // serve static files
    let path = url.pathname
    if (path === "/") path = "/index.html"
    
    // handle favicon based on referer
    if (path === "/favicon.ico") {
        const referer = request.headers.get ("referer") || ""
        if (referer.includes ("ctrl.html")) {
            path = "/dish.ico"
        }
    }
    
    try {
        const file = await Deno.readFile (`.${path}`)
        const content_type = path.endsWith (".html") ? "text/html" 
            : path.endsWith (".js") ? "application/javascript" 
            : path.endsWith (".ico") ? "image/x-icon"
            : "text/plain"
            
        return new Response (file, {
            headers: { "content-type": content_type }
        })
    } catch {
        return new Response ("not found", { status: 404 })
    }
}

// handle incoming websocket messages and queue them in kv
async function handle_websocket_message (sender_id, data) {
    try {
        const message = JSON.parse (data)
        message.sender_id = sender_id
        message.timestamp = Date.now ()
        
        console.log (`received: ${message.type} from ${message.source} to ${message.target}`)
        
        // handle broadcast messages (ending with *)
        if (message.target.endsWith ("*")) {
            const prefix = message.target.slice (0, -1) // remove the *
            
            // send to all matching connected clients
            for (const [client_id, client_info] of connections) {
                if (client_id.startsWith (prefix) && client_info.socket.readyState === WebSocket.OPEN) {
                    client_info.socket.send (JSON.stringify (message))
                }
            }
        } else {
            // queue specific message in kv with ttl of 30 seconds
            const key = ["messages", message.target, crypto.randomUUID ()]
            await kv.set (key, message, { expireIn: 30 * 1000 })
        }
        
    } catch (error) {
        console.error (`error handling message: ${error}`)
    }
}

// poll kv for messages destined to this client
async function start_polling_for_client (client_id, socket) {
    while (socket.readyState === WebSocket.OPEN) {
        try {
            // check for messages targeted specifically to this client
            const entries = kv.list ({ prefix: ["messages", client_id] })
            
            for await (const entry of entries) {
                const message = entry.value
                
                // send message to client
                socket.send (JSON.stringify (message))
                
                // delete message after sending
                await kv.delete (entry.key)
            }
            
        } catch (error) {
            console.error (`polling error: ${error}`)
        }
        
        // poll every 100ms
        await new Promise (resolve => setTimeout (resolve, 100))
    }
}

// start server
const port = parseInt (Deno.env.get ("PORT") || "8000")
console.log (`server starting on port ${port}`)

Deno.serve ({ port }, handle_request)