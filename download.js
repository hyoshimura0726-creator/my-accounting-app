import fs from 'fs';

async function downloadFile(url, dest) {
  const res = await fetch(url);
  const text = await res.text();
  if (res.ok) {
    fs.writeFileSync(dest, text);
    console.log(`Downloaded ${url} to ${dest}`);
  } else {
    console.error(`Failed to download ${url}: ${res.statusText}`);
  }
}

async function main() {
  await downloadFile('https://raw.githubusercontent.com/hyoshimura0726-creator/my-accounting-app/main/src/App.tsx', 'src/App.tsx');
  await downloadFile('https://raw.githubusercontent.com/hyoshimura0726-creator/my-accounting-app/main/package.json', 'package.json');
  await downloadFile('https://raw.githubusercontent.com/hyoshimura0726-creator/my-accounting-app/main/src/index.css', 'src/index.css');
  await downloadFile('https://raw.githubusercontent.com/hyoshimura0726-creator/my-accounting-app/main/index.html', 'index.html');
}

main();
