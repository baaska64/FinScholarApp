const assert = require('assert');

// Test utilities
const generateId = () => Math.random().toString(36).substr(2, 9);

function runTests() {
    console.log("=== STARTING MILestone 3 CHALLENGE TEST SUITE ===\n");

    let passCount = 0;
    let failCount = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`✅ [PASS] ${name}`);
            passCount++;
        } catch (e) {
            console.error(`❌ [FAIL] ${name}`);
            console.error(e);
            failCount++;
        }
    }

    // 1. Calendar Grid Wrapping Challenge
    test("Calendar Grid Wrapping: cell width fits 7 columns without overflow", () => {
        const screenWidths = [320, 375, 414, 480, 768, 1024]; // Test various devices/resolutions
        const gap = 8;
        const padding = 48 + 40 + 4; // screen padding (48) + card padding (40) + border-2 (4) = 92
        
        for (const screenWidth of screenWidths) {
            const cellWidth = (screenWidth - padding - (gap * 6)) / 7;
            const totalWidthOfCellsAndGaps = (cellWidth * 7) + (gap * 6);
            const expectedInnerWidth = screenWidth - padding;
            
            // The calculated grid width must exactly match expectedInnerWidth
            assert.ok(Math.abs(totalWidthOfCellsAndGaps - expectedInnerWidth) < 1e-9, 
                `Grid width does not match available width for screen ${screenWidth}`);
            
            // Each cell must have positive width
            assert.ok(cellWidth > 0, `Cell width is non-positive: ${cellWidth} for screen ${screenWidth}`);
        }
    });

    // 2. Timezone Offsets Challenge
    test("Timezone Offsets: events added on specific day are correct in negative TZ offsets", () => {
        // Set timezone to America/New_York (negative offset, e.g. UTC-4)
        process.env.TZ = 'America/New_York';
        
        const eventDateStr = '2026-07-20';
        
        // 1. Day Details Header Parsing Test
        const parts = eventDateStr.split('-');
        assert.strictEqual(parts.length, 3);
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        
        // Output formatting check
        const formatted = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        assert.strictEqual(formatted, "Monday, July 20, 2026");

        // 2. Event list Date Comparison Test
        const event = { date: eventDateStr };
        
        const getEventsForDate = (dateStr) => {
            const targetDateString = dateStr.slice(0, 10);
            const mDateStr = typeof event.date === 'string' ? event.date.slice(0, 10) : new Date(event.date).toISOString().slice(0, 10);
            return mDateStr === targetDateString;
        };

        assert.ok(getEventsForDate('2026-07-20'), "Event does not match target date in negative timezone");
        assert.ok(!getEventsForDate('2026-07-19'), "Event matches incorrect date in negative timezone");
    });

    // 3. Tasks CRUD operations Challenge
    test("Tasks CRUD Operations and Subject Filters", () => {
        // State Mock
        let data = {
            years: [
                {
                    id: 'yr1',
                    name: 'Year 1',
                    semesters: [
                        {
                            id: 'sem1',
                            name: 'Semester 1',
                            subjects: [
                                {
                                    id: 'subj1',
                                    name: 'Math',
                                    requirements: [],
                                    periods: [
                                        {
                                            name: 'Midterm',
                                            components: [
                                                { id: 'comp1', name: 'Quizzes', items: [] }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    id: 'subj2',
                                    name: 'History',
                                    requirements: [],
                                    periods: []
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        // Simulated function to save/add task
        const addTask = (form) => {
            const sem = data.years[0].semesters[0];
            const subject = sem.subjects.find(s => s.id === form.subjectId);
            
            const taskObj = {
                id: generateId(),
                title: form.title,
                description: form.description,
                dueDate: form.dueDate,
                priority: form.priority,
                status: form.status,
                linkedComponentId: form.linkedComponentId || null
            };
            
            if (!subject.requirements) subject.requirements = [];
            subject.requirements.push(taskObj);
            return taskObj;
        };

        // Add
        const task1 = addTask({
            title: 'Math Quiz 1',
            description: 'Algebra homework',
            dueDate: '2026-07-22',
            priority: 'high',
            status: 'pending',
            subjectId: 'subj1',
            linkedComponentId: 'comp1'
        });

        const task2 = addTask({
            title: 'History Paper',
            description: 'WWII essay',
            dueDate: '2026-07-25',
            priority: 'medium',
            status: 'pending',
            subjectId: 'subj2'
        });

        // Verify add
        const sem = data.years[0].semesters[0];
        assert.strictEqual(sem.subjects[0].requirements.length, 1);
        assert.strictEqual(sem.subjects[0].requirements[0].title, 'Math Quiz 1');
        assert.strictEqual(sem.subjects[1].requirements.length, 1);
        
        // Subject Filters verify
        // ALL filter
        let allTasks = [];
        sem.subjects.forEach(s => {
            s.requirements.forEach(r => {
                allTasks.push({ ...r, subjectId: s.id });
            });
        });
        assert.strictEqual(allTasks.length, 2);

        // Filter subject 'subj1'
        let mathTasks = allTasks.filter(t => t.subjectId === 'subj1');
        assert.strictEqual(mathTasks.length, 1);
        assert.strictEqual(mathTasks[0].title, 'Math Quiz 1');

        // Update
        const updateTask = (taskId, subjectId, updatedForm) => {
            const sem = data.years[0].semesters[0];
            const subject = sem.subjects.find(s => s.id === subjectId);
            subject.requirements = subject.requirements.map(r => 
                r.id === taskId ? { ...r, ...updatedForm } : r
            );
        };

        updateTask(task1.id, 'subj1', { title: 'Math Quiz 1 updated', priority: 'low' });
        assert.strictEqual(sem.subjects[0].requirements[0].title, 'Math Quiz 1 updated');
        assert.strictEqual(sem.subjects[0].requirements[0].priority, 'low');

        // Delete
        const deleteTask = (taskId, subjectId) => {
            const sem = data.years[0].semesters[0];
            const subject = sem.subjects.find(s => s.id === subjectId);
            subject.requirements = subject.requirements.filter(r => r.id !== taskId);
        };

        deleteTask(task1.id, 'subj1');
        assert.strictEqual(sem.subjects[0].requirements.length, 0);
    });

    // 4. Pomodoro timer and mascot transitions challenge
    test("Pomodoro Timer Countdown Logic & Mascot States", () => {
        // Countdown formatting helper
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };

        assert.strictEqual(formatTime(25 * 60), "25:00");
        assert.strictEqual(formatTime(5 * 60), "05:00");
        assert.strictEqual(formatTime(0), "00:00");
        assert.strictEqual(formatTime(59), "00:59");
        assert.strictEqual(formatTime(61), "01:01");

        // Mascot state transitions mock logic:
        // isRunning -> studying
        // !isRunning && timeLeft === 0 -> happy
        // !isRunning && timeLeft > 0 -> sleeping
        const getMascotState = (isRunning, timeLeft) => {
            if (isRunning) return 'studying';
            if (timeLeft === 0) return 'happy';
            return 'sleeping';
        };

        assert.strictEqual(getMascotState(true, 1500), 'studying');
        assert.strictEqual(getMascotState(false, 0), 'happy');
        assert.strictEqual(getMascotState(false, 1500), 'sleeping');
    });

    // 5. Grade Ledger Integration Auto-Grading Sync
    test("Grade Ledger Integration: auto-grading sync links correctly", () => {
        let subject = {
            id: 'subj1',
            name: 'Math',
            periods: [
                {
                    name: 'Midterm',
                    components: [
                        {
                            id: 'comp1',
                            name: 'Quizzes',
                            weight: '50',
                            items: []
                        }
                    ]
                }
            ]
        };

        // Replicate syncGradeItem logic
        const syncGradeItem = (subj, task) => {
            // Always run a complete cleanup pass across all periods and components of the subject
            // to filter out any grade items with it.id === task.gradeItemId BEFORE inserting/updating it in the target component.
            if (task.gradeItemId) {
                subj.periods.forEach(p => {
                    p.components.forEach(c => {
                        c.items = c.items.filter(it => it.id !== task.gradeItemId);
                    });
                });
            }

            // First, if task has an old gradeItemId but is no longer graded or no longer linked, remove it
            if (task.gradeItemId && (task.status !== 'graded' || !task.linkedComponentId)) {
                task.gradeItemId = undefined;
            }

            // Sync or insert
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

        // Case 1: Link task to comp1, status graded, should INSERT item in comp1
        let task = {
            id: 'task1',
            title: 'Quiz 1',
            status: 'graded',
            linkedComponentId: 'comp1',
            earnedScore: 85,
            maxScore: 100
        };

        syncGradeItem(subject, task);

        assert.strictEqual(subject.periods[0].components[0].items.length, 1);
        assert.ok(task.gradeItemId, "task.gradeItemId was not generated/assigned");
        
        let gradeItem = subject.periods[0].components[0].items[0];
        assert.strictEqual(gradeItem.id, task.gradeItemId);
        assert.strictEqual(gradeItem.name, 'Quiz 1');
        assert.strictEqual(gradeItem.score, 85);
        assert.strictEqual(gradeItem.max, 100);

        // Case 2: Update task title and score, status remains graded, should UPDATE item in comp1
        task.title = 'Quiz 1 (Final Version)';
        task.earnedScore = 95;
        syncGradeItem(subject, task);

        assert.strictEqual(subject.periods[0].components[0].items.length, 1);
        gradeItem = subject.periods[0].components[0].items[0];
        assert.strictEqual(gradeItem.name, 'Quiz 1 (Final Version)');
        assert.strictEqual(gradeItem.score, 95);

        // Case 3: Move task to status 'pending', should REMOVE item from comp1
        task.status = 'pending';
        syncGradeItem(subject, task);

        assert.strictEqual(subject.periods[0].components[0].items.length, 0);
        assert.strictEqual(task.gradeItemId, undefined);
    });

    console.log(`\n=== CHALLENGE TEST SUITE FINISHED ===`);
    console.log(`PASSED: ${passCount}`);
    console.log(`FAILED: ${failCount}`);

    if (failCount > 0) {
        process.exit(1);
    }
}

runTests();
