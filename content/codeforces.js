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


// The signed-in account link is inside Codeforces' page header.
function getLoggedInHandle() {
    const profileLink = Array.from(
        document.querySelectorAll("#header a[href]")
    ).find((link) => {
        try {
            return new URL(link.href, window.location.origin).pathname
                .startsWith("/profile/");
        } catch (error) {
            return false;
        }
    });

    if (!profileLink) {
        return null;
    }

    const profilePath = new URL(profileLink.href, window.location.origin).pathname;
    const handle = profilePath.match(/^\/profile\/([^/]+)/);
    return handle ? decodeURIComponent(handle[1]) : null;
}


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


// Respond to a direct request from the background script. Returning a Promise
// makes the response work with Firefox's WebExtension messaging API.

browser.runtime.onMessage.addListener((message) => {

    if (message.type === "GET_PROBLEM_INFO") {
        return Promise.resolve({
            url: problemInfo.url,
            contestId: problemInfo.contestId,
            problemIndex: problemInfo.problemIndex,
            rating: problemInfo.rating,
            handle: getLoggedInHandle()
        });
    }

    return undefined;
});
