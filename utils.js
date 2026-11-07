// Shorthand for querySelector (like a DOM pointer grab).
function qs(sel) { return document.querySelector(sel); }

// Shorthand for querySelectorAll (returns array of elements).
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function stripJsonComments(text) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && !escaped) {
      inString = !inString;
    }

    if (!inString && character === "/" && nextCharacter === "/") {
      while (index < text.length && text[index] !== "\n") index++;
      result += "\n";
      continue;
    }

    result += character;
    escaped = character === "\\" && !escaped;
    if (character !== "\\") escaped = false;
  }

  return result;
}

// Load JSON file asynchronously.
// If the file doesn't exist or takes too long, return null instead of throwing.
const JSON_REQUEST_TIMEOUT_MS = 15000;

async function loadJSON(path, timeoutMs = JSON_REQUEST_TIMEOUT_MS) {
  let timeoutId;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(path, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error("Failed to load " + path);
    return JSON.parse(stripJsonComments(await res.text()));
  } catch (error) {
    console.warn(`Warning: ${error.message}`);
    return null; // Return null if the file doesn't exist or fails to load
  } finally {
    if (typeof timeoutId !== "undefined") clearTimeout(timeoutId);
  }
}
