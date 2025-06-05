window.addEventListener('load', () => {
  let currentStatus = '';

  // Function to update the status display with the countdown timer
  function updateStatus(minutes, seconds) {
      minutes = minutes < 10 ? '0' + minutes : minutes;
      seconds = seconds < 10 ? '0' + seconds : seconds;
      document.getElementById('status').innerText = `${currentStatus} - ${minutes}:${seconds}`;
  }

  // Event listener for the "I need a break" button
  document.getElementById('breakButton').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'sendStatus', status: 'break' }, response => {
          console.log(response.status);
      });
  });

  // Event listener for the "I'm making an invoice" button
  document.getElementById('invoiceButton').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'sendStatus', status: 'invoice' }, response => {
          console.log(response.status);
      });
  });

  // Listen for messages from the background script to update the countdown
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updateCountdown') {
          currentStatus = message.status;

          if (currentStatus === "Break") {
              document.getElementById('breakButton').innerText = "On Break";
              document.getElementById('invoiceButton').innerText = "I'm making an invoice";
          } else if (currentStatus === "Invoice") {
              document.getElementById('breakButton').innerText = "I need a break";
              document.getElementById('invoiceButton').innerText = "Creating Invoice";
          } else if (currentStatus === "countdown_completed") {
              document.getElementById('breakButton').innerText = "I need a break";
              document.getElementById('invoiceButton').innerText = "I'm making an invoice";
          } else {
              document.getElementById('breakButton').innerText = "I need a break";
              document.getElementById('invoiceButton').innerText = "I'm making an invoice";
          }

          updateStatus(message.minutes, message.seconds);
      }
  });
});
