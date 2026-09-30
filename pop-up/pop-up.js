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
const studentIdSummary = document.getElementById("studentIdSummary");
const savedStudentId = document.getElementById("savedStudentId");
const studentIdSetup = document.getElementById("studentIdSetup");
const studentIdInput = document.getElementById("studentIdInput");
const saveStudentIdButton = document.getElementById("saveStudentIdButton");
const changeStudentIdButton = document.getElementById("changeStudentIdButton");
const cancelStudentIdButton = document.getElementById("cancelStudentIdButton");
const studentIdError = document.getElementById("studentIdError");

let trackingData = null;
let lastCompletedResult = null;
let studentId = "";
let editingStudentId = false;


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
    renderStudentId(isTracking);

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


function renderStudentId(isTracking) {
    const hasStudentId = Boolean(studentId);
    studentIdSummary.hidden = !hasStudentId || editingStudentId;
    studentIdSetup.hidden = hasStudentId && !editingStudentId;
    savedStudentId.textContent = studentId;

    studentIdInput.disabled = isTracking;
    saveStudentIdButton.disabled = isTracking;
    changeStudentIdButton.disabled = isTracking;
    cancelStudentIdButton.disabled = isTracking;
    cancelStudentIdButton.hidden = !hasStudentId || !editingStudentId;
}


async function loadState() {
    const [state, completedResult, settings] = await Promise.all([
        browser.runtime.sendMessage({ type: "GET_TRACKING_STATE" }),
        browser.runtime.sendMessage({ type: "GET_LAST_COMPLETED_RESULT" }),
        browser.storage.local.get("studentId")
    ]);

    trackingData = state && state.tracking ? state : null;
    lastCompletedResult = completedResult;
    studentId = settings.studentId || "";
    studentIdInput.value = studentId;
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

    if (changes.studentId) {
        studentId = changes.studentId.newValue || "";
        studentIdInput.value = studentId;
    }

    renderState();
});


changeStudentIdButton.addEventListener("click", () => {
    if (trackingData && trackingData.tracking) {
        return;
    }

    editingStudentId = true;
    studentIdError.hidden = true;
    renderState();
    studentIdInput.focus();
});


cancelStudentIdButton.addEventListener("click", () => {
    if (trackingData && trackingData.tracking) {
        return;
    }

    editingStudentId = false;
    studentIdInput.value = studentId;
    studentIdError.hidden = true;
    renderState();
});


saveStudentIdButton.addEventListener("click", async () => {
    const newStudentId = studentIdInput.value.trim();
    studentIdError.hidden = true;

    if (trackingData && trackingData.tracking) {
        studentIdError.textContent = "Stop tracking before changing the Student ID.";
        studentIdError.hidden = false;
        return;
    }

    if (!/^C\d{6}$/.test(newStudentId)) {
        studentIdError.textContent = "Enter an ID beginning with C followed by 6 digits.";
        studentIdError.hidden = false;
        return;
    }

    try {
        await browser.storage.local.set({ studentId: newStudentId });
        studentId = newStudentId;
        editingStudentId = false;
        renderState();
    } catch (error) {
        studentIdError.textContent = "Could not save the Student ID.";
        studentIdError.hidden = false;
    }
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
