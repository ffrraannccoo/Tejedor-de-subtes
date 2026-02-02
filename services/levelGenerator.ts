import { LevelConfig, Station, Obstacle, CellType } from '../types';

// Database of stations with Spanish keys
const CITY_DATA: Record<string, string[]> = {
    "Buenos Aires": [
        "Palermo", "Catedral", "Congreso", "Juramento", "Boedo", "Plaza de Mayo", "Perú", "Piedras", 
        "Lima", "Saenz Peña", "Pasco", "Alberti", "Plaza Miserere", "Loria", "Castro Barros", 
        "Río de Janeiro", "Acoyte", "Primera Junta", "Puan", "Carabobo", "Flores", "San Pedrito",
        "Retiro", "Lavalle", "Diag. Norte", "Moreno", "Independencia", "San Juan", "Constitución"
    ],
    "Nueva York": [
        "Times Sq", "Grand Central", "Union Sq", "Fulton St", "Wall St", "Canal St", "Chambers St", 
        "Houston St", "Christopher St", "Penn Station", "34th St", "42nd St", "50th St", "59th St", 
        "66th St", "72nd St", "79th St", "86th St", "96th St", "103rd St", "Harlem", "Bronx Park"
    ],
    "Londres": [
        "Waterloo", "Victoria", "King's Cross", "Paddington", "Liverpool St", "Bank", "London Bridge", 
        "Canary Wharf", "Stratford", "Oxford Circus", "Bond St", "Baker St", "Westminster", "Green Park", 
        "South Kensington", "Piccadilly Circus", "Leicester Sq", "Covent Garden", "Holborn", "St. Paul's"
    ],
    "París": [
        "Gare du Nord", "Gare de Lyon", "Chatelet", "Montparnasse", "Saint-Lazare", "Bastille", 
        "Republique", "Opera", "Concorde", "Etoile", "Nation", "Saint-Michel", "Invalides", 
        "Trocadero", "Bercy", "Austerlitz", "Pigalle", "Anvers", "Abbesses", "Clichy"
    ],
    "Tokio": [
        "Shinjuku", "Shibuya", "Ikebukuro", "Tokyo", "Ueno", "Shinagawa", "Akihabara", "Ginza", 
        "Roppongi", "Asakusa", "Harajuku", "Ebisu", "Meguro", "Gotanda", "Osaki", "Hamamatsucho", 
        "Shimbashi", "Yurakucho", "Kanda", "Otemachi"
    ],
    "Berlín": [
        "Alexanderplatz", "Potsdamer Platz", "Hauptbahnhof", "Zoologischer Garten", "Friedrichstraße",
        "Wittenbergplatz", "Hermannplatz", "Kottbusser Tor", "Warschauer Straße", "Stadtmitte"
    ],
    "Madrid": [
        "Sol", "Atocha", "Chamartín", "Nuevos Ministerios", "Plaza de España", "Moncloa", 
        "Príncipe Pío", "Goya", "Avenida de América", "Gregorio Marañón"
    ]
};

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Adjusted for smaller grid 15x15 (Indices 0-14)
const MAX_GRID = 14; 

export const generateLevel = async (city: string, difficulty: number): Promise<LevelConfig> => {
    // Instant loading
    await new Promise(resolve => setTimeout(resolve, 50));

    const allStations = CITY_DATA[city] || CITY_DATA["Buenos Aires"];
    // Shuffle and pick 10 stations maximum for mobile readability
    const available = [...allStations];
    const count = Math.min(10, available.length);
    const shuffledNames = available.sort(() => 0.5 - Math.random()).slice(0, count);

    const usedCoords = new Set<string>();
    const getKey = (x: number, y: number) => `${x},${y}`;

    // 1. Place Stations
    const stations: Station[] = shuffledNames.map((name, index) => {
        let x, y, key;
        do {
            // Keep some padding from edges (1 to MAX-1)
            x = getRandomInt(1, MAX_GRID - 1);
            y = getRandomInt(1, MAX_GRID - 1);
            key = getKey(x, y);
        } while (usedCoords.has(key));
        usedCoords.add(key);

        return {
            id: `s-${index}`,
            name,
            x,
            y
        };
    });

    // 2. Place Obstacles
    const obstacles: Obstacle[] = [];
    const obstacleCount = 6 + difficulty; // Reduced obstacle count for smaller grid
    const obstacleTypes = [CellType.OBSTACLE_WATER, CellType.OBSTACLE_FOSSIL, CellType.OBSTACLE_TUNNEL];

    for (let i = 0; i < obstacleCount; i++) {
        let x, y, key;
        let attempts = 0;
        do {
            x = getRandomInt(0, MAX_GRID);
            y = getRandomInt(0, MAX_GRID);
            key = getKey(x, y);
            attempts++;
        } while (usedCoords.has(key) && attempts < 50);

        if (attempts < 50) {
            usedCoords.add(key);
            obstacles.push({
                type: obstacleTypes[getRandomInt(0, 2)],
                x,
                y
            });
        }
    }

    // 3. Generate Route Request based on Difficulty
    const routeLength = Math.min(difficulty + 2, stations.length);
    const routeIndices: number[] = [];
    
    // Pick random start
    let currentIdx = getRandomInt(0, stations.length - 1);
    routeIndices.push(currentIdx);

    for(let i = 1; i < routeLength; i++) {
        // Pick next station not already in route
        let nextIdx;
        do {
            nextIdx = getRandomInt(0, stations.length - 1);
        } while (routeIndices.includes(nextIdx));
        routeIndices.push(nextIdx);
    }
    
    if (difficulty === 5) {
        routeIndices.push(routeIndices[0]);
    }

    const routeRequest = routeIndices.map(idx => `s-${idx}`);
    
    // Generate Story in Rioplatense
    const startName = stations.find(s => s.id === routeRequest[0])?.name;
    const endName = stations.find(s => s.id === routeRequest[routeRequest.length - 1])?.name;
    
    let description = "";
    if (difficulty === 1) {
        description = `Llevame de ${startName} a ${endName}. ¡Cortito y al pie!`;
    } else if (difficulty < 4) {
        description = `Tengo que ir de ${startName} a ${endName}, pero pasá por las estaciones que te marqué.`;
    } else {
        description = `¡Qué lío! Quieren ir de ${startName} a ${endName} dando toda una vuelta. Ojo con los túneles viejos.`;
    }

    return {
        city,
        difficulty,
        description,
        stations,
        obstacles,
        routeRequest
    };
};