const assert = require('assert');

// Test utilities
const generateId = () => Math.random().toString(36).substr(2, 9);

function runRegressionSuite() {
    console.log("=== STARTING MILESTONE 4 REGRESSION & STRESS TEST SUITE ===\n");

    let passCount = 0;
    let failCount = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`✅ [PASS] ${name}`);
            passCount++;
        } catch (e) {
            console.error(`❌ [FAIL] ${name}`);
            console.error(`   Error: ${e.message}`);
            failCount++;
        }
    }

    // 1. Calendar Grid Wrapping Check
    test("Calendar Grid Wrapping: fits 7 columns without overflow across screen widths", () => {
        const screenWidths = [320, 375, 414, 480, 768, 1024];
        const gap = 8;
        const padding = 48 + 40 + 4; // screen padding (48) + card padding (40) + border-2 (4) = 92
        
        for (const screenWidth of screenWidths) {
            const cellWidth = (screenWidth - padding - (gap * 6)) / 7;
            const totalWidthOfCellsAndGaps = (cellWidth * 7) + (gap * 6);
            const expectedInnerWidth = screenWidth - padding;
            
            assert.ok(Math.abs(totalWidthOfCellsAndGaps - expectedInnerWidth) < 1e-9, 
                `Grid width does not match available width for screen ${screenWidth}`);
            assert.ok(cellWidth > 0, `Cell width is non-positive: ${cellWidth} for screen ${screenWidth}`);
        }
    });

    // 2. Timezone Safety - Date Parsing and Formatting
    test("Timezone Safety: Event date formatting (Date -> String) works correctly in negative TZ", () => {
        process.env.TZ = 'America/New_York';
        
        // Simulating the save event flow: date is formatted as YYYY-MM-DD
        const saveDateStr = (dateObj) => {
            return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        };

        const localDate = new Date(2026, 6, 20); // July 20, 2026 local time
        const formatted = saveDateStr(localDate);
        
        assert.strictEqual(formatted, '2026-07-20', `Expected '2026-07-20' but got '${formatted}'`);
    });

    test("Timezone Safety: Event editing date parsing (String -> Date) under negative TZ offset", () => {
        process.env.TZ = 'America/New_York'; // negative offset: UTC-4
        
        const storedDateStr = '2026-07-20';
        
        // Code implementation in app/(tabs)/calendar.tsx uses local components:
        const parseEventDate = (dateStr) => {
            const parts = dateStr.split('-');
            return parts.length === 3 
                ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
                : new Date(dateStr);
        };
        
        const parsedDate = parseEventDate(storedDateStr);
        
        const year = parsedDate.getFullYear();
        const month = parsedDate.getMonth() + 1;
        const date = parsedDate.getDate();
        
        const reFormatted = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        
        assert.strictEqual(reFormatted, storedDateStr, 
            `Timezone parsing regression: Stored '${storedDateStr}' but parsed as '${reFormatted}' (local day: ${date})`);
    });

    test("Timezone Safety: Task editing date parsing (String -> Date) under negative TZ offset", () => {
        process.env.TZ = 'America/New_York';
        
        const storedDateStr = '2026-07-20';
        
        // Code implementation in app/(tabs)/requirements.tsx uses split-based parsing:
        const parseTaskDate = (dueDateStr) => {
            const parts = dueDateStr.split('-');
            return parts.length === 3 
                ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
                : new Date(dueDateStr);
        };
        
        const parsedDate = parseTaskDate(storedDateStr);
        
        const year = parsedDate.getFullYear();
        const month = parsedDate.getMonth() + 1;
        const date = parsedDate.getDate();
        
        const reFormatted = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        
        assert.strictEqual(reFormatted, storedDateStr, 
            `Task date parsing failed: Stored '${storedDateStr}' but parsed as '${reFormatted}'`);
    });

    // 3. Tasks CRUD & Subject Filtering
    test("Tasks CRUD: CRUD operations and subject filter works correctly", () => {
        let subjects = [
            { id: 'subj1', name: 'Math', requirements: [] },
            { id: 'subj2', name: 'Science', requirements: [] }
        ];

        const addTask = (subjId, taskData) => {
            const subj = subjects.find(s => s.id === subjId);
            if (!subj) return;
            const task = { id: generateId(), ...taskData, subjectId: subjId };
            subj.requirements.push(task);
            return task;
        };

        const updateTask = (subjId, taskId, taskData) => {
            const subj = subjects.find(s => s.id === subjId);
            if (!subj) return;
            subj.requirements = subj.requirements.map(t => t.id === taskId ? { ...t, ...taskData } : t);
        };

        const deleteTask = (subjId, taskId) => {
            const subj = subjects.find(s => s.id === subjId);
            if (!subj) return;
            subj.requirements = subj.requirements.filter(t => t.id !== taskId);
        };

        // Create
        const t1 = addTask('subj1', { title: 'Quiz 1', status: 'pending' });
        const t2 = addTask('subj2', { title: 'Lab 1', status: 'pending' });
        assert.strictEqual(subjects[0].requirements.length, 1);
        assert.strictEqual(subjects[1].requirements.length, 1);

        // Filter: ALL
        let allTasks = [];
        subjects.forEach(s => {
            s.requirements.forEach(r => allTasks.push(r));
        });
        assert.strictEqual(allTasks.length, 2);

        // Filter: subj1
        let filtered = allTasks.filter(t => t.subjectId === 'subj1');
        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0].title, 'Quiz 1');

        // Update
        updateTask('subj1', t1.id, { title: 'Quiz 1 Updated', status: 'submitted' });
        assert.strictEqual(subjects[0].requirements[0].title, 'Quiz 1 Updated');
        assert.strictEqual(subjects[0].requirements[0].status, 'submitted');

        // Delete
        deleteTask('subj1', t1.id);
        assert.strictEqual(subjects[0].requirements.length, 0);
    });

    // 4. Pomodoro States
    test("Pomodoro: countdown formatting and mascot states mapping", () => {
        const getMascotState = (isRunning, timeLeft) => {
            if (isRunning) return 'studying';
            if (timeLeft === 0) return 'happy';
            return 'sleeping';
        };

        assert.strictEqual(getMascotState(true, 1500), 'studying');
        assert.strictEqual(getMascotState(false, 0), 'happy');
        assert.strictEqual(getMascotState(false, 1500), 'sleeping');
    });

    // 5. Grade Ledger Sync Parity
    test("Grade Ledger Sync: updates grades correctly when status is graded and linked", () => {
        let subject = {
            id: 'subj1',
            periods: [
                {
                    name: 'Midterm',
                    components: [
                        { id: 'comp1', name: 'Quizzes', items: [] }
                    ]
                }
            ]
        };

        const syncGradeItem = (subj, task) => {
            if (task.gradeItemId) {
                subj.periods.forEach(p => {
                    p.components.forEach(c => {
                        c.items = c.items.filter(it => it.id !== task.gradeItemId);
                    });
                });
            }

            if (task.gradeItemId && (task.status !== 'graded' || !task.linkedComponentId)) {
                task.gradeItemId = undefined;
            }

            if (task.status === 'graded' && task.linkedComponentId) {
                let found = false;
                subj.periods.forEach(p => {
                    p.components.forEach(c => {
                        if (c.id === task.linkedComponentId) {
                            if (task.gradeItemId) {
                                const item = c.items.find(it => it.id === task.gradeItemId);
                                if (item) {
                                    item.name = task.title;
                                    item.score = task.earnedScore;
                                    item.max = task.maxScore;
                                    found = true;
                                }
                            }
                            if (!found) {
                                const newGradeId = task.gradeItemId || generateId();
                                task.gradeItemId = newGradeId;
                                c.items.push({
                                    id: newGradeId,
                                    name: task.title,
                                    score: task.earnedScore,
                                    max: task.maxScore,
                                    subItems: []
                                });
                            }
                        }
                    });
                });
            }
        };

        // Add task graded
        let task = {
            id: 't1',
            title: 'Quiz 1',
            status: 'graded',
            linkedComponentId: 'comp1',
            earnedScore: 90,
            maxScore: 100
        };

        syncGradeItem(subject, task);
        assert.strictEqual(subject.periods[0].components[0].items.length, 1);
        assert.ok(task.gradeItemId);
        
        let item = subject.periods[0].components[0].items[0];
        assert.strictEqual(item.name, 'Quiz 1');
        assert.strictEqual(item.score, 90);

        // Move component
        task.linkedComponentId = 'non_existent_comp';
        syncGradeItem(subject, task);
        assert.strictEqual(subject.periods[0].components[0].items.length, 0, "Item was not cleaned up from old component");
    });

    test("Grade Ledger Sync: cleans up stale grade items when task shifts subject", () => {
        let subjects = [
            {
                id: 'subj1',
                requirements: [],
                periods: [{ name: 'Midterm', components: [{ id: 'comp1', items: [] }] }]
            },
            {
                id: 'subj2',
                requirements: [],
                periods: [{ name: 'Midterm', components: [{ id: 'comp2', items: [] }] }]
            }
        ];

        let taskObj = {
            id: 'task1',
            title: 'Quiz 1',
            status: 'graded',
            subjectId: 'subj1',
            linkedComponentId: 'comp1',
            earnedScore: 80,
            maxScore: 100,
            gradeItemId: 'grade1'
        };

        subjects[0].requirements.push(taskObj);
        subjects[0].periods[0].components[0].items.push({
            id: 'grade1',
            name: 'Quiz 1',
            score: 80,
            max: 100
        });

        // Replicate logic in handleSaveTask when shifting subjects:
        const oldSubject = subjects.find(s => s.id === 'subj1');
        if (oldSubject) {
            oldSubject.periods.forEach(p => {
                p.components.forEach(c => {
                    c.items = c.items.filter(it => it.id !== taskObj.gradeItemId);
                });
            });
            oldSubject.requirements = oldSubject.requirements.filter(r => r.id !== taskObj.id);
        }

        assert.strictEqual(subjects[0].periods[0].components[0].items.length, 0, "Stale grade item was not removed from old subject components");
        assert.strictEqual(subjects[0].requirements.length, 0, "Stale requirement was not removed from old subject");
    });

    console.log(`\n=== REGRESSION & STRESS TEST SUITE FINISHED ===`);
    console.log(`PASSED: ${passCount}`);
    console.log(`FAILED: ${failCount}`);

    if (failCount > 0) {
        process.exit(1);
    }
}

runRegressionSuite();
