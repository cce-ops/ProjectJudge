const fs = require('fs');
const pdfjsLib = require('pdfjs-dist');
const path = 'C:/Users/chris/Desktop/ProyectJudge.pdf';

(async () => {
  const data = new Uint8Array(fs.readFileSync(path));
  const pdf = await pdfjsLib.getDocument({data}).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push({page: i, text: content.items.map(item => item.str || '').join(' ')});
  }
  console.log(JSON.stringify(pages, null, 2));
})();
