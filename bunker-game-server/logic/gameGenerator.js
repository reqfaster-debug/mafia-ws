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
        // Максимальный стаж зависит от возраста
        const maxExperience = age <= 24 ? Math.floor(age / 8) : Math.floor(age / 4);
        // Стаж от 1 до maxExperience
        return Math.floor(Math.random() * maxExperience) + 1;
    }

    generateHealthSeverity() {
        const severities = ["легкая", "средняя", "тяжелая", "критическая"];
        return severities[Math.floor(Math.random() * severities.length)];
    }

    generateCharacter(playersData) {
        const age = this.generateAge();
        const gender = this.generateGender();
        const healthSeverity = this.generateHealthSeverity();
        const experience = this.generateExperience(age);
        
        const profession = playersData.professions[Math.floor(Math.random() * playersData.professions.length)];
        
        return {
            age: age,
            gender: gender,
            body_type: this.generateBodyType(),
            trait: playersData.traits[Math.floor(Math.random() * playersData.traits.length)],
            profession: {
                name: profession.name,
                description: profession.description,
                experience: experience // Добавляем стаж
            },
            hobby: playersData.hobby[Math.floor(Math.random() * playersData.hobby.length)],
            health: {
                condition: playersData.health[Math.floor(Math.random() * playersData.health.length)],
                severity: healthSeverity // Добавляем степень тяжести
            },
            inventory: playersData.inventory[Math.floor(Math.random() * playersData.inventory.length)],
            phobia: playersData.phobia[Math.floor(Math.random() * playersData.phobia.length)],
            extra: playersData.extra[Math.floor(Math.random() * playersData.extra.length)]
        };
    }

    generateGameData(catastrophes, bunkers, bunkerSpaces) {
        const catastrophe = catastrophes[Math.floor(Math.random() * catastrophes.length)];
        const bunker = bunkers[Math.floor(Math.random() * bunkers.length)];
        
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