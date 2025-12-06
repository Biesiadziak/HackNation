import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';

export interface FootprintData {
    coords: [number, number][];
    center: [number, number];
    levels: number;
    height: number | null;
}

export async function getBuildingFootprint(address: string): Promise<FootprintData> {
    console.log(`Geocoding: ${address}`);

    // 1. Geocode the address using Nominatim
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const geocodeRes = await fetch(geocodeUrl, {
        headers: {
            'User-Agent': 'HackNation-3D-Firefighter/1.0'
        }
    });
    
    if (!geocodeRes.ok) throw new Error("Geocoding failed");
    const geocodeData = await geocodeRes.json();

    if (geocodeData.length === 0) {
        throw new Error("Address not found");
    }

    const location = geocodeData[0];
    const lat = parseFloat(location.lat);
    const lon = parseFloat(location.lon);

    console.log(`Found location: ${lat}, ${lon}`);

    // 2. Fetch building footprints using Overpass API
    const overpassQuery = `
        [out:json][timeout:25];
        (
          way["building"](around:50,${lat},${lon});
          relation["building"](around:50,${lat},${lon});
        );
        out body;
        >;
        out skel qt;
    `;

    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const overpassRes = await fetch(overpassUrl, {
        method: 'POST',
        body: overpassQuery
    });

    if (!overpassRes.ok) throw new Error("Overpass API request failed");
    const overpassData = await overpassRes.json();

    // 3. Convert OSM data to GeoJSON
    const geoJson = osmtogeojson(overpassData);

    if (!geoJson.features || geoJson.features.length === 0) {
        throw new Error("No buildings found near this address");
    }

    // 4. Filter for Polygons and find the closest one
    const targetPoint = turf.point([lon, lat]);
    let closestBuilding: any = null;
    let minDistance = Infinity;

    const polygons = geoJson.features.filter((f: any) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');

    if (polygons.length === 0) {
        throw new Error("No building polygons found");
    }

    polygons.forEach((feature: any) => {
        let distance = 0;
        const isInside = turf.booleanPointInPolygon(targetPoint, feature);
        
        if (!isInside) {
            const centroid = turf.centroid(feature);
            distance = turf.distance(targetPoint, centroid, { units: 'meters' });
        }

        if (distance < minDistance) {
            minDistance = distance;
            closestBuilding = feature;
        }
    });

    if (!closestBuilding) {
        throw new Error("Could not determine closest building");
    }

    // 5. Extract metadata
    const tags = closestBuilding.properties || {};
    let levels = 3; // Default
    if (tags['building:levels']) {
        const parsed = parseFloat(tags['building:levels'].split(';')[0]);
        if (!isNaN(parsed)) levels = parsed;
    }
    const height = tags['height'] ? parseFloat(tags['height']) : null;

    // 6. Normalize coordinates (center them)
    const centroid = turf.centroid(closestBuilding);
    const centerLon = centroid.geometry.coordinates[0];
    const centerLat = centroid.geometry.coordinates[1];

    const METERS_PER_DEG_LAT = 111320;
    const METERS_PER_DEG_LON = 40075000 * Math.cos(centerLat * Math.PI / 180) / 360;

    let coords: any[] = [];
    
    // Handle Polygon vs MultiPolygon
    const polygonGeometry = closestBuilding.geometry;
    if (polygonGeometry.type === 'MultiPolygon') {
        // Take the largest polygon by area
        let maxArea = 0;
        let maxPolyIndex = 0;
        polygonGeometry.coordinates.forEach((polyCoords: any[], index: number) => {
            const polyFeature = turf.polygon(polyCoords);
            const area = turf.area(polyFeature);
            if (area > maxArea) {
                maxArea = area;
                maxPolyIndex = index;
            }
        });
        coords = polygonGeometry.coordinates[maxPolyIndex][0];
    } else {
        coords = polygonGeometry.coordinates[0];
    }

    const normalizedCoords = coords.map((coord: any) => {
        const [pLon, pLat] = coord;
        const x = (pLon - centerLon) * METERS_PER_DEG_LON;
        const y = (pLat - centerLat) * METERS_PER_DEG_LAT;
        return [x, y] as [number, number];
    });

    return {
        coords: normalizedCoords,
        center: [lat, lon],
        levels: levels,
        height: height
    };
}
