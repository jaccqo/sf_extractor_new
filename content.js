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



// <div class="callDetails slds-truncate">
//     <lightning-icon
//         class="slds-p-right_xx-small nonMissed slds-icon-utility-incoming-call slds-icon_container"
//         icon-name="utility:incoming_call"
//         lwc-4897l11qtae-host=""><span
//             lwc-4897l11qtae=""
//             style="--sds-c-icon-color-background: var(--slds-c-icon-color-background, transparent)"
//             part="boundary"><lightning-primitive-icon
//                 lwc-4897l11qtae=""
//                 exportparts="icon"
//                 size="x-small"
//                 variant=""
//                 lwc-24ofe7jiu3a-host=""><svg
//                     focusable="false"
//                     aria-hidden="true"
//                     viewBox="0 0 520 520"
//                     part="icon"
//                     lwc-24ofe7jiu3a=""
//                     data-key="incoming_call"
//                     class="slds-icon slds-icon-text-default slds-icon_x-small">
//                     <g
//                         lwc-24ofe7jiu3a="">
//                         <path
//                             d="M485 379l-61-49a40 40 0 00-48-1l-52 38c-6 5-15 4-21-2l-78-70-70-78c-6-6-6-14-2-21l38-52a40 40 0 00-1-48l-49-61a40 40 0 00-59-3L30 84c-8 8-12 19-12 30 5 102 51 199 119 267s165 114 267 119c11 1 22-4 30-12l52-52a36 36 0 00-1-57zM296 240h154c10 0 13-11 5-19l-49-50 90-91c5-5 5-14 0-19l-37-37c-5-5-13-5-19 0l-91 91-51-49c-7-9-18-6-18 4v153c0 7 9 17 16 17z"
//                             lwc-24ofe7jiu3a="">
//                         </path>
//                     </g>
//                 </svg></lightning-primitive-icon><span
//                 class="slds-assistive-text"
//                 lwc-4897l11qtae="">Incoming</span></span></lightning-icon>&nbsp;+1
//     (862)
//     236-9655&nbsp;•&nbsp;a
//     few
//     seconds
//     ago&nbsp;
// </div>

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
                    getIncomingCallDetails();

                } catch (error) {
                    console.error("Error checking status on mutation:", error);
                }
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
});
