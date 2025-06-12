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

// Function to find the "Answer" button and get phone details
function getIncomingCallDetails() {
    const answerButton = document.querySelector('button.slds-button.answer');
    if (!answerButton) {
        console.log("No 'Answer' button found for incoming call.");
        return null;
    }

    const dialStatus = document.querySelector('.dialstatus');
    if (!dialStatus) {
        console.log("No '.dialstatus' element found for incoming call.");
        return null;
    }

    const countryCodeElement = dialStatus.querySelector('.uiOutputText.voiceOutputPhone');
    const phoneNumberElement = dialStatus.querySelector('.uiOutputPhone.voiceOutputPhone');

    if (!countryCodeElement && !phoneNumberElement) {
        console.log("No phone number elements found in '.dialstatus'.");
        return null;
    }

    const phone = `${countryCodeElement?.textContent.trim() || ''}${phoneNumberElement?.textContent.trim() || ''}`;

    const details = {
        phone: phone || null,
        timeAgo: null, // Add logic to extract this if available
        direction: 'Incoming'
    };

    console.log("Incoming call details:", details);
    return details;
}

// Function to check for call status and send appropriate message
function checkStatusAndSend() {
    const currentUrl = window.location.href;
    let statusSent = false;

    // Priority 1: Incoming Call
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
            console.log("Background response for incoming_call:", response?.status || 'No response');
        });
        statusSent = true;
        return;
    }

    // Priority 2: Active Call Panel
    const callPanels = document.querySelectorAll('div.voiceConnectedPanel.voiceCallHandlerContainer');
    if (callPanels.length > 0) {
        const callPanel = callPanels[callPanels.length - 1];
        console.log("Call in progress detected.");

        const companyNameElement = callPanel.querySelector('div.highlightsH1 span.uiOutputText');
        const personNameElement = callPanel.querySelector('div.field span.uiOutputText.forceOutputLookup');
        const phoneNumberElement = callPanel.querySelector('div.openctiOutputPhone span.uiOutputPhone');

        const callDetails = {
            company: companyNameElement?.innerText || 'Unknown Company',
            person: personNameElement?.innerText || 'Unknown Person',
            phone: phoneNumberElement?.innerText || 'Unknown Number',
            url: currentUrl
        };

        console.log("Call details:", callDetails);

        chrome.runtime.sendMessage({
            action: 'sendStatus',
            status: 'call_in_progress',
            details: callDetails
        }, response => {
            console.log("Background response for call_in_progress:", response?.status || 'No response');
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

                console.log(`Dialing detected: ${phoneNumber}`);

                chrome.runtime.sendMessage({
                    action: 'sendStatus',
                    status: 'call_dialing',
                    details: {
                        phone: phoneNumber,
                        url: currentUrl,
                        timestamp: Date.now()
                    }
                }, response => {
                    console.log("Background response for call_dialing:", response?.status || 'No response');
                });

                statusSent = true;
                return;
            } else {
                console.log("No '.voiceCompactRecord' panel found for dialing state.");
            }
        }
    }

    // Priority 4: Opportunity Page
    if (checkForOpportunityPage()) {
        console.log("Sending opportunity page status.");
        chrome.runtime.sendMessage({
            action: 'sendStatus',
            status: 'on_opportunity_page',
            details: { url: currentUrl }
        }, response => {
            console.log("Background response for on_opportunity_page:", response?.status || 'No response');
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
        console.log("Background response for no_call:", response?.status || 'No response');
    });
}

// Debounce function to limit MutationObserver calls
let debounceTimeout;
function debounceCheckStatusAndSend() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        try {
            checkStatusAndSend();
        } catch (error) {
            console.error("Error checking status on mutation:", error);
        }
    }, 100); // 100ms debounce
}

// Start monitoring when page loads
window.addEventListener('load', () => {
    console.log("Page fully loaded.");

    try {
        checkStatusAndSend();
    } catch (error) {
        console.error("Error during initial status check:", error);
    }

    // Observe DOM changes with debouncing
    const observer = new MutationObserver((mutations) => {
        if (mutations.some(m => m.addedNodes.length || m.removedNodes.length)) {
            debounceCheckStatusAndSend();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
});