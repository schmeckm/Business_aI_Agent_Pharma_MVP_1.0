document.getElementById("send").addEventListener("click", async () => {
  const button = document.getElementById("send");
  const message = document.getElementById("message").value;
  const prompt = document.getElementById("prompt").value;

  let finalMessage = message || prompt;

  if (!finalMessage) {
    alert("Please select a template or enter a command.");
    return;
  }

  // Disable button while processing
  button.disabled = true;
  button.textContent = "Processing...";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: finalMessage }),
    });

    const data = await res.json();

    // System Log (right side)
    const log = document.getElementById("out");
    log.textContent += `\n\n[${data.timestamp}] USER: ${finalMessage}\nAI: ${data.response}\n`;

    // AI Response Box (under button)
    document.getElementById("claude-text").innerText =
      data.claudeResponse || data.response || "No response from Claude.";
    document.getElementById("claude-response").style.display = "block";
  } catch (err) {
    console.error("Error:", err);
    alert("Failed to get response from AI agent.");
  } finally {
    // Re-enable button
    button.disabled = false;
    button.textContent = "Execute Manufacturing Command";
  }
});

function clearOutput() {
  document.getElementById("out").textContent = "System log cleared...";
}
