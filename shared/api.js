const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxBK9BBbA3l8A_AS1Ujx9WPwuCThb83wQ7dn9_QwZq9lDW3nBy14ss2RJkjMnsWfKxt/exec";


function formatLocalDate(timestamp) {
    const date = new Date(timestamp || Date.now());

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


async function sendCompletedResultToSheet(result) {
    const settings = await browser.storage.local.get("studentId");
    const studentId = settings.studentId;

    if (!studentId) {
        throw new Error("Set your Student ID before submitting results.");
    }

    if (!/^C\d{6}$/.test(studentId)) {
        throw new Error("Set a valid Student ID before submitting results.");
    }

    const payload = {
        studentId: studentId,
        problemLink: result.problem.url,
        verdict: result.verdict,
        solveTime: result.solveTimeMinutes,
        date: formatLocalDate(result.completedAt),
        category: "",
        rating: result.problem.rating,
        comment: ""
    };

    const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
    });

    let responseData;

    try {
        responseData = await response.json();
    } catch (error) {
        throw new Error("Apps Script returned an invalid JSON response.");
    }

    if (!responseData || typeof responseData !== "object") {
        throw new Error("Apps Script returned an unexpected response.");
    }

    if (!response.ok) {
        throw new Error(`Apps Script returned HTTP ${response.status}.`);
    }

    if (
        responseData.success === false ||
        responseData.status === "error" ||
        responseData.error
    ) {
        throw new Error(
            responseData.error ||
            responseData.message ||
            "Apps Script rejected the result."
        );
    }

    return responseData;
}
