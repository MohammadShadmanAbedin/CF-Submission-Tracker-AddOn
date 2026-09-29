// ==========================================
// Codeforces Problem Tracker
// content/codeforces.js
// ==========================================

// Store information about the current problem
const problemInfo = {
    url: window.location.href,
    contestId: null,
    problemIndex: null,
    rating: null
};


// ==========================================
// 1. GET CONTEST ID + PROBLEM INDEX
// ==========================================

const match = window.location.pathname.match(
    /\/(?:contest|problemset\/problem)\/(\d+)\/([A-Za-z0-9]+)/
);

if (match) {
    problemInfo.contestId = match[1];
    problemInfo.problemIndex = match[2];
}


// ==========================================
// 2. GET PROBLEM RATING
// ==========================================

const ratingElements = document.querySelectorAll(".tag-box");

for (const element of ratingElements) {

    const text = element.textContent.trim();

    // Codeforces difficulty tags look like "*800", "*1000", etc.
    if (/^\*\d+$/.test(text)) {

        problemInfo.rating = parseInt(
            text.substring(1),
            10
        );

        break;
    }
}


// ==========================================
// 3. SHOW RESULT IN CONSOLE
// ==========================================

console.log("CF Problem Tracker:");
console.log(problemInfo);


// ==========================================
// 4. SEND PROBLEM INFO TO BACKGROUND
// ==========================================

browser.runtime.sendMessage({
    type: "PROBLEM_INFO",
    data: problemInfo
});


// ==========================================
// 5. LISTEN FOR REQUEST FROM POPUP
// ==========================================

browser.runtime.onMessage.addListener((message) => {

    if (message.type === "GET_PROBLEM_INFO") {

        browser.runtime.sendMessage({
            type: "PROBLEM_INFO",
            data: problemInfo
        });

    }

});