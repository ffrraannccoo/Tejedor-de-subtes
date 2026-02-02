export interface Coordinate {
    x: number;
    y: number;
}

export enum CellType {
    EMPTY = 'EMPTY',
    STATION = 'STATION',
    OBSTACLE_WATER = 'OBSTACLE_WATER',
    OBSTACLE_FOSSIL = 'OBSTACLE_FOSSIL',
    OBSTACLE_TUNNEL = 'OBSTACLE_TUNNEL',
}

export interface Station {
    id: string;
    name: string;
    x: number;
    y: number;
}

export interface Obstacle {
    type: CellType;
    x: number;
    y: number;
}

export interface LevelConfig {
    city: string;
    difficulty: number;
    description: string;
    stations: Station[];
    obstacles: Obstacle[];
    // The sequence of station IDs the passenger must visit
    routeRequest: string[]; 
}

export interface TrackConnection {
    x: number;
    y: number;
    active: boolean;
}

export interface TrackState {
    connections: Map<string, string[]>;
}

export interface LevelStats {
    kilometers: number;
}

export const CITIES = [
    "Buenos Aires",
    "Londres",
    "Nueva York",
    "Tokio",
    "París",
    "Berlín",
    "Madrid"
];