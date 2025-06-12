let socket;
let messageQueue = []; // Queue for messages when WebSocket is not open

function connectWebSocket() {
    socket = new WebSocket('ws://localhost:5000/ws');

    socket.onopen = function() {
        console.log('WebSocket connection established');
        // Send any queued messages
        while (messageQueue.length > 0 && socket.readyState === WebSocket.OPEN) {
            const { status, details } = messageQueue.shift();
            socket.send(JSON.stringify({ status, details }));
            console.log(`Sent queued status: ${status}`);
        }
    };

    socket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);

            if (data.type === 'countdown_update') {
                chrome.runtime.sendMessage({
                    action: 'updateCountdown',
                    status: data.status,
                    minutes: data.minutes,
                    seconds: data.seconds
                });
            } else if (data.type === 'countdown_completed') {
                chrome.runtime.sendMessage({
                    action: 'updateCountdown',
                    status: 'countdown_completed',
                    minutes: 0,
                    seconds: 0
                });
            } else if (data.type === 'status_update') {
                console.log(`Server confirmed status: ${data.status}`);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };

    socket.onclose = function() {
        console.log('WebSocket connection closed. Reconnecting in 5 seconds...');
        setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
        socket.close();
    };
}

function sendStatus(status, details = {}) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ status, details }));
        console.log(`Sent status: ${status}`, details);
    } else {
        console.warn(`WebSocket is not open (state: ${socket.readyState}). Queuing status: ${status}`);
        messageQueue.push({ status, details });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'sendStatus') {
        console.log(`Received status from content script: ${message.status}`, message.details);
        sendStatus(message.status, message.details);
        sendResponse({ status: 'success' });
    }
    // Ensure async response
    return true;
});

connectWebSocket();