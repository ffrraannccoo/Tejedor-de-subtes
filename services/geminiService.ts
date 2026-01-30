import { GoogleGenAI, Type } from "@google/genai";
import { LevelConfig, Station, Obstacle, CellType } from '../types';
import { generateLevel as generateMockLevel } from './levelGenerator';

export const generateLevel = async (city: string, difficulty: number): Promise<LevelConfig> => {
    if (!process.env.API_KEY) {
        console.warn("No API Key found, using fallback level.");
        return generateMockLevel(city, difficulty);
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // We ask for station names and a scenario. 
    // We will randomize positions client-side to ensure gameplay validity, 
    // or we ask Gemini for relative grid positions (0-19).
    const prompt = `
        Create a level for a subway puzzle game set in ${city}.
        Difficulty Level: ${difficulty} (1 is simple A to B, 3 adds stops, 5 is complex loop).
        
        Requirements:
        1. Return exactly 20 real subway station names from ${city}.
        2. Create a "passenger request" story (e.g., "I need to go from X to Y via Z").
        3. Define the 'routeRequest' as an array of station indices (0-19) that must be visited in order based on the story.
        4. Suggest 8-12 obstacles (Water, Fossil, Old Tunnel) with x,y coordinates on a 20x20 grid (0-19).
        5. Return JSON only.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        story: { type: Type.STRING },
                        stations: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: "List of 20 real station names"
                        },
                        routeIndices: {
                            type: Type.ARRAY,
                            items: { type: Type.INTEGER },
                            description: "Indices of the stations in the stations array that form the required path"
                        },
                        obstacles: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING, enum: ["WATER", "FOSSIL", "TUNNEL"] },
                                    x: { type: Type.INTEGER },
                                    y: { type: Type.INTEGER }
                                }
                            }
                        }
                    }
                }
            }
        });

        const data = JSON.parse(response.text || "{}");

        if (!data.stations || data.stations.length === 0) {
            throw new Error("Invalid Gemini response");
        }

        // Process stations: Assign random non-overlapping coordinates on a 20x20 grid
        // to ensure the game is playable and unpredictable.
        const usedCoords = new Set<string>();
        data.obstacles.forEach((o: any) => usedCoords.add(`${o.x},${o.y}`));

        const finalStations: Station[] = data.stations.map((name: string, index: number) => {
            let x, y, key;
            let attempts = 0;
            do {
                x = Math.floor(Math.random() * 18) + 1; // 1-18 padding
                y = Math.floor(Math.random() * 18) + 1;
                key = `${x},${y}`;
                attempts++;
            } while (usedCoords.has(key) && attempts < 100);
            
            usedCoords.add(key);
            
            return {
                id: `s-${index}`,
                name: name,
                x, 
                y
            };
        });

        // Map obstacles
        const finalObstacles: Obstacle[] = data.obstacles.map((o: any) => {
             let type = CellType.OBSTACLE_TUNNEL;
             if (o.type === 'WATER') type = CellType.OBSTACLE_WATER;
             if (o.type === 'FOSSIL') type = CellType.OBSTACLE_FOSSIL;
             return { type, x: o.x, y: o.y };
        });

        // Map route request IDs
        const finalRoute = data.routeIndices.map((idx: number) => `s-${idx}`);

        return {
            city,
            difficulty,
            description: data.story,
            stations: finalStations,
            obstacles: finalObstacles,
            routeRequest: finalRoute
        };

    } catch (error) {
        console.error("Gemini API Error:", error);
        return generateMockLevel(city, difficulty);
    }
};