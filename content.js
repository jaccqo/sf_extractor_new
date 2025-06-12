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



// Function to find the "Answer" button and, if present, get phone details
function getIncomingCallDetails() {
    // Look for the "Answer" button
    const answerButton = document.querySelector('button.slds-button.answer');
    if (!answerButton) {
        // No answer button found, do not proceed
        return null;
    }

    // Now look for the phone number in the voiceIncomingPanel
    const dialStatus = document.querySelector('.dialstatus');
    if (dialStatus) {
        const countryCodeElement = dialStatus.querySelector('.uiOutputText.voiceOutputPhone');
        const phoneNumberElement = dialStatus.querySelector('.uiOutputPhone.voiceOutputPhone');

        const phone = `${countryCodeElement?.textContent.trim() || ''}${phoneNumberElement?.textContent.trim() || ''}`;

        console.log("Answer button found, incoming call details:");

        const details = {
            phone: phone || null,
            timeAgo: null, // You can add logic to extract this if available
            direction: 'Incoming' // Assuming it's incoming due to context
        };

        console.log("Incoming call details:", details);
        return details;
    }

    return null;
}


// Function to check for call status and send appropriate message
function checkStatusAndSend() {
    const currentUrl = window.location.href;
    let statusSent = false;

    // Priority 1: Incoming Call (from getIncomingCallDetails)
    const incomingCallDetails = getIncomingCallDetails();
    if (incomingCallDetails) {
        console.log("Incoming call detected, sending details to background.");
        chrome.runtime.sendMessage({
            action: 'sendStatus',
            status: 'incoming_call',
            details: {
                ...incomingCallDetails,
                url: currentUrl,
                timestamp: Date.now()
            }
        }, response => {
            console.log("Response from background:", response?.status);
        });
        statusSent = true;
        return;
    }

    // Priority 2: Active Call Panel
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

    // Priority 3: Dialing State
    const dialingElements = document.querySelectorAll('div.highlightsH1.truncate[aria-live="assertive"]');
    for (const dialingElement of dialingElements) {
        const text = dialingElement.textContent.trim().toLowerCase();
        if (text.includes('dialing')) {
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
                }, response => {
                    console.log("Response from background:", response?.status);
                });

                statusSent = true;
                return; // Exit after handling first valid match
            }
        }
    }

    // Priority 4: Opportunity Page
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

    // Priority 5: No relevant activity
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
