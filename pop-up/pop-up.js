// ==========================================
// CF Problem Tracker
// pop-up/pop-up.js
// ==========================================

const status = document.getElementById("status");

const startButton =
    document.getElementById("startButton");


// ==========================================
// START BUTTON
// ==========================================

startButton.addEventListener("click", async () => {

    const response =
        await browser.runtime.sendMessage({
            type: "START_TRACKING"
        });


    if (!response || !response.success) {

        status.textContent =
            response?.error ||
            "Could not start tracking.";

        return;
    }


    status.textContent =
        "Tracking started";

    startButton.textContent =
        "TRACKING";
});


// ==========================================
// LOAD EXISTING STATE
// ==========================================

async function loadState() {

    const response =
        await browser.runtime.sendMessage({
            type: "GET_TRACKING_STATE"
        });


    if (response && response.tracking) {

        status.textContent =
            "Tracking started";

        startButton.textContent =
            "TRACKING";

    } else {

        status.textContent =
            "Not tracking";

        startButton.textContent =
            "START";
    }
}


loadState();