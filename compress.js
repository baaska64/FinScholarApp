const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function run() {
  const dirsToCheck = [
    path.join(__dirname, 'assets', 'images'),
    path.join(__dirname, 'assets', 'store_images')
  ];

  for (const dir of dirsToCheck) {
    if (!fs.existsSync(dir)) continue;
    
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const ext = path.extname(file).toLowerCase();
      const stats = fs.statSync(filePath);

      // Only compress if size > 500KB
      if (stats.size > 500000) {
        if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
          const tempPath = filePath + '.tmp';
          console.log(`Compressing ${file} (${Math.round(stats.size/1024/1024*100)/100} MB)...`);
          try {
            await sharp(filePath)
              .resize({ width: 800, withoutEnlargement: true })
              .png({ quality: 75, compressionLevel: 9, effort: 10 })
              .toFile(tempPath);
            fs.renameSync(tempPath, filePath);
            console.log(`Done ${file}`);
          } catch (err) {
            console.error(`Error with ${file}:`, err);
          }
        } else if (file === 'finanimated.gif') {
          const tempPath = filePath + '.tmp';
          console.log(`Compressing GIF ${file} (${Math.round(stats.size/1024/1024*100)/100} MB)...`);
          try {
            await sharp(filePath, { animated: true })
              .resize({ width: 400, withoutEnlargement: true })
              .gif({ colors: 64, effort: 10 })
              .toFile(tempPath);
            fs.renameSync(tempPath, filePath);
            console.log(`Done ${file}`);
          } catch (err) {
            console.error(`Error with GIF ${file}:`, err);
          }
        }
      }
    }
  }
}

run();
