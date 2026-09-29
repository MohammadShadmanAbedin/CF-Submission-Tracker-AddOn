// ==========================================
// CF Problem Tracker
// pop-up/pop-up.js
// ==========================================

const problemDetails = document.getElementById("problemDetails");
const problemName = document.getElementById("problemName");
const problemRating = document.getElementById("problemRating");
const inactiveMessage = document.getElementById("inactiveMessage");
const errorMessage = document.getElementById("errorMessage");
const timerDetails = document.getElementById("timerDetails");
const elapsedTime = document.getElementById("elapsedTime");
const attemptCount = document.getElementById("attemptCount");
const trackingStatus = document.getElementById("trackingStatus");
const completedDetails = document.getElementById("completedDetails");
const solveTime = document.getElementById("solveTime");
const completedAttempts = document.getElementById("completedAttempts");
const trackingButton = document.getElementById("trackingButton");

let trackingData = null;
let lastCompletedResult = null;


// Format elapsed wall-clock time from the saved startTime.
function formatElapsedTime(startTime) {
    const totalSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(totalMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


function renderProblem(problem) {
    if (!problem) {
        problemDetails.hidden = true;
        return;
    }

    problemName.textContent = `${problem.contestId}${problem.problemIndex}`;
    problemRating.textContent = problem.rating == null ? "Unknown" : problem.rating;
    problemDetails.hidden = false;
}


function renderState() {
    const isTracking = Boolean(trackingData && trackingData.tracking);

    if (isTracking) {
        renderProblem(trackingData.problem);
        inactiveMessage.hidden = true;
        timerDetails.hidden = false;
        completedDetails.hidden = true;
        trackingButton.textContent = "STOP";
        elapsedTime.textContent = formatElapsedTime(trackingData.startTime);
        attemptCount.textContent = trackingData.attempts || 0;
        trackingStatus.textContent = trackingData.checkingSubmission
            ? "Checking submission..."
            : "Tracking...";
    } else if (lastCompletedResult) {
        renderProblem(lastCompletedResult.problem);
        inactiveMessage.hidden = true;
        timerDetails.hidden = true;
        completedDetails.hidden = false;
        trackingButton.textContent = "START";
        solveTime.textContent = lastCompletedResult.solveTimeMinutes;
        completedAttempts.textContent = lastCompletedResult.attempts;
    } else {
        problemDetails.hidden = true;
        inactiveMessage.hidden = false;
        timerDetails.hidden = true;
        completedDetails.hidden = true;
        trackingButton.textContent = "START";
    }
}


async function loadState() {
    const [state, completedResult] = await Promise.all([
        browser.runtime.sendMessage({ type: "GET_TRACKING_STATE" }),
        browser.runtime.sendMessage({ type: "GET_LAST_COMPLETED_RESULT" })
    ]);

    trackingData = state && state.tracking ? state : null;
    lastCompletedResult = completedResult;
    renderState();
}


// Keep an already-open popup in step with attempts, status, and completion.
browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
        return;
    }

    if (changes.trackingData) {
        const nextTrackingData = changes.trackingData.newValue;
        trackingData = nextTrackingData && nextTrackingData.tracking
            ? nextTrackingData
            : null;
    }

    if (changes.lastCompletedResult) {
        lastCompletedResult = changes.lastCompletedResult.newValue || null;
    }

    renderState();
});


trackingButton.addEventListener("click", async () => {
    errorMessage.hidden = true;

    if (trackingData && trackingData.tracking) {
        const response = await browser.runtime.sendMessage({
            type: "STOP_TRACKING"
        });

        if (!response || !response.success) {
            errorMessage.textContent = "Could not stop tracking.";
            errorMessage.hidden = false;
            return;
        }

        trackingData = null;
        renderState();
        return;
    }

    trackingButton.disabled = true;
    const response = await browser.runtime.sendMessage({
        type: "START_TRACKING"
    });
    trackingButton.disabled = false;

    if (!response || !response.success) {
        errorMessage.textContent = response?.error || "Could not start tracking.";
        errorMessage.hidden = false;
        return;
    }

    trackingData = response.trackingData;
    renderState();
});


loadState();

// This interval refreshes only the display; elapsed time always comes from startTime.
window.setInterval(() => {
    if (trackingData && trackingData.tracking) {
        elapsedTime.textContent = formatElapsedTime(trackingData.startTime);
    }
}, 1000);
