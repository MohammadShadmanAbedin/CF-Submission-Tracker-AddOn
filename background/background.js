// ==========================================
// CF Problem Tracker
// background/background.js
// ==========================================

let currentProblem = null;


// ==========================================
// RECEIVE PROBLEM INFORMATION
// ==========================================

browser.runtime.onMessage.addListener(async (message) => {

    // Content script found a Codeforces problem
    if (message.type === "PROBLEM_INFO") {

        currentProblem = message.data;

        console.log("Problem received:", currentProblem);
    }


    // Popup asks to start tracking
    if (message.type === "START_TRACKING") {

        if (!currentProblem) {

            console.log("No Codeforces problem detected.");

            return {
                success: false,
                error: "No Codeforces problem detected."
            };
        }


        // Save tracking information
        const trackingData = {

            tracking: true,

            problem: currentProblem,

            startTime: Date.now(),

            attempts: 0
        };


        await browser.storage.local.set({
            trackingData: trackingData
        });


        console.log(
            "Tracking started:",
            trackingData
        );


        return {
            success: true,
            trackingData: trackingData
        };
    }


    // Popup asks for current tracking state
    if (message.type === "GET_TRACKING_STATE") {

        const result = await browser.storage.local.get(
            "trackingData"
        );


        return result.trackingData || {
            tracking: false
        };
    }


    // Popup asks to stop tracking
    if (message.type === "STOP_TRACKING") {

        await browser.storage.local.remove(
            "trackingData"
        );


        console.log("Tracking stopped.");

        return {
            success: true
        };
    }

});