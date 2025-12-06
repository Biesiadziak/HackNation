import folium
import geopandas as gpd

# 1. Load the generated GeoJSON
try:
    gdf = gpd.read_file("buildings_warsaw.geojson")
except Exception as e:
    print("Error loading GeoJSON. Make sure you ran building_footprint.py first.")
    exit()

# 2. Calculate the center of the map based on the buildings
if not gdf.empty:
    center_lat = gdf.geometry.centroid.y.mean()
    center_lon = gdf.geometry.centroid.x.mean()
else:
    # Default to Warsaw if empty
    center_lat, center_lon = 52.2297, 21.0122

# 3. Create a Map with Satellite Imagery (Esri World Imagery)
m = folium.Map(location=[center_lat, center_lon], zoom_start=19)

# Add Esri Satellite tiles
folium.TileLayer(
    tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr='Esri',
    name='Esri Satellite',
    overlay=False,
    control=True
).add_to(m)

# 4. Add the Building Polygons
folium.GeoJson(
    gdf,
    name="Buildings",
    style_function=lambda x: {
        'color': '#ff0000',      # Red border
        'weight': 2,
        'fillColor': '#ff0000',  # Red fill
        'fillOpacity': 0.3
    },
    tooltip=folium.GeoJsonTooltip(fields=list(gdf.columns.drop('geometry')), aliases=list(gdf.columns.drop('geometry'))) if not gdf.empty else None
).add_to(m)

# Add layer control to switch between layers
folium.LayerControl().add_to(m)

# 5. Save to HTML
output_file = "map_visualization.html"
m.save(output_file)
print(f"Map saved to {output_file}. Open this file in your browser to view.")
