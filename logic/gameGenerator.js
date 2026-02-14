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
    
    // Проверяем структуру playersData и создаём значения по умолчанию
    let trait = "Неизвестно";
    let hobby = "Неизвестно";
    let healthCondition = "Неизвестно";
    let inventory = "Неизвестно";
    let phobia = "Неизвестно";
    let extra = "Неизвестно";
    let professionName = "Неизвестно";
    let professionDesc = "";
    
    // Если playersData существует и содержит нужные массивы
    if (playersData) {
        // Проверяем наличие traits
        if (playersData.traits && Array.isArray(playersData.traits) && playersData.traits.length > 0) {
            trait = playersData.traits[Math.floor(Math.random() * playersData.traits.length)];
        } else {
            console.warn('⚠️ traits array missing, using default');
            const defaultTraits = ['Храбрый', 'Трусливый', 'Добрый', 'Злой', 'Хитрый', 'Честный'];
            trait = defaultTraits[Math.floor(Math.random() * defaultTraits.length)];
        }
        
        // Проверяем наличие hobby
        if (playersData.hobby && Array.isArray(playersData.hobby) && playersData.hobby.length > 0) {
            hobby = playersData.hobby[Math.floor(Math.random() * playersData.hobby.length)];
        } else {
            console.warn('⚠️ hobby array missing, using default');
            const defaultHobbies = ['Рыбалка', 'Охота', 'Чтение', 'Спорт', 'Музыка', 'Рисование'];
            hobby = defaultHobbies[Math.floor(Math.random() * defaultHobbies.length)];
        }
        
        // Проверяем наличие health
        if (playersData.health && Array.isArray(playersData.health) && playersData.health.length > 0) {
            healthCondition = playersData.health[Math.floor(Math.random() * playersData.health.length)];
        } else {
            console.warn('⚠️ health array missing, using default');
            const defaultHealth = ['Здоров', 'Диабет', 'Астма', 'Гипертония', 'Аллергия'];
            healthCondition = defaultHealth[Math.floor(Math.random() * defaultHealth.length)];
        }
        
        // Проверяем наличие inventory
        if (playersData.inventory && Array.isArray(playersData.inventory) && playersData.inventory.length > 0) {
            inventory = playersData.inventory[Math.floor(Math.random() * playersData.inventory.length)];
        } else {
            console.warn('⚠️ inventory array missing, using default');
            const defaultInventory = ['Аптечка', 'Нож', 'Фонарик', 'Веревка', 'Спички', 'Консервы'];
            inventory = defaultInventory[Math.floor(Math.random() * defaultInventory.length)];
        }
        
        // Проверяем наличие phobia
        if (playersData.phobia && Array.isArray(playersData.phobia) && playersData.phobia.length > 0) {
            phobia = playersData.phobia[Math.floor(Math.random() * playersData.phobia.length)];
        } else {
            console.warn('⚠️ phobia array missing, using default');
            const defaultPhobias = ['Клаустрофобия', 'Арахнофобия', 'Акрофобия', 'Нет фобий', 'Социофобия'];
            phobia = defaultPhobias[Math.floor(Math.random() * defaultPhobias.length)];
        }
        
        // Проверяем наличие extra
        if (playersData.extra && Array.isArray(playersData.extra) && playersData.extra.length > 0) {
            extra = playersData.extra[Math.floor(Math.random() * playersData.extra.length)];
        } else {
            console.warn('⚠️ extra array missing, using default');
            const defaultExtras = ['Водительские права', 'Знание языков', 'Навыки выживания', 'Медицинское образование'];
            extra = defaultExtras[Math.floor(Math.random() * defaultExtras.length)];
        }
        
        // Проверяем наличие professions
        if (playersData.professions && Array.isArray(playersData.professions) && playersData.professions.length > 0) {
            const prof = playersData.professions[Math.floor(Math.random() * playersData.professions.length)];
            professionName = prof.name || prof.title || "Неизвестно";
            professionDesc = prof.description || "";
        } else {
            console.warn('⚠️ professions array missing, using default');
            const defaultProfessions = ['Врач', 'Инженер', 'Учитель', 'Строитель', 'Военный', 'Полицейский'];
            professionName = defaultProfessions[Math.floor(Math.random() * defaultProfessions.length)];
        }
    } else {
        console.warn('⚠️ playersData is missing, using all defaults');
    }
    
    const character = {
        age: age,
        gender: gender,
        body_type: this.generateBodyType(),
        trait: trait,
        profession: {
            name: professionName,
            description: professionDesc,
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