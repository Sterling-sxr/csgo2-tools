let lastDetectedMatchId = null;

function detectMatchroom() {
  const match = window.location.pathname.match(/\/room\/([^/?#]+)/i);
  const matchId = match?.[1] ?? null;

  if (!matchId || matchId === lastDetectedMatchId) return;

  lastDetectedMatchId = matchId;
  chrome.runtime.sendMessage({
    type: "FACEIT_MATCHROOM_DETECTED",
    matchId,
  });
}

detectMatchroom();
window.addEventListener("popstate", detectMatchroom);
setInterval(detectMatchroom, 750);
