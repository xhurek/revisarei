const mediaFiles = {
    'paste-123.jpg': 'data:image/jpeg;base64,xxxx',
    'my image.png': 'data:image/png;base64,yyyy'
};

const text1 = '<img src="paste-123.jpg" />';
const text2 = '<IMG SRC="my%20image.png">';
const text3 = '<img src=paste-123.jpg>';
const text4 = '<img src="https://example.com/image.jpg" />';

const replaceMedia = (text) => {
    return text.replace(/<img[^>]+src=\s*(?:(["'])([^"']+)\1|([^\s>]+))/gi, (match, quote, src1, src2) => {
        const src = src1 || src2;
        if (!src || src.startsWith('data:') || src.startsWith('http')) return match;
        
        const decodedSrc = decodeURIComponent(src).toLowerCase();
        const lowerSrc = src.toLowerCase();
        
        let foundMedia = mediaFiles[decodedSrc] || mediaFiles[lowerSrc];
        
        if (foundMedia) {
            // Reconstruct the match replacing the src
            // But match can be anything, we just replace the src part
            // It's easier to just do a substring replacement inside the match
            return match.replace(src, foundMedia);
        }
        return match;
    });
};

console.log(replaceMedia(text1));
console.log(replaceMedia(text2));
console.log(replaceMedia(text3));
console.log(replaceMedia(text4));
