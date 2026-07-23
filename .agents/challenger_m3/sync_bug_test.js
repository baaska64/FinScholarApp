const assert = require('assert');

function runSyncBugTest() {
    console.log("=== RUNNING ADVANCED GRADE SYNC BUG TEST ===");

    const generateId = () => Math.random().toString(36).substr(2, 9);

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
                        items: []
                    },
                    {
                        id: 'comp2',
                        name: 'Exams',
                        items: []
                    }
                ]
            }
        ]
    };

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

    // Step 1: Create task, status graded, linked to comp1
    let taskObj = {
        id: 'task1',
        title: 'Quiz 1',
        status: 'graded',
        linkedComponentId: 'comp1',
        earnedScore: 90,
        maxScore: 100
    };

    syncGradeItem(subject, taskObj);

    // Verify it's in comp1
    console.log("Comp1 items count:", subject.periods[0].components[0].items.length);
    console.log("Comp2 items count:", subject.periods[0].components[1].items.length);
    assert.strictEqual(subject.periods[0].components[0].items.length, 1);
    assert.strictEqual(subject.periods[0].components[1].items.length, 0);

    // Step 2: Edit task, change linkedComponentId to comp2
    taskObj.linkedComponentId = 'comp2';
    syncGradeItem(subject, taskObj);

    // Verify counts
    console.log("After shifting component:");
    console.log("Comp1 items count:", subject.periods[0].components[0].items.length);
    console.log("Comp2 items count:", subject.periods[0].components[1].items.length);
    
    // Check if the item in comp1 was removed:
    const comp1HasItem = subject.periods[0].components[0].items.some(it => it.id === taskObj.gradeItemId);
    const comp2HasItem = subject.periods[0].components[1].items.some(it => it.id === taskObj.gradeItemId);
    console.log("Comp1 has grade item:", comp1HasItem);
    console.log("Comp2 has grade item:", comp2HasItem);
    
    try {
        assert.strictEqual(subject.periods[0].components[0].items.length, 0, "Stale item was NOT removed from comp1!");
        assert.strictEqual(subject.periods[0].components[1].items.length, 1, "Item was not added to comp2!");
        console.log("✅ Component Shift: PASS");
    } catch(e) {
        console.log("❌ Component Shift: FAIL");
        console.error(e.message);
    }
}

runSyncBugTest();
