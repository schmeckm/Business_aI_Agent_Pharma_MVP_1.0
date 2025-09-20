document.getElementById("send").addEventListener("click", async () => {
  const btn = document.getElementById("send");
  const promptSelect = document.getElementById("prompt").value;
  const messageInput = document.getElementById("message").value;

  // Button → Spinner anzeigen
  btn.innerHTML = `Processing <span class="spinner"></span>`;
  btn.disabled = true;

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: promptSelect || messageInput,
        user: { id: "frontend-user", name: "Web Client" }
      })
    });

    const data = await res.json();

    // Claude Antwort anzeigen
    document.getElementById("claude-text").innerText = data.response;
    document.getElementById("claude-response").style.display = "block";

    // In System-Log schreiben
    const out = document.getElementById("out");
    out.textContent += `\n\n[${new Date().toLocaleTimeString()}] ${data.response}`;
    out.scrollTop = out.scrollHeight;
  } catch (err) {
    console.error("Chat error:", err);
    alert("❌ Fehler beim Senden an Agent-System");
  } finally {
    // Button wiederherstellen
    btn.innerHTML = "Execute Manufacturing Command";
    btn.disabled = false;
  }
});
