import './style.css'
import GeoJSON from 'ol/format/GeoJSON.js';
import Map from 'ol/Map.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import View from 'ol/View.js';
import {DragBox, Select} from 'ol/interaction.js';
import {Fill, Stroke, Style} from 'ol/style.js';
import {getWidth} from 'ol/extent.js';
import {platformModifierKeyOnly} from 'ol/events/condition.js';
import Feature from 'ol/Feature.js';

// Function to generate a pastel color from a string (country name)
function generatePastelColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate HSL values for pastel colors
  const hue = Math.abs(hash) % 360;
  const saturation = 25 + (Math.abs(hash) % 45); // 25-70% for soft colors
  const lightness = 70 + (Math.abs(hash) % 20); // 70-90% for light colors
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

const vectorSource = new VectorSource({
  url: 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
  format: new GeoJSON(),
});

const style = new Style({
  fill: new Fill({
    color: '#eeeeee',
  }),
  stroke: new Stroke({
    color: 'rgba(255, 255, 255, 0.8)',
    width: 1,
  }),
});

const map = new Map({
  controls: [],
  layers: [
    new VectorLayer({
      source: vectorSource,
      background: '#1a2b39',
      style: function (feature) {
        const countryName = feature.get('NAME') || feature.get('name') || '';
        
        // Generate unique pastel color for each country
        const color = generatePastelColor(countryName);
        
        const fill = style.getFill();
        const stroke = style.getStroke();
        if (fill) {
          fill.setColor(color);
        }
        if (stroke) {
          stroke.setColor('rgba(255, 255, 255, 0.8)');
          stroke.setWidth(1);
        }
        return style;
      },
    }),
  ],
  target: 'map',
  view: new View({
    center: [0, 0],
    zoom: 2,
    constrainRotation: 16,
  }),
});

const selectedStyle = new Style({
  fill: new Fill({
    color: 'rgba(255, 255, 255, 0.6)',
  }),
  stroke: new Stroke({
    color: 'rgba(74, 144, 226, 0.9)',
    width: 3,
  }),
});

// a normal select interaction to handle click
const select = new Select({
  style: function (feature) {
    const countryName = feature.get('NAME') || feature.get('name') || '';
    const baseColor = generatePastelColor(countryName);
    
    // Make selected features have a bright overlay
    const selectedColor = baseColor.replace(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/, 'hsl($1, $2%, 85%)');
    
    const fill = selectedStyle.getFill();
    const stroke = selectedStyle.getStroke();
    if (fill) {
      fill.setColor(selectedColor);
    }
    if (stroke) {
      stroke.setColor('rgba(74, 144, 226, 0.9)');
      stroke.setWidth(3);
    }
    return selectedStyle;
  },
});
map.addInteraction(select);

const selectedFeatures = select.getFeatures();

// a DragBox interaction used to select features by drawing boxes
const dragBox = new DragBox({
  condition: platformModifierKeyOnly,
});

map.addInteraction(dragBox);

