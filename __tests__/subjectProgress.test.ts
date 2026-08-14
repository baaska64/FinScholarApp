/**
 * Unit test for subject task progress calculation formula in FinScholar Dashboard Redesign (Milestone 2 - R2)
 */

export interface Requirement {
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'submitted' | 'graded';
    dueDate?: string;
}

export interface Subject {
    id: string;
    code?: string;
    name: string;
    units: number;
    requirements?: Requirement[];
}

export function calculateSubjectTaskProgress(subject: Subject) {
    const requirements = subject.requirements || [];
    const totalTasks = requirements.length;
    const completedTasks = requirements.filter(
        (req) => req.status === 'submitted' || req.status === 'graded'
    ).length;

    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const progressText = `${completedTasks}/${totalTasks} tasks (${progressPercent}%)`;

    return {
        completedTasks,
        totalTasks,
        progressPercent,
        progressText,
    };
}

// Test suite runner
export function runSubjectProgressTests() {
    const results: { name: string; passed: boolean; error?: string }[] = [];

    const testCases = [
        {
            name: 'Gracefully handle 0 total tasks (0/0 tasks (0%))',
            subject: { id: 's1', name: 'Math 101', units: 3, requirements: [] },
            expected: { completedTasks: 0, totalTasks: 0, progressPercent: 0, progressText: '0/0 tasks (0%)' },
        },
        {
            name: 'Gracefully handle undefined requirements (0/0 tasks (0%))',
            subject: { id: 's2', name: 'Physics 101', units: 4 },
            expected: { completedTasks: 0, totalTasks: 0, progressPercent: 0, progressText: '0/0 tasks (0%)' },
        },
        {
            name: '3/5 completed tasks (3/5 tasks (60%))',
            subject: {
                id: 's3',
                name: 'CS 101',
                units: 3,
                requirements: [
                    { id: 'r1', title: 'HW 1', status: 'graded' },
                    { id: 'r2', title: 'HW 2', status: 'submitted' },
                    { id: 'r3', title: 'HW 3', status: 'pending' },
                    { id: 'r4', title: 'HW 4', status: 'graded' },
                    { id: 'r5', title: 'HW 5', status: 'in_progress' },
                ],
            },
            expected: { completedTasks: 3, totalTasks: 5, progressPercent: 60, progressText: '3/5 tasks (60%)' },
        },
        {
            name: 'All tasks completed (4/4 tasks (100%))',
            subject: {
                id: 's4',
                name: 'Eng 101',
                units: 3,
                requirements: [
                    { id: 'r1', title: 'Essay 1', status: 'graded' },
                    { id: 'r2', title: 'Essay 2', status: 'graded' },
                    { id: 'r3', title: 'Essay 3', status: 'submitted' },
                    { id: 'r4', title: 'Essay 4', status: 'submitted' },
                ],
            },
            expected: { completedTasks: 4, totalTasks: 4, progressPercent: 100, progressText: '4/4 tasks (100%)' },
        },
        {
            name: 'No tasks completed out of 3 (0/3 tasks (0%))',
            subject: {
                id: 's5',
                name: 'Bio 101',
                units: 3,
                requirements: [
                    { id: 'r1', title: 'Lab 1', status: 'pending' },
                    { id: 'r2', title: 'Lab 2', status: 'in_progress' },
                    { id: 'r3', title: 'Lab 3', status: 'pending' },
                ],
            },
            expected: { completedTasks: 0, totalTasks: 3, progressPercent: 0, progressText: '0/3 tasks (0%)' },
        },
    ];

    for (const tc of testCases) {
        try {
            const actual = calculateSubjectTaskProgress(tc.subject as Subject);
            if (
                actual.completedTasks === tc.expected.completedTasks &&
                actual.totalTasks === tc.expected.totalTasks &&
                actual.progressPercent === tc.expected.progressPercent &&
                actual.progressText === tc.expected.progressText
            ) {
                results.push({ name: tc.name, passed: true });
            } else {
                results.push({
                    name: tc.name,
                    passed: false,
                    error: `Expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(actual)}`,
                });
            }
        } catch (e: any) {
            results.push({ name: tc.name, passed: false, error: e.message });
        }
    }

    return results;
}

if (require.main === module) {
    const res = runSubjectProgressTests();
    console.log('Subject Progress Tests Result:');
    console.log(JSON.stringify(res, null, 2));
    const failed = res.filter((r) => !r.passed);
    if (failed.length > 0) {
        process.exit(1);
    }
}
