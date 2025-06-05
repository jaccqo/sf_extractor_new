let socket;

function connectWebSocket() {
    socket = new WebSocket('ws://localhost:5000/ws');

    socket.onopen = function() {
        console.log('WebSocket connection established');
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
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
        }
    };

    socket.onclose = function() {
        console.log('WebSocket connection closed. Reconnecting...');
        setTimeout(connectWebSocket, 5000);  // Reconnect after 5 seconds
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
        socket.close();
    };
}

function sendStatus(status, details = {}) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ status: status, details: details }));
        console.log(`Sent status: ${status}`);
    } else {
        console.error('WebSocket is not open. Cannot send status.');
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'sendStatus') {
        sendStatus(message.status, message.details);

        sendResponse({ status: 'success' });
    }
});

connectWebSocket();
