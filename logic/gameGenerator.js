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
        const maxExperience = age <= 24 ? Math.floor(age / 8) : Math.floor(age / 4);
        return Math.floor(Math.random() * maxExperience) + 1;
    }

    generateHealthSeverity() {
        const severities = ["легкая", "средняя", "тяжелая", "критическая"];
        return severities[Math.floor(Math.random() * severities.length)];
    }

    generateCharacter(playersData) {
    console.log('🎲 Generating character with data:', playersData);
    
    const age = this.generateAge();
    const gender = this.generateGender();
    const healthSeverity = this.generateHealthSeverity();
    const experience = this.generateExperience(age);
    
    // Проверяем, что playersData содержит массивы
    if (!playersData || !playersData.traits || !playersData.traits.length) {
        console.error('❌ Invalid playersData:', playersData);
        return {
            age: age,
            gender: gender,
            body_type: this.generateBodyType(),
            trait: "Неизвестно",
            profession: { name: "Неизвестно", description: "", experience: experience },
            hobby: "Неизвестно",
            health: { condition: "Неизвестно", severity: healthSeverity },
            inventory: "Неизвестно",
            phobia: "Неизвестно",
            extra: "Неизвестно"
        };
    }
    
    // Выбираем случайные значения из массивов
    const trait = playersData.traits[Math.floor(Math.random() * playersData.traits.length)];
    const hobby = playersData.hobby[Math.floor(Math.random() * playersData.hobby.length)];
    const healthCondition = playersData.health[Math.floor(Math.random() * playersData.health.length)];
    const inventory = playersData.inventory[Math.floor(Math.random() * playersData.inventory.length)];
    const phobia = playersData.phobia[Math.floor(Math.random() * playersData.phobia.length)];
    const extra = playersData.extra[Math.floor(Math.random() * playersData.extra.length)];
    
    // Выбираем профессию
    const profession = playersData.professions[Math.floor(Math.random() * playersData.professions.length)];
    
    const character = {
        age: age,
        gender: gender,
        body_type: this.generateBodyType(),
        trait: trait,
        profession: {
            name: profession.name,
            description: profession.description,
            experience: experience
        },
        hobby: hobby,
        health: {
            condition: healthCondition,
            severity: healthSeverity
        },
        inventory: inventory,
        phobia: phobia,
        extra: extra
    };
    
    console.log('✅ Generated character:', character);
    return character;
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