import osmnx as ox
import folium
import geopandas as gpd

address = "Osiedle Rzeczypospolitej 102, Poznań, Poland"
distance_m = 10  # radius

print(f"Geocoding: {address}")
lat, lon = ox.geocode(address)
print(f"Found coordinates: {lat}, {lon}")

# get building footprints around the point
gdf_buildings = ox.features_from_point((lat, lon), tags={'building': True}, dist=distance_m)

# keep only polygon geometries and relevant columns
gdf_poly = gdf_buildings[gdf_buildings.geometry.type.isin(['Polygon','MultiPolygon'])]
gdf_poly = gdf_poly[['geometry']].reset_index(drop=True)

# export to GeoJSON
gdf_poly.to_file("buildings_warsaw.geojson", driver="GeoJSON")

print(f"Saved {len(gdf_poly)} building polygons to buildings_warsaw.geojson")

# 2. Calculate the center of the map based on the buildings
if not gdf_poly.empty:
    center_lat = gdf_poly.geometry.centroid.y.mean()
    center_lon = gdf_poly.geometry.centroid.x.mean()
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
    gdf_poly,
    name="Buildings",
    style_function=lambda x: {
        'color': '#ff0000',      # Red border
        'weight': 2,
        'fillColor': '#ff0000',  # Red fill
        'fillOpacity': 0.3
    },
    tooltip=folium.GeoJsonTooltip(fields=list(gdf_poly.columns.drop('geometry')), aliases=list(gdf_poly.columns.drop('geometry'))) if not gdf_poly.empty else None
).add_to(m)

# Add layer control to switch between layers
folium.LayerControl().add_to(m)

# 5. Save to HTML
output_file = "map_visualization.html"
m.save(output_file)
print(f"Map saved to {output_file}. Open this file in your browser to view.")