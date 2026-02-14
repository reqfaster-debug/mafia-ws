class GameGenerator {
    generateAge() {
        return Math.floor(Math.random() * (90 - 18 + 1)) + 18;
    }

    generateGender() {
        const rand = Math.random();
        if (rand < 0.45) return "Мужской";
        if (rand < 0.9) return "Женский";
        return "Трансформер";
    }

    generateBodyType() {
        const types = ["Худое", "Атлетическое", "Полное", "Ожирение-сильное"];
        return types[Math.floor(Math.random() * types.length)];
    }

    generateExperience(age) {
        if (age <= 24) {
            return Math.floor(Math.random() * (age / 8)) + 1;
        } else {
            return Math.floor(Math.random() * (age / 5)) + 1;
        }
    }

     generateCharacter(playersData) {
        const age = Math.floor(Math.random() * (90 - 18 + 1)) + 18;
        
        const rand = Math.random();
        let gender;
        if (rand < 0.45) gender = "Мужской";
        else if (rand < 0.9) gender = "Женский";
        else gender = "Трансформер";
        
        const bodyTypes = ["Худое", "Атлетическое", "Полное", "Ожирение-сильное"];
        
        const profession = playersData.professions[Math.floor(Math.random() * playersData.professions.length)];
        
        let experience;
        if (age <= 24) {
            experience = Math.floor(Math.random() * (age / 8)) + 1;
        } else {
            experience = Math.floor(Math.random() * (age / 5)) + 1;
        }
        
        return {
            age,
            gender,
            body_type: bodyTypes[Math.floor(Math.random() * bodyTypes.length)],
            trait: playersData.traits[Math.floor(Math.random() * playersData.traits.length)],
            profession,
            experience_years: experience,
            hobby: playersData.hobby[Math.floor(Math.random() * playersData.hobby.length)],
            health: playersData.health[Math.floor(Math.random() * playersData.health.length)],
            inventory: playersData.inventory[Math.floor(Math.random() * playersData.inventory.length)],
            phobia: playersData.phobia[Math.floor(Math.random() * playersData.phobia.length)],
            extra: playersData.extra[Math.floor(Math.random() * playersData.extra.length)]
        };
    }

    generateGameData(catastrophes, bunkers, bunkerSpaces) {
        // Выбираем случайную катастрофу и бункер
        const catastrophe = catastrophes[Math.floor(Math.random() * catastrophes.length)];
        const bunker = bunkers[Math.floor(Math.random() * bunkers.length)];
        
        // Добавляем информацию о местах в бункере
        return {
            catastrophe: catastrophe,
            bunker: {
                ...bunker,
                spaces: bunkerSpaces
            }
        };
    }
}

module.exports = new GameGenerator();