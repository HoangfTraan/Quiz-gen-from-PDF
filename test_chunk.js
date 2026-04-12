const text = "A".repeat(1600); // 1600 chars without any space
const chunkSize = 1500;
const overlap = 200;
let chunks = [];
let startIndex = 0;
let index = 1;
let iterations = 0;

while (startIndex < text.length) {
    if (iterations++ > 100) {
        console.log("INFINITE LOOP DETECTED");
        break;
    }
    
    let endIndex = startIndex + chunkSize;
    if (endIndex < text.length) {
        const spaceIndex = text.lastIndexOf(' ', endIndex);
        const newlineIndex = text.lastIndexOf('\n', endIndex);
        let candidateEndIndex = newlineIndex > startIndex + chunkSize / 2 ? newlineIndex : spaceIndex;
        
        // Prevent infinite/micro loops: Ensure the cut advances at least half the chunk size.
        // If no good space/newline is found, hard cut at `endIndex`.
        if (candidateEndIndex > startIndex + chunkSize / 2) {
            endIndex = candidateEndIndex;
        }
    }
    // Safety check to absolutely prevent infinite loops via fallback regression
    if (endIndex <= startIndex) endIndex = startIndex + chunkSize;

    chunks.push({ chunk_index: index, content: text.substring(startIndex, endIndex).trim() });
    
    console.log(`Iter ${iterations}: start=${startIndex}, end=${endIndex}, next_start=${endIndex - overlap}`);
    
    startIndex = endIndex - overlap;
    index++;
}
console.log("Chunks generated:", chunks.length);
