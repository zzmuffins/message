// --- CONFIG ---
const SPREADSHEET_ID = "10wYAPk1b0IedZ8EApX7eQGEq-WoFk8uAIrUV-TRFx7s";
const SHEETS_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;
const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScB1Y9hao2ySuZvz1lHeQpKW7onTEjkfa5zBdjQo4lTE-s0nA/formResponse";
const ENTRY_ID = "entry.1637793584";
const COOLDOWN_MS = 10000;

// Universal CSV parser that handles newlines, commas, and quotes inside cells
function parseCSV(text) {
    let rows = [];
    let row = [''];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        let next = text[i + 1];

        if (c === '"') {
            if (inQuotes && next === '"') { row[row.length - 1] += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (c === ',' && !inQuotes) {
            row.push('');
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') { i++; }
            if (row.length > 1 || row[0] !== '') rows.push(row);
            row = [''];
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
}

async function loadAnswers() {
    const feedContainer = document.getElementById("qa-feed");
    const outerFeedContainer = document.querySelector(".feed-container");

    // Remove class at start of fetch/refresh
    if (outerFeedContainer) {
        outerFeedContainer.classList.remove("has-content");
    }

    try {
        const response = await fetch(SHEETS_URL);
        if (!response.ok) throw new Error("Failed to fetch sheet");

        const data = await response.text();
        const rows = parseCSV(data);
        feedContainer.innerHTML = "";

        let answeredCount = 0;

        // Iterate backwards from the last row down to row 1 (skipping headers at index 0)
        for (let i = rows.length - 1; i > 0; i--) {
            const columns = rows[i];
            if (!columns || columns.length < 3) continue;

            const timestamp = columns[0] ? columns[0].trim() : "";
            const question = columns[1] ? columns[1].trim() : "";
            const answer = columns[2] ? columns[2].trim() : "";

            if (answer && answer.length > 0) {
                answeredCount++;

                const card = document.createElement("div");
                card.className = "qa-card";

                const qDiv = document.createElement("div");
                qDiv.className = "question-text";
                qDiv.textContent = question;
                card.appendChild(qDiv);

                const aDiv = document.createElement("div");
                aDiv.className = "answer-text";

                const textBlock = document.createElement("div");
                textBlock.style.flex = "1";
                textBlock.style.overflowWrap = "anywhere";
                textBlock.textContent = answer;
                aDiv.appendChild(textBlock);

                if (timestamp) {
                    const timeDiv = document.createElement("div");
                    timeDiv.className = "qa-time";
                    timeDiv.textContent = timestamp;
                    aDiv.appendChild(timeDiv);
                }

                card.appendChild(aDiv);
                feedContainer.appendChild(card);
            }
        }

        if (answeredCount === 0) {
            feedContainer.innerHTML = "<p style='text-align:center;'>No questions answered yet!</p>";
        } else {
            // ADD IT HERE: Apply class when 1 or more answered cards exist
            if (outerFeedContainer) {
                outerFeedContainer.classList.add("has-content");
            }
        }

    } catch (err) {
        console.error("Sheets parser error:", err);
        feedContainer.innerHTML = "<p style='color:#ff6b6b; text-align:center;'>Failed to load feed.</p>";
    }
}

loadAnswers();

// --- SUBMIT LOGIC ---
async function submitQuestion() {
    const inputField = document.getElementById("question-input");
    const submitBtn = document.getElementById("submit-btn");
    const statusMsg = document.getElementById("status-message");
    const honeypot = document.getElementById("username_hp");
    const questionText = inputField.value.trim();

    if (!questionText) { statusMsg.style.color = "#ff6b6b"; statusMsg.textContent = "Please type something first!"; return; }
    if (honeypot.value !== "") return;

    const lastSubmit = localStorage.getItem("last_qa_submit");
    const now = Date.now();
    if (lastSubmit) {
        const timePassed = now - parseInt(lastSubmit);
        if (timePassed < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - timePassed) / 1000);
            statusMsg.style.color = "#ff6b6b";
            statusMsg.textContent = `Slow down! Wait ${remaining}s.`;
            return;
        }
    }

    submitBtn.disabled = true;
    statusMsg.style.color = "#888"; statusMsg.textContent = "Sending message ...";

    const formData = new FormData();
    formData.append(ENTRY_ID, questionText);

    try {
        await fetch(GOOGLE_FORM_URL, { method: "POST", mode: "no-cors", body: formData });
        localStorage.setItem("last_qa_submit", Date.now().toString());
        inputField.value = "";
        statusMsg.style.color = "#4cd137";
        statusMsg.textContent = "Sent! It'll show below when answered...";
    } catch (error) {
        statusMsg.style.color = "#ff6b6b"; statusMsg.textContent = "Error sending. Try again..?";
    } finally {
        submitBtn.disabled = false;
    }
}