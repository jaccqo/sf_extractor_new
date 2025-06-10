console.log("Content script loaded and running.");

// Function to check if the user is on an Opportunity page
function checkForOpportunityPage() {
    const currentUrl = window.location.href;
    const targetDomain = "https://jbrands2023.lightning.force.com";
    if (currentUrl.startsWith(targetDomain) && currentUrl.includes("/Opportunity/")) {
        console.log("User is on an Opportunity page on jbrands2023.lightning.force.com.");
        return true;
    } else {
        console.log("Not on an Opportunity page.");
        return false;
    }
}

// Function to check for active call panels and manage status prioritization
function checkStatusAndSend() {
    const currentUrl = window.location.href;
    let statusSent = false;

    const callPanels = document.querySelectorAll('div.voiceConnectedPanel.voiceCallHandlerContainer');
    if (callPanels.length > 0) {
        const callPanel = callPanels[callPanels.length - 1];
        console.log("Call in progress detected within the specific panel.");

        const companyNameElement = callPanel.querySelector('div.highlightsH1 span.uiOutputText');
        const personNameElement = callPanel.querySelector('div.field span.uiOutputText.forceOutputLookup');
        const phoneNumberElement = callPanel.querySelector('div.openctiOutputPhone span.uiOutputPhone');

        const companyName = companyNameElement ? companyNameElement.innerText : 'Unknown Company';
        const personName = personNameElement ? personNameElement.innerText : 'Unknown Person';
        const phoneNumber = phoneNumberElement ? phoneNumberElement.innerText : 'Unknown Number';

        const callDetails = {
            company: companyName,
            person: personName,
            phone: phoneNumber,
            url: currentUrl
        };

        console.log("Call details:", callDetails);

        chrome.runtime.sendMessage({ 
            action: 'sendStatus', 
            status: 'call_in_progress', 
            details: callDetails 
        }, response => {
            console.log("Response from background:", response.status);
        });

        statusSent = true;
    }

    if (!statusSent && checkForOpportunityPage()) {
        chrome.runtime.sendMessage({ 
            action: 'sendStatus', 
            status: 'on_opportunity_page', 
            details: { url: currentUrl }
        }, response => {
            console.log("Response from background:", response.status);
        });
        statusSent = true;
    }

    if (!statusSent) {
        console.log("No call detected, and not on an Opportunity page.");
        chrome.runtime.sendMessage({ 
            action: 'sendStatus', 
            status: 'no_call', 
            details: { url: currentUrl }
        }, response => {
            console.log("Response from background:", response.status);
        });
    }
}

// Function to monitor Twilio logs in the console
function monitorTwilioConsoleLogs() {
    const originalConsoleLog = console.log;

    console.log = function (...args) {
        originalConsoleLog.apply(console, args);

        for (let arg of args) {
            if (typeof arg !== 'string') continue;

            // Detect outgoing call initiation
            if (arg.includes('[TwilioVoice][Device] .connect')) {
                const match = arg.match(/{.*}/);
                if (match) {
                    try {
                        const data = JSON.parse(match[0]);
                        const to = data.params?.To;
                        const caller = data.params?.Caller;
                        if (to && caller) {
                            console.info(`[Detected] Outgoing call from ${caller} to ${to}`);
                            // Add custom logic here if needed
                        }
                    } catch (err) {
                        originalConsoleLog('Error parsing connect payload:', err);
                    }
                }
            }

            // Detect outgoing call disconnection
            else if (arg.includes('[TwilioVoice][EventPublisher]') && arg.includes('"name":"disconnected-by-local"')) {
                const match = arg.match(/{.*}/);
                if (match) {
                    try {
                        const data = JSON.parse(match[0]);
                        const callSid = data.event?.payload?.call_sid;
                        const direction = data.event?.payload?.direction;
                        if (direction === 'OUTGOING') {
                            console.info(`[Detected] Outgoing call disconnected (SID: ${callSid})`);
                            // Add custom logic here if needed
                        }
                    } catch (err) {
                        originalConsoleLog('Error parsing disconnect payload:', err);
                    }
                }
            }
        }
    };
}

// Start monitoring when page loads
window.addEventListener('load', () => {
    console.log("All resources finished loading.");

    try {
        checkStatusAndSend();
    } catch (error) {
        console.error("Error during initial status check:", error);
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length || mutation.removedNodes.length) {
                try {
                    checkStatusAndSend();
                } catch (error) {
                    console.error("Error checking status:", error);
                }
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Start Twilio log monitor
    monitorTwilioConsoleLogs();
});
