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

// Function to check for call status and send appropriate message
function checkStatusAndSend() {
    const currentUrl = window.location.href;
    let statusSent = false;

    // Priority 1: Active Call Panel
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
            console.log("Response from background:", response?.status);
        });

        statusSent = true;
        return;
    }

    // Priority 2: Dialing State
    const dialingElement = document.querySelector('div.highlightsH1.truncate[aria-live="assertive"]');
    if (dialingElement && dialingElement.textContent.trim() === 'Dialing') {
        const panel = dialingElement.closest('.voiceCompactRecord');
        if (panel) {
            const phoneAnchor = panel.querySelector('a[href^="tel:"]');
            const phoneNumber = phoneAnchor ? phoneAnchor.getAttribute('href').replace('tel:', '') : 'Unknown';

            console.info(`[Detected] Dialing phone number: ${phoneNumber}`);

            chrome.runtime.sendMessage({
                action: 'sendStatus',
                status: 'call_dialing',
                details: {
                    phone: phoneNumber,
                    url: currentUrl,
                    timestamp: Date.now()
                }
            });

            statusSent = true;
            return;
        }
    }

    // Priority 3: Opportunity Page
    if (checkForOpportunityPage()) {
        chrome.runtime.sendMessage({ 
            action: 'sendStatus', 
            status: 'on_opportunity_page', 
            details: { url: currentUrl }
        }, response => {
            console.log("Response from background:", response?.status);
        });

        statusSent = true;
        return;
    }

    // Priority 4: No relevant activity
    console.log("No call detected, and not on an Opportunity page.");
    chrome.runtime.sendMessage({ 
        action: 'sendStatus', 
        status: 'no_call', 
        details: { url: currentUrl }
    }, response => {
        console.log("Response from background:", response?.status);
    });
}

// Start monitoring when page loads
window.addEventListener('load', () => {
    console.log("All resources finished loading.");

    // Initial status check
    try {
        checkStatusAndSend();
    } catch (error) {
        console.error("Error during initial status check:", error);
    }

    // Observe DOM changes to re-check status when UI updates
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length || mutation.removedNodes.length) {
                try {
                    checkStatusAndSend();
                } catch (error) {
                    console.error("Error checking status on mutation:", error);
                }
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
});
