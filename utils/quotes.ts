export const getGradeQuote = (percent: number, hasData: boolean) => {
    if (!hasData) return "Add your subjects to start tracking!";

    const quotes = {
        outstanding: [
            "Aiming for the stars! 🌟",
            "Absolute perfection! 🔥",
            "You're unstoppable! 🚀",
            "Excellence is your habit. ✨",
            "Top of the class! 🎓",
            "Brilliant work so far! 💡"
        ],
        onTrack: [
            "You're doing great! 💪",
            "Keep the momentum going! 🏃‍♂️",
            "Great job, push a bit more! ⭐",
            "Solid performance! 📈",
            "Almost at the very top! 🏔️",
            "Stay focused, you've got this! 🎯"
        ],
        passing: [
            "Passing is just the beginning! 🌱",
            "You're safe, but keep climbing! 🧗‍♂️",
            "Room for improvement, you can do it! 🚀",
            "Every effort counts. Keep pushing! 💯",
            "Steady progress! 🐢",
            "You made it! Now aim higher! 🎯"
        ],
        needsWork: [
            "Failure is a stepping stone. 🌱",
            "Don't give up, bounce back! 💙",
            "Tough times don't last! 💪",
            "Mistakes mean you are trying. ✨",
            "You can always turn this around! 🔄",
            "A setback is a setup for a comeback! 🚀"
        ]
    };

    let selectedArray = quotes.needsWork;
    if (percent >= 90) selectedArray = quotes.outstanding;
    else if (percent >= 75) selectedArray = quotes.onTrack;
    else if (percent >= 60) selectedArray = quotes.passing;

    // Use a stable pseudo-random index based on the percent value
    // This prevents the quote from flickering on every React re-render
    const hash = Math.floor(percent * 137); 
    const index = hash % selectedArray.length;
    
    return selectedArray[index];
};
