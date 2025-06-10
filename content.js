function checkStatusAndSend() {
    const currentUrl = window.location.href;
    let statusSent = false;

    // Check for active call panels (priority 1)
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
        return; // Already handled
    }

    // Check for "Dialing" status (priority 2)
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

    // Check for Opportunity page (priority 3)
    if (checkForOpportunityPage()) {
        chrome.runtime.sendMessage({ 
            action: 'sendStatus', 
            status: 'on_opportunity_page', 
            details: { url: currentUrl }
        }, response => {
            console.log("Response from background:", response.status);
        });
        statusSent = true;
        return;
    }

    // Fallback (priority 4)
    console.log("No call detected, and not on an Opportunity page.");
    chrome.runtime.sendMessage({ 
        action: 'sendStatus', 
        status: 'no_call', 
        details: { url: currentUrl }
    }, response => {
        console.log("Response from background:", response.status);
    });
}


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
});
