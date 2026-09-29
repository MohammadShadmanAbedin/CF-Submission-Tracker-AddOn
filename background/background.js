// ==========================================
// CF Problem Tracker
// background/background.js
// ==========================================

const POLL_INTERVAL_MS = 3000;
const SUBMISSION_PAGE_SIZE = 50;

let pollTimer = null;
let pollingSessionId = null;
let lastPollFailed = false;


// Request problem information and the signed-in handle from the active tab.
async function getActiveProblem() {
    const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!activeTab || !activeTab.url ||
        !activeTab.url.startsWith("https://codeforces.com/")) {
        return {
            problem: null,
            error: "Open a Codeforces problem before starting."
        };
    }

    try {
        const problem = await browser.tabs.sendMessage(activeTab.id, {
            type: "GET_PROBLEM_INFO"
        });

        if (!isValidProblem(problem)) {
            return {
                problem: null,
                error: "Open a Codeforces problem before starting."
            };
        }

        if (!problem.handle) {
            return {
                problem: null,
                error: "Sign in to Codeforces to enable verdict detection."
            };
        }

        return {
            problem: {
                url: problem.url,
                contestId: problem.contestId,
                problemIndex: problem.problemIndex,
                rating: problem.rating
            },
            handle: problem.handle
        };
    } catch (error) {
        return {
            problem: null,
            error: "Refresh the Codeforces page and try again."
        };
    }
}


function isValidProblem(problem) {
    return Boolean(
        problem &&
        problem.url &&
        problem.contestId &&
        problem.problemIndex
    );
}


