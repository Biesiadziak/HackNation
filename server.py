from flask import Flask, request, jsonify
from flask_cors import CORS
import osmnx as ox
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon

app = Flask(__name__)
CORS(app)

@app.route('/footprint', methods=['GET'])
def get_footprint():
    address = request.args.get('address')
    if not address:
        return jsonify({"error": "Address is required"}), 400

    try:
        print(f"Geocoding: {address}")
        # Geocode the address to get lat, lon
        lat, lon = ox.geocode(address)
        
        # Get building footprints around the point
        # Using a small distance to find the specific building, or a larger one if we want context
        # But the user said "floors to be shape of the building footprint", implying ONE building.
        # If we search by address, we might get the point.
        
        tags = {'building': True}
        gdf = ox.features_from_point((lat, lon), tags=tags, dist=50)
        
        if gdf.empty:
             return jsonify({"error": "No buildings found near this address"}), 404

        # Filter for Polygons
        gdf_poly = gdf[gdf.geometry.type.isin(['Polygon', 'MultiPolygon'])]
        
        if gdf_poly.empty:
            return jsonify({"error": "No building polygons found"}), 404

        # Find the building closest to the geocoded point?
        # Or just take the largest one? Or the first one?
        # For now, let's take the one that actually contains the point or is closest.
        # But features_from_point returns everything in a buffer.
        
        # Let's just take the first one for now, or the largest.
        # Better: Calculate distance to the center point and take the closest.
        
        # Project to a local CRS to get meters for geometry operations if needed, 
        # but for simple extraction we can work with lat/lon or project.
        # React-three-fiber usually works in arbitrary units. 
        # We should probably center the polygon at (0,0) for the 3D model.
        
        target_point = gpd.points_from_xy([lon], [lat], crs="EPSG:4326")[0]
        
        # We need to project to measure distance in meters accurately, but for selection it might be fine.
        # Let's project to UTM.
        gdf_proj = gdf_poly.to_crs(gdf_poly.estimate_utm_crs())
        target_point_proj = gpd.GeoSeries([target_point], crs="EPSG:4326").to_crs(gdf_proj.crs)[0]
        
        # Find closest building to the address point
        gdf_proj['distance'] = gdf_proj.geometry.distance(target_point_proj)
        closest_building = gdf_proj.sort_values('distance').iloc[0]
        
        # Extract metadata
        levels = closest_building.get('building:levels', None)
        height = closest_building.get('height', None)
        
        # Clean up levels (sometimes it's a string like "5" or "5;6")
        try:
            if levels:
                levels = float(str(levels).split(';')[0])
            else:
                levels = 3 # Default
        except:
            levels = 3
            
        geometry = closest_building.geometry
        
        polygons = []
        if isinstance(geometry, Polygon):
            polygons.append(geometry)
        elif isinstance(geometry, MultiPolygon):
            polygons.extend(geometry.geoms)
            
        # Extract coordinates from the largest polygon (main building part)
        main_poly = max(polygons, key=lambda p: p.area)
        
        # Get exterior coordinates
        x, y = main_poly.exterior.coords.xy
        coords = list(zip(x, y))
        
        # Normalize coordinates to center them around (0,0)
        # The building center
        centroid = main_poly.centroid
        cx, cy = centroid.x, centroid.y
        
        normalized_coords = [[px - cx, py - cy] for px, py in coords]
        
        return jsonify({
            "coords": normalized_coords,
            "center": [lat, lon],
            "levels": levels,
            "height": height
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