dragBox.on('boxend', function () {
  const boxExtent = dragBox.getGeometry()!.getExtent();

  // if the extent crosses the antimeridian process each world separately
  const worldExtent = map.getView().getProjection().getExtent();
  const worldWidth = getWidth(worldExtent);
  const startWorld = Math.floor((boxExtent[0] - worldExtent[0]) / worldWidth);
  const endWorld = Math.floor((boxExtent[2] - worldExtent[0]) / worldWidth);

  for (let world = startWorld; world <= endWorld; ++world) {
    const left = Math.max(boxExtent[0] - world * worldWidth, worldExtent[0]);
    const right = Math.min(boxExtent[2] - world * worldWidth, worldExtent[2]);
    const extent = [left, boxExtent[1], right, boxExtent[3]];

    const boxFeatures = vectorSource
      .getFeaturesInExtent(extent)
      .filter(
        (feature) =>
          !selectedFeatures.getArray().includes(feature) &&
          feature.getGeometry()!.intersectsExtent(extent),
      );

    // features that intersect the box geometry are added to the
    // collection of selected features

    // if the view is not obliquely rotated the box geometry and
    // its extent are equalivalent so intersecting features can
    // be added directly to the collection
    const rotation = map.getView().getRotation();
    const oblique = rotation % (Math.PI / 2) !== 0;

    // when the view is obliquely rotated the box extent will
    // exceed its geometry so both the box and the candidate
    // feature geometries are rotated around a common anchor
    // to confirm that, with the box geometry aligned with its
    // extent, the geometries intersect
    if (oblique) {
      const anchor = [0, 0];
      const geometry = dragBox.getGeometry()!.clone();
      geometry.translate(-world * worldWidth, 0);
      geometry.rotate(-rotation, anchor);
      const extent = geometry.getExtent();
      boxFeatures.forEach(function (feature) {
        const geometry = feature.getGeometry()!.clone();
        geometry.rotate(-rotation, anchor);
        if (geometry.intersectsExtent(extent)) {
          selectedFeatures.push(feature);
        }
      });
    } else {
      selectedFeatures.extend(boxFeatures);
    }
  }
});

// clear selection when drawing a new box and when clicking on the map
dragBox.on('boxstart', function () {
  selectedFeatures.clear();
});

// Create sidebar element
const sidebar = document.createElement('div');
sidebar.id = 'country-sidebar';
sidebar.style.cssText = `
  position: fixed;
  top: 0;
  left: -350px;
  width: 350px;
  height: 100vh;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.1);
  transition: left 0.3s ease-in-out;
  z-index: 1000;
  padding: 30px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow-y: auto;
`;

const sidebarContent = document.createElement('div');
sidebarContent.innerHTML = `
  <div style="border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 30px;">
    <h2 id="country-name" style="margin: 0; font-size: 28px; color: #333; font-weight: 600;"></h2>
  </div>
  
  <div style="space-y: 20px;">
    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #666; font-weight: 500;">Population</h3>
      <p style="margin: 0; font-size: 18px; color: #333;">~67 million</p>
    </div>
    
    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #666; font-weight: 500;">Capital</h3>
      <p style="margin: 0; font-size: 18px; color: #333;">London</p>
    </div>
    
    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #666; font-weight: 500;">Region</h3>
      <p style="margin: 0; font-size: 18px; color: #333;">Western Europe</p>
    </div>
    
    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #666; font-weight: 500;">GDP</h3>
      <p style="margin: 0; font-size: 18px; color: #333;">$3.1 trillion</p>
    </div>
    
    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #666; font-weight: 500;">Language</h3>
      <p style="margin: 0; font-size: 18px; color: #333;">English</p>
    </div>
    
    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #666; font-weight: 500;">Currency</h3>
      <p style="margin: 0; font-size: 18px; color: #333;">British Pound (GBP)</p>
    </div>
  </div>
`;

sidebar.appendChild(sidebarContent);
document.body.appendChild(sidebar);

selectedFeatures.on(['add', 'remove'], function () {
  const selectedCountries = selectedFeatures.getArray();
  
  if (selectedCountries.length === 1) {
    // Show sidebar for single country selection
    const countryName = selectedCountries[0].get('NAME') || selectedCountries[0].get('name') || 'Unknown';
    const countryNameElement = document.getElementById('country-name');
    if (countryNameElement) {
      countryNameElement.textContent = countryName;
    }
    sidebar.style.left = '0px';
  } else if (selectedCountries.length > 1) {
    // Show sidebar for multiple countries
    const countryNameElement = document.getElementById('country-name');
    if (countryNameElement) {
      countryNameElement.textContent = `${selectedCountries.length} Countries Selected`;
    }
    sidebar.style.left = '0px';
  } else {
    // Hide sidebar when nothing is selected
    sidebar.style.left = '-350px';
  }
});