// Codeforces returns a user's newest submissions first, each with a unique ID.
async function getRecentSubmissions(handle) {
    const url = new URL("https://codeforces.com/api/user.status");
    url.searchParams.set("handle", handle);
    url.searchParams.set("from", "1");
    url.searchParams.set("count", String(SUBMISSION_PAGE_SIZE));

    const response = await fetch(url.toString(), {
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error(`Codeforces returned HTTP ${response.status}.`);
    }

    const payload = await response.json();

    if (payload.status !== "OK" || !Array.isArray(payload.result)) {
        throw new Error(payload.comment || "Could not read Codeforces submissions.");
    }

    return payload.result;
}


async function getHandleFromOpenCodeforcesTab() {
    const tabs = await browser.tabs.query({
        url: "https://codeforces.com/*"
    });

    for (const tab of tabs) {
        try {
            const problem = await browser.tabs.sendMessage(tab.id, {
                type: "GET_PROBLEM_INFO"
            });

            if (problem && problem.handle) {
                return problem.handle;
            }
        } catch (error) {
            // Try another open Codeforces tab if this one is still loading.
        }
    }

    return null;
}


function stopPolling() {
    if (pollTimer !== null) {
        clearTimeout(pollTimer);
    }

    pollTimer = null;
    pollingSessionId = null;
    lastPollFailed = false;
}


function startPolling(trackingData) {
    if (!trackingData || !trackingData.tracking || !trackingData.sessionId) {
        return;
    }

    if (pollingSessionId === trackingData.sessionId) {
        return;
    }

    stopPolling();
    pollingSessionId = trackingData.sessionId;
    console.log("Checking submissions...");
    scheduleNextPoll(trackingData.sessionId);
}


function scheduleNextPoll(sessionId) {
    if (pollingSessionId !== sessionId) {
        return;
    }

    pollTimer = setTimeout(() => pollSubmissions(sessionId), POLL_INTERVAL_MS);
}


async function pollSubmissions(sessionId) {
    if (pollingSessionId !== sessionId) {
        return;
    }

    pollTimer = null;

    try {
        const saved = await browser.storage.local.get("trackingData");
        const trackingData = saved.trackingData;

        if (!trackingData || !trackingData.tracking ||
            trackingData.sessionId !== sessionId) {
            stopPolling();
            return;
        }

        const submissions = await getRecentSubmissions(trackingData.codeforcesHandle);

        // A manual STOP or another session may have happened during the request.
        if (pollingSessionId !== sessionId) {
            return;
        }

        const current = await browser.storage.local.get("trackingData");
        if (!current.trackingData || !current.trackingData.tracking ||
            current.trackingData.sessionId !== sessionId) {
            stopPolling();
            return;
        }

        await processSubmissions(current.trackingData, submissions);
        lastPollFailed = false;
    } catch (error) {
        if (!lastPollFailed) {
            console.warn("Could not check Codeforces submissions:", error.message);
        }
        lastPollFailed = true;
    }

    scheduleNextPoll(sessionId);
}


async function processSubmissions(trackingData, submissions) {
    const processedIds = new Set(trackingData.processedSubmissionIds || []);
    const observedIds = new Set(trackingData.observedSubmissionIds || []);
    const candidates = submissions.filter((submission) => {
        const sameProblem = submission.problem &&
            String(submission.problem.contestId) === String(trackingData.problem.contestId) &&
            String(submission.problem.index) === String(trackingData.problem.problemIndex);
        const sameUser = submission.author &&
            Array.isArray(submission.author.members) &&
            submission.author.members.some((member) =>
                member.handle &&
                member.handle.toLowerCase() === trackingData.codeforcesHandle.toLowerCase()
            );

        return sameProblem && sameUser &&
            Number(submission.id) > trackingData.submissionBaselineId;
    }).sort((left, right) => Number(left.id) - Number(right.id));

    let attempts = trackingData.attempts;
    let changed = false;
    let checkingSubmission = false;
    const newlyProcessedIds = Array.from(processedIds);
    const newlyObservedIds = Array.from(observedIds);

    for (const submission of candidates) {
        const submissionId = Number(submission.id);
        const verdict = submission.verdict;

        if (!observedIds.has(submissionId)) {
            console.log(`New submission detected: ${submissionId}`);
            observedIds.add(submissionId);
            newlyObservedIds.push(submissionId);
            changed = true;
        }

        // Null/TESTING verdicts are still being judged, not completed attempts.
        if (!verdict || verdict === "TESTING" || verdict === "IN_QUEUE" || verdict === "RUNNING") {
            checkingSubmission = true;
            continue;
        }

        if (processedIds.has(submissionId)) {
            continue;
        }

        attempts += 1;
        processedIds.add(submissionId);
        newlyProcessedIds.push(submissionId);
        changed = true;

        if (verdict === "OK") {
            console.log("Verdict: ACCEPTED");

            const previous = await browser.storage.local.get("lastCompletedResult");
            if (previous.lastCompletedResult &&
                previous.lastCompletedResult.submissionId === submissionId) {
                await browser.storage.local.remove("trackingData");
                stopPolling();
                return;
            }

            const activeState = await browser.storage.local.get("trackingData");
            if (pollingSessionId !== trackingData.sessionId ||
                !activeState.trackingData ||
                activeState.trackingData.sessionId !== trackingData.sessionId) {
                return;
            }

            const elapsedMilliseconds = Date.now() - trackingData.startTime;
            const completedResult = {
                problem: trackingData.problem,
                verdict: "AC",
                solveTimeMinutes: Math.round(elapsedMilliseconds / 60000),
                attempts: attempts,
                completedAt: Date.now(),
                submissionId: submissionId,
                sheetStatus: "pending"
            };

            await browser.storage.local.set({
                lastCompletedResult: completedResult
            });
            await browser.storage.local.remove("trackingData");
            stopPolling();

            console.log("Tracking completed", completedResult);

            try {
                await sendCompletedResultToSheet(completedResult);
                completedResult.sheetStatus = "sent";
            } catch (error) {
                completedResult.sheetStatus = "failed";
                completedResult.sheetError = error.message;
                console.error("Could not send completed result to Google Sheets:", error.message);
            }

            await browser.storage.local.set({
                lastCompletedResult: completedResult
            });
            return;
        }

        console.log(`Verdict: ${verdict}`);
        console.log(`Attempts: ${attempts}`);
    }

    if (changed || trackingData.checkingSubmission !== checkingSubmission) {
        const saved = await browser.storage.local.get("trackingData");
        const current = saved.trackingData;

        if (!current || !current.tracking ||
            current.sessionId !== trackingData.sessionId ||
            pollingSessionId !== current.sessionId) {
            return;
        }

        current.attempts = attempts;
        current.processedSubmissionIds = newlyProcessedIds;
        current.observedSubmissionIds = newlyObservedIds;
        current.checkingSubmission = checkingSubmission;
        current.status = checkingSubmission ? "checking" : "tracking";

        await browser.storage.local.set({ trackingData: current });
    }
}


// ==========================================
// POPUP COMMANDS
// ==========================================

browser.runtime.onMessage.addListener(async (message) => {
    if (message.type === "START_TRACKING") {
        // Always ask the active Codeforces tab at the moment START is clicked.
        const active = await getActiveProblem();

        if (!active.problem) {
            return {
                success: false,
                error: active.error
            };
        }

        const saved = await browser.storage.local.get("trackingData");
        if (saved.trackingData && saved.trackingData.tracking) {
            startPolling(saved.trackingData);
            return {
                success: true,
                trackingData: saved.trackingData
            };
        }

        let baselineSubmissions;
        try {
            baselineSubmissions = await getRecentSubmissions(active.handle);
        } catch (error) {
            return {
                success: false,
                error: "Could not initialize verdict detection. Check your Codeforces connection and try again."
            };
        }

        const baselineId = baselineSubmissions.reduce((highest, submission) =>
            Math.max(highest, Number(submission.id) || 0), 0);
        const trackingData = {
            tracking: true,
            problem: active.problem,
            startTime: Date.now(),
            attempts: 0,
            codeforcesHandle: active.handle,
            submissionBaselineId: baselineId,
            processedSubmissionIds: [],
            observedSubmissionIds: [],
            checkingSubmission: false,
            status: "tracking",
            sessionId: `${Date.now()}-${Math.random().toString(36).slice(2)}`
        };

        await browser.storage.local.set({ trackingData: trackingData });
        console.log("Tracking started", trackingData.problem);
        startPolling(trackingData);

        return {
            success: true,
            trackingData: trackingData
        };
    }

    if (message.type === "GET_TRACKING_STATE") {
        const result = await browser.storage.local.get("trackingData");
        return result.trackingData || { tracking: false };
    }

    if (message.type === "GET_LAST_COMPLETED_RESULT") {
        const result = await browser.storage.local.get("lastCompletedResult");
        return result.lastCompletedResult || null;
    }

    if (message.type === "STOP_TRACKING") {
        stopPolling();
        await browser.storage.local.remove("trackingData");
        console.log("Tracking stopped.");
        return { success: true };
    }
});


// Restore one background polling loop when Firefox starts the add-on again.
async function restoreTracking() {
    const saved = await browser.storage.local.get("trackingData");
    const trackingData = saved.trackingData;

    if (!trackingData || !trackingData.tracking) {
        return;
    }

    // Add polling metadata to a timer started by an earlier extension version.
    if (!trackingData.sessionId || !trackingData.codeforcesHandle ||
        !Number.isFinite(trackingData.submissionBaselineId)) {
        const handle = trackingData.codeforcesHandle ||
            await getHandleFromOpenCodeforcesTab();

        if (!handle) {
            console.warn("Verdict detection could not resume: no signed-in Codeforces tab is open.");
            return;
        }

        try {
            const submissions = await getRecentSubmissions(handle);
            const baselineId = submissions.reduce((highest, submission) =>
                Math.max(highest, Number(submission.id) || 0), 0);

            trackingData.codeforcesHandle = handle;
            trackingData.submissionBaselineId = baselineId;
            trackingData.processedSubmissionIds = trackingData.processedSubmissionIds || [];
            trackingData.observedSubmissionIds = trackingData.observedSubmissionIds || [];
            trackingData.checkingSubmission = false;
            trackingData.status = "tracking";
            trackingData.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

            await browser.storage.local.set({ trackingData: trackingData });
        } catch (error) {
            console.warn("Verdict detection could not resume:", error.message);
            return;
        }
    }

    startPolling(trackingData);
}


restoreTracking();
