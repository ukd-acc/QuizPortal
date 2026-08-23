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
// If the file doesn't exist, return null instead of throwing an error.
async function loadJSON(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load " + path);
    return JSON.parse(stripJsonComments(await res.text()));
  } catch (error) {
    console.warn(`Warning: ${error.message}`);
    return null; // Return null if the file doesn't exist or fails to load
  }
}
