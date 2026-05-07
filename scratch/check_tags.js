const fs = require('fs');
const content = fs.readFileSync('frontend/frontend/src/pages/Post.jsx', 'utf8');

const tags = [];
const regex = /<\/?([a-zA-Z0-9]+)/g;
let match;
while ((match = regex.exec(content)) !== null) {
    const tag = match[1];
    if (match[0].startsWith('</')) {
        const last = tags.pop();
        if (last !== tag) {
            console.log(`Mismatch: open ${last}, close ${tag} at index ${match.index}`);
        }
    } else {
        // Skip self-closing tags (simplified)
        if (!content.slice(match.index, content.indexOf('>', match.index)).endsWith('/')) {
            tags.push(tag);
        }
    }
}
console.log('Unclosed tags:', tags);
