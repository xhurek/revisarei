const fs = require('fs');

const mediaText = `{"11": "dog.jpg", "12": "cat.png", "image with spaces.jpg": "image with spaces.jpg"}`;
const regex = /"([^"]+)"\s*:\s*"([^"]+)"/g;

let match;
let count = 0;
while ((match = regex.exec(mediaText)) !== null) {
  count++;
}
console.log("Matched:", count);
