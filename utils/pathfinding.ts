import { Coordinate } from '../types';

export const getKey = (x: number, y: number) => `${x},${y}`;

// BFS to find path between two points given a set of connections
export const findPath = (
    start: Coordinate, 
    end: Coordinate, 
    connections: Map<string, string[]>
): Coordinate[] | null => {
    
    const startKey = getKey(start.x, start.y);
    const endKey = getKey(end.x, end.y);

    if (startKey === endKey) return [start];

    const queue: { pos: Coordinate; path: Coordinate[] }[] = [{ pos: start, path: [start] }];
    const visited = new Set<string>();
    visited.add(startKey);

    while (queue.length > 0) {
        const { pos, path } = queue.shift()!;
        const currentKey = getKey(pos.x, pos.y);

        if (currentKey === endKey) {
            return path;
        }

        const neighbors = connections.get(currentKey) || [];
        
        for (const neighborKey of neighbors) {
            if (!visited.has(neighborKey)) {
                visited.add(neighborKey);
                const [nx, ny] = neighborKey.split(',').map(Number);
                queue.push({
                    pos: { x: nx, y: ny },
                    path: [...path, { x: nx, y: ny }]
                });
            }
        }
    }

    return null;
};
