const pdfParse = require('pdf-parse');

module.exports = {
  parseText: async function(buffer) {
    const data = await pdfParse(buffer);
    return data.text;
  }
};
