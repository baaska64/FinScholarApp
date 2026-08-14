const fs = require('fs');
const path = require('path');

const files = [
    'app/(tabs)/index.tsx',
    'app/(tabs)/grades.tsx',
    'app/(tabs)/schedule.tsx',
    'app/(tabs)/calendar.tsx',
    'app/(tabs)/requirements.tsx',
    'app/(tabs)/flashcards.tsx'
];

for (const file of files) {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) continue;
    let content = fs.readFileSync(fullPath, 'utf8');

    // 1. Change paddingHorizontal: 24 to 16 in the header
    // The header view usually has: paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16
    // Or paddingHorizontal: 24, paddingVertical: 16
    content = content.replace(/paddingHorizontal:\s*24(,\s*padding(Top|Vertical):\s*16,\s*paddingBottom:\s*16,\s*zIndex:\s*10)/g, 'paddingHorizontal: 16$1');
    content = content.replace(/paddingHorizontal:\s*24(,\s*paddingVertical:\s*16,\s*zIndex:\s*10)/g, 'paddingHorizontal: 16$1');
    content = content.replace(/paddingHorizontal:\s*24(,\s*paddingBottom:\s*18,\s*paddingTop:\s*0)/g, 'paddingHorizontal: 16$1'); // schedule list header?

    // 2. Add adjustsFontSizeToFit and minimumFontScale to the title text
    // Example: <Text numberOfLines={1} style={{ ...Typography.title
    content = content.replace(/<Text numberOfLines=\{1\} style=\{\{\s*\.\.\.Typography\.title([^>]*)>\s*(.*?)\s*<\/Text>/g, '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ ...Typography.title$1>$2</Text>');

    // 3. Change gap: 12 to gap: 8 in the right side icon container
    content = content.replace(/gap:\s*12(\s*\}\}>)/g, 'gap: 8$1');

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('Fixed', file);
}
