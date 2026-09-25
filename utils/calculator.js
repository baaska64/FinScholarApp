export const Calculator = {
    // Resolves an item's effective percent (0-1). If the item has been split into
    // sub-items, the percent is the weighted average of those sub-items (weights
    // auto-split evenly across any left blank, same rule as every other level).
    // Otherwise it falls back to the item's own score/max.
    computeItemPercent: (item, exclusions = null) => {
        if (item.subItems && item.subItems.length > 0) {
            let sExplicit = 0, sBlank = 0;
            const validSubs = exclusions ? item.subItems.filter(si => !exclusions.has(si.id)) : item.subItems;
            validSubs.forEach(si => {
                if (si.weight !== '' && si.weight !== null && si.weight !== undefined) sExplicit += Number(si.weight) || 0;
                else sBlank++;
            });
            let sAutoWeight = sBlank > 0 ? Math.max(0, 100 - sExplicit) / sBlank : 0;
            let totalSubWeightSum = sExplicit + (sBlank * sAutoWeight);

            let earned = 0;
            let hasAnyInput = false;
            validSubs.forEach(si => {
                const w = (si.weight !== '' && si.weight !== null && si.weight !== undefined) ? Number(si.weight) || 0 : sAutoWeight;
                const wPct = totalSubWeightSum > 0 ? (w / totalSubWeightSum) : 0;
                
                const subRes = Calculator.computeItemPercent(si, exclusions);
                if (!subRes.isEmpty) hasAnyInput = true;
                if (!subRes.isEmpty) {
                    earned += subRes.percent * wPct;
                }
            });
            return { isEmpty: !hasAnyInput, percent: earned };
        }

        const max = Number(item.max) || 0;
        const isEmpty = (item.score === '' || item.score === null || item.score === undefined);
        const score = !isEmpty ? Number(item.score) || 0 : 0;
        return { isEmpty, percent: max > 0 ? (score / max) : 0 };
    },

    interpolateGrade: (percentage, passingPercent, system) => {
        if (system === 'PERCENT') return percentage;
        
        if (percentage >= 100) {
            if (system === '4_IS_BEST') return 4.0;
            return system === '1_IS_BEST' ? 1.0 : 5.0;
        }
        
        if (percentage < passingPercent) {
            const failRatio = Math.max(0, percentage) / passingPercent;
            if (system === '4_IS_BEST') {
                return failRatio * 1.0; 
            } else if (system === '1_IS_BEST') {
                return 5.0 - (failRatio * 2.0); 
            } else { 
                return 1.0 + (failRatio * 2.0); 
            }
        }
        
        const ratio = (percentage - passingPercent) / (100 - passingPercent);
        if (system === '4_IS_BEST') {
            return 1.0 + (ratio * 3.0); 
        } else if (system === '1_IS_BEST') {
            return 3.0 - (ratio * 2.0);
        } else {
            return 3.0 + (ratio * 2.0);
        }
    },

    percentFromGpa: (gpa, passingPercent, system) => {
        passingPercent = Number(passingPercent) || 60;
        
        if (system === 'PERCENT') return gpa;
        
        let isFail = false;
        if (system === '1_IS_BEST' && gpa > 3.0) isFail = true;
        if (system === '4_IS_BEST' && gpa < 1.0) isFail = true;
        if (system === '5_IS_BEST' && gpa < 3.0) isFail = true;

        if (isFail) {
            let failRatio = 0;
            if (system === '1_IS_BEST') {
                failRatio = Math.max(0, (5.0 - gpa) / 2.0);
            } else if (system === '4_IS_BEST') {
                failRatio = Math.max(0, gpa / 1.0);
            } else if (system === '5_IS_BEST') {
                failRatio = Math.max(0, (gpa - 1.0) / 2.0);
            }
            return failRatio * passingPercent;
        }

        let ratio = 0;
        if (system === '4_IS_BEST') {
            ratio = Math.max(0, Math.min(1, (gpa - 1.0) / 3.0));
        } else if (system === '1_IS_BEST') {
            ratio = Math.max(0, Math.min(1, (3.0 - gpa) / 2.0));
        } else if (system === '5_IS_BEST') {
            ratio = Math.max(0, Math.min(1, (gpa - 3.0) / 2.0));
        }
        return passingPercent + (ratio * (100 - passingPercent));
    },
    
    /**
     * `ungraded` decides what a score that has not been entered yet is worth:
     *   'zero'    — nothing (the default): the grade is what is banked so far.
     *   'perfect' — full marks: the best grade still reachable.
     *   'ignore'  — left out: the average of graded work only.
     *   'project' — the student's graded average carried over the rest: the
     *               grade they are on track for. Used for "on track for",
     *               never offered as a setting.
     * Floor, ceiling, pace and projection are returned whatever the mode, so a
     * screen can show the range around the number it leads with.
     */
    calculateSubject: (subject, system, exclusions = null, ungraded = 'zero') => {
        let absoluteEarned = 0;
        let absoluteGraded = 0;
        let emptyTargets = [];
        let absoluteAvailable = 0;
        let hasAnyInput = false;

        let pExplicitSum = 0, pBlankCount = 0;
        const safePeriods = subject.periods || [];
        const validPeriods = exclusions ? safePeriods.filter(p => !exclusions.has(p.id)) : safePeriods;
        validPeriods.forEach(p => {
            if (p.weight !== '' && p.weight !== null && p.weight !== undefined) pExplicitSum += Number(p.weight) || 0;
            else pBlankCount++;
        });
        let pAutoWeight = pBlankCount > 0 ? Math.max(0, 100 - pExplicitSum) / pBlankCount : 0;
        let totalPeriodWeightSum = pExplicitSum + (pBlankCount * pAutoWeight);

        validPeriods.forEach(period => {
            const pWeight = (period.weight !== '' && period.weight !== null && period.weight !== undefined) ? Number(period.weight) || 0 : pAutoWeight;
            const periodPctOfSubject = totalPeriodWeightSum > 0 ? (pWeight / totalPeriodWeightSum) : 0;
            
            let cExplicitSum = 0, cBlankCount = 0;
            const safeComps = period.components || [];
            const validComps = exclusions ? safeComps.filter(c => !exclusions.has(c.id)) : safeComps;
            validComps.forEach(c => {
                if (c.weight !== '' && c.weight !== null && c.weight !== undefined) cExplicitSum += Number(c.weight) || 0;
                else cBlankCount++;
            });
            let cAutoWeight = cBlankCount > 0 ? Math.max(0, 100 - cExplicitSum) / cBlankCount : 0;
            let totalCompWeightSum = cExplicitSum + (cBlankCount * cAutoWeight);

            validComps.forEach(comp => {
                const compWeight = (comp.weight !== '' && comp.weight !== null && comp.weight !== undefined) ? Number(comp.weight) || 0 : cAutoWeight;
                const compPctOfPeriod = totalCompWeightSum > 0 ? (compWeight / totalCompWeightSum) : 0;
                
                let iExplicitSum = 0, iBlankCount = 0;
                const safeItems = comp.items || [];
                const validItems = exclusions ? safeItems.filter(i => !exclusions.has(i.id)) : safeItems;
                validItems.forEach(item => {
                    if (item.weight !== '' && item.weight !== null && item.weight !== undefined) iExplicitSum += Number(item.weight) || 0;
                    else iBlankCount++;
                });

                let iAutoWeight = iBlankCount > 0 ? Math.max(0, 100 - iExplicitSum) / iBlankCount : 0;
                let totalItemWeightSum = iExplicitSum + (iBlankCount * iAutoWeight);

                const traverseItem = (node, nodeAbsWeight, prefixLabel) => {
                    if (node.subItems && node.subItems.length > 0) {
                        let sExplicit = 0, sBlank = 0;
                        const safeSubs = node.subItems || [];
                        const validSubs = exclusions ? safeSubs.filter(si => !exclusions.has(si.id)) : safeSubs;
                        validSubs.forEach(si => {
                            if (si.weight !== '' && si.weight !== null && si.weight !== undefined) sExplicit += Number(si.weight) || 0;
                            else sBlank++;
                        });
                        let sAutoWeight = sBlank > 0 ? Math.max(0, 100 - sExplicit) / sBlank : 0;
                        let totalSubWeightSum = sExplicit + (sBlank * sAutoWeight);

                        validSubs.forEach((si, sidx) => {
                            const w = (si.weight !== '' && si.weight !== null && si.weight !== undefined) ? Number(si.weight) || 0 : sAutoWeight;
                            const wPct = totalSubWeightSum > 0 ? (w / totalSubWeightSum) : 0;
                            const subAbsWeight = wPct * nodeAbsWeight;
                            traverseItem(si, subAbsWeight, `${prefixLabel} \u2014 ${si.name || `Sub-item ${sidx + 1}`}`);
                        });
                    } else {
                        const isEmpty = (node.score === '' || node.score === null || node.score === undefined);
                        const max = Number(node.max) || 0;

                        if (!isEmpty) hasAnyInput = true;

                        if (isEmpty) {
                            if (nodeAbsWeight > 0) {
                                emptyTargets.push({
                                    id: node.id,
                                    name: prefixLabel,
                                    periodName: period.name || 'Unnamed Period',
                                    absWeight: nodeAbsWeight,
                                    sumMax: max > 0 ? max : 100
                                });
                                absoluteAvailable += nodeAbsWeight;
                            }
                        } else if (max > 0) {
                            let pct = (Number(node.score) || 0) / max;
                            absoluteEarned += (pct * nodeAbsWeight);
                            absoluteGraded += nodeAbsWeight;
                        }
                    }
                };

                validItems.forEach((item, index) => {
                    let itemW = (item.weight !== '' && item.weight !== null && item.weight !== undefined) ? Number(item.weight) || 0 : iAutoWeight;
                    let itemPctOfComp = totalItemWeightSum > 0 ? (itemW / totalItemWeightSum) : 0;
                    let itemAbsWeight = itemPctOfComp * compPctOfPeriod * periodPctOfSubject * 100;
                    const itemLabel = comp.items.length > 1 ? `${comp.name || 'Component'} (${item.name || `Item ${index + 1}`})` : (comp.name || 'Unnamed Component');

                    traverseItem(item, itemAbsWeight, itemLabel);
                });
            });
        });

        const floor = absoluteEarned;
        const ceiling = absoluteEarned + absoluteAvailable;
        const pace = absoluteGraded > 0 ? (absoluteEarned / absoluteGraded) * 100 : null;
        const projected = pace === null ? null : absoluteEarned + absoluteAvailable * (pace / 100);

        let subjectPercent = 0;
        if (totalPeriodWeightSum > 0) {
            if (ungraded === 'perfect') subjectPercent = ceiling;
            else if (ungraded === 'ignore') subjectPercent = pace ?? 0;
            else if (ungraded === 'project') subjectPercent = projected ?? 0;
            else subjectPercent = floor;
        }
        const gradeEq = Calculator.interpolateGrade(subjectPercent, Number(subject.passingPercent) || 60, system);
        
        return { 
            percent: subjectPercent, 
            equivalent: gradeEq, 
            hasData: hasAnyInput, 
            absoluteEarned: absoluteEarned, 
            absoluteWeight: 100,
            emptyComponents: emptyTargets,
            absoluteAvailable: absoluteAvailable,
            absoluteGraded,
            floor,
            ceiling,
            pace,
            projected,
        };
    },

    calculatePeriod: (period, passingPercent) => {
        let cExplicitSum = 0, cBlankCount = 0;
        const safeComps = period.components || [];
        safeComps.forEach(c => {
            if (c.weight !== '' && c.weight !== null && c.weight !== undefined) cExplicitSum += Number(c.weight) || 0;
            else cBlankCount++;
        });
        let cAutoWeight = cBlankCount > 0 ? Math.max(0, 100 - cExplicitSum) / cBlankCount : 0;
        let totalCompWeightSum = cExplicitSum + (cBlankCount * cAutoWeight);
        
        let earnedCompPercent = 0;

        const comps = safeComps.map(comp => {
            const compWeight = (comp.weight !== '' && comp.weight !== null && comp.weight !== undefined) ? Number(comp.weight) || 0 : cAutoWeight;
            
            let compHasInput = false;
            let iExplicitSum = 0, iBlankCount = 0;

            const safeItems = comp.items || [];
            safeItems.forEach(it => { 
                const itHasInput = (it.subItems && it.subItems.length > 0)
                    ? it.subItems.some(si => si.score !== '' && si.score !== null && si.score !== undefined)
                    : (it.score !== '' && it.score !== null && it.score !== undefined);
                if (itHasInput) compHasInput = true;
                if (it.weight !== '' && it.weight !== null && it.weight !== undefined) iExplicitSum += Number(it.weight) || 0;
                else iBlankCount++;
            });
            
            let iAutoWeight = iBlankCount > 0 ? Math.max(0, 100 - iExplicitSum) / iBlankCount : 0;
            let totalItemWeightSum = iExplicitSum + (iBlankCount * iAutoWeight);
            let earnedItemPercent = 0;
            
            safeItems.forEach(item => {
                let itemW = (item.weight !== '' && item.weight !== null && item.weight !== undefined) ? Number(item.weight) || 0 : iAutoWeight;
                const ip = Calculator.computeItemPercent(item);
                let pct = ip.percent * 100;
                earnedItemPercent += pct * (itemW / 100);
            });

            const pct = totalItemWeightSum > 0 ? (earnedItemPercent / (totalItemWeightSum / 100)) : 0;
            const contrib = compHasInput ? (pct * (compWeight / 100)) : 0; 
            
            if (compHasInput) {
                earnedCompPercent += contrib;
            }
            
            return { id: comp.id, name: comp.name, weight: compWeight, percent: pct, contrib, hasData: compHasInput };
        });

        const periodPercent = totalCompWeightSum > 0 ? (earnedCompPercent / (totalCompWeightSum / 100)) : 0;
        const passing = Number(passingPercent) || 60;
        const gap = passing - periodPercent;

        return {
            comps, percent: periodPercent, totalWeight: totalCompWeightSum, hasData: comps.some(c => c.hasData), passing, gap
        };
    },

    calculateSemester: (semester, system, ungraded = 'zero') => {
        let totalUnits = 0;
        let totalPercent = 0;
        let totalEq = 0;
        const safeSubjects = semester.subjects || [];
        // Only include subjects where gradeTrackingEnabled is not explicitly false
        safeSubjects.filter(sub => sub.gradeTrackingEnabled !== false).forEach(sub => {
            const res = Calculator.calculateSubject(sub, system, null, ungraded);
            // Outside 'zero', a subject with no scores has no grade to average:
            // counting it as 100 (perfect) or 0 would swing the GWA on nothing.
            if (ungraded !== 'zero' && !res.hasData) return;
            totalUnits += Number(sub.units) || 0;
            totalPercent += res.percent * (Number(sub.units) || 0);
            totalEq += res.equivalent * (Number(sub.units) || 0);
        });
        if (totalUnits === 0) return { percent: 0, equivalent: 0 };
        return { percent: totalPercent / totalUnits, equivalent: totalEq / totalUnits };
    },

    calculateYear: (year, system, ungraded = 'zero') => {
        let totalUnits = 0;
        let totalPercent = 0;
        let totalEq = 0;
        const safeSems = year.semesters || [];
        safeSems.forEach(sem => {
            const safeSubs = sem.subjects || [];
            safeSubs.filter(sub => sub.gradeTrackingEnabled !== false).forEach(sub => {
                const res = Calculator.calculateSubject(sub, system, null, ungraded);
                if (ungraded !== 'zero' && !res.hasData) return;
                totalUnits += Number(sub.units) || 0;
                totalPercent += res.percent * (Number(sub.units) || 0);
                totalEq += res.equivalent * (Number(sub.units) || 0);
            });
        });
        if (totalUnits === 0) return { percent: 0, equivalent: 0 };
        return { percent: totalPercent / totalUnits, equivalent: totalEq / totalUnits };
    },

    calculateCumulative: (years, system, ungraded = 'zero') => {
        let totalUnits = 0;
        let totalPercent = 0;
        let totalEq = 0;
        years.forEach(year => {
            (year.semesters || []).forEach(sem => {
                (sem.subjects || []).filter(sub => sub.gradeTrackingEnabled !== false).forEach(sub => {
                    const res = Calculator.calculateSubject(sub, system, null, ungraded);
                    if (ungraded !== 'zero' && !res.hasData) return;
                    totalUnits += Number(sub.units) || 0;
                    totalPercent += res.percent * (Number(sub.units) || 0);
                    totalEq += res.equivalent * (Number(sub.units) || 0);
                });
            });
        });
        if (totalUnits === 0) return { percent: 0, equivalent: 0 };
        return { percent: totalPercent / totalUnits, equivalent: totalEq / totalUnits };
    }
};
