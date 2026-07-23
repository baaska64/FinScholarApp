// Timezone behavior verification script

function testTimezone(tzName) {
    process.env.TZ = tzName;
    console.log(`\n--- Testing Timezone: ${tzName} ---`);
    console.log(`Current process timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    
    // Simulate user picking July 20, 2026 on a DatePicker.
    // Date picker returns a Date object set to local midnight or local time.
    // In React Native/Web, new Date(2026, 6, 20) represents July 20 local time.
    const selectedDate = new Date(2026, 6, 20); 
    console.log(`Selected Date (local): ${selectedDate.toString()}`);
    console.log(`Selected Date (ISO): ${selectedDate.toISOString()}`);
    
    // How the codebase saves the date:
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    console.log(`Saved Date String: ${dateStr}`);
    
    // How it compares:
    const expectedStr = '2026-07-20';
    const isCorrect = dateStr === expectedStr;
    console.log(`Result: ${isCorrect ? 'PASS' : 'FAIL'} (Expected ${expectedStr}, got ${dateStr})`);
}

testTimezone('America/New_York');
testTimezone('Australia/Melbourne');
testTimezone('UTC');
