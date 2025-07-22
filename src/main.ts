import './style.css'
import 'ol/ol.css'
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

// Global variables to track initialization state
let mapInitialized = false;
let map: Map;
let vectorSource: VectorSource;
let selectedFeatures: any;
let sidebar: HTMLDivElement;

// Function to get country name from feature (handles different property structures)
function getCountryName(feature: any): string {
  return feature.get('NAME') || feature.get('name') || 'Unknown';
}

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

// Listen for the initialization event from homescreen
window.addEventListener('initializeMap', initializeMap);

function initializeMap() {
  if (mapInitialized) return;
  
  console.log('Initializing map...');
  mapInitialized = true;

  vectorSource = new VectorSource({
    url: 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
    format: new GeoJSON(),
    // Add caching to improve performance
    strategy: function(extent, resolution) {
      return [[-20037508.342789244, -20037508.342789244, 20037508.342789244, 20037508.342789244]];
    }
  });

  // Add loading state to improve perceived performance
  vectorSource.on('featuresloadstart', function() {
    // Loading started
  });

  vectorSource.on('featuresloadend', function() {
    // Loading completed
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

  map = new Map({
    controls: [],
    layers: [
      new VectorLayer({
        source: vectorSource,
        background: '#87CEEB', // Light blue ocean color (Sky Blue)
        style: function (feature) {
          const countryName = getCountryName(feature);
          
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
        // Performance optimizations
        renderBuffer: 100, // Render features outside the view for smoother panning
        updateWhileAnimating: true, // Keep rendering during animations
        updateWhileInteracting: true, // Keep rendering during interactions
      }),
    ],
    target: 'map',
    view: new View({
      center: [0, 0],
      zoom: 2,
      constrainRotation: 16,
      // Smooth zoom animations
      enableRotation: false, // Disable rotation for better performance
      smoothExtentConstraint: true, // Smooth extent changes
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
      const countryName = getCountryName(feature);
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
    // Enable toggle behavior - clicking selected feature will deselect it
    toggleCondition: function() { return true; }
  });
  map.addInteraction(select);

  selectedFeatures = select.getFeatures();

  // Add hover effect
  let hoveredFeature: Feature | null = null;

  map.on('pointermove', function(evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
      return feature;
    });

    // Reset previous hovered feature style
    if (hoveredFeature && hoveredFeature !== feature) {
      // Reset to normal style
      hoveredFeature.setStyle(undefined);
    }

    // Apply hover style to new feature (only if it's a proper Feature, not RenderFeature)
    if (feature && feature instanceof Feature && feature !== hoveredFeature && !selectedFeatures.getArray().includes(feature)) {
      const countryName = getCountryName(feature);
      const color = generatePastelColor(countryName);
      
      const hoverStyle = new Style({
        fill: new Fill({
          color: color,
        }),
        stroke: new Stroke({
          color: '#000000', // Black outline on hover
          width: 2,
        }),
      });
      
      feature.setStyle(hoverStyle);
      hoveredFeature = feature;
    } else if (!(feature instanceof Feature)) {
      hoveredFeature = null;
    }
  });

  // Reset hover when mouse leaves the map
  map.getViewport().addEventListener('mouseleave', function() {
    if (hoveredFeature && !selectedFeatures.getArray().includes(hoveredFeature)) {
      hoveredFeature.setStyle(undefined);
      hoveredFeature = null;
    }
  });

  // Store original view state for returning after zoom
  let originalViewState: { center: number[], zoom: number } | null = null;
  let deselectionTimeout: ReturnType<typeof setTimeout> | null = null;

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
  sidebar = document.createElement('div');
  sidebar.id = 'country-sidebar';
  sidebar.style.cssText = `
    position: fixed;
    top: 30px;
    left: -380px;
    width: 350px;
    height: calc(100vh - 60px);
    background: rgba(0, 0, 0, 0.85);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    transition: left 0.3s ease-in-out;
    z-index: 1000;
    padding: 30px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: white;
    overflow-y: auto;
  `;

  const sidebarContent = document.createElement('div');
  sidebarContent.innerHTML = `
    <div style="border-bottom: 2px solid rgba(255, 255, 255, 0.2); padding-bottom: 20px; margin-bottom: 30px;">
      <h2 id="country-name" style="margin: 0; font-size: 28px; color: white; font-weight: 600;"></h2>
    </div>
    
    <div style="space-y: 20px;">
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #ccc; font-weight: 500;">Population</h3>
        <p style="margin: 0; font-size: 18px; color: #e0e0e0;">~67 million</p>
      </div>
      
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #ccc; font-weight: 500;">Capital</h3>
        <p style="margin: 0; font-size: 18px; color: #e0e0e0;">London</p>
      </div>
      
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #ccc; font-weight: 500;">Region</h3>
        <p style="margin: 0; font-size: 18px; color: #e0e0e0;">Western Europe</p>
      </div>
      
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #ccc; font-weight: 500;">GDP</h3>
        <p style="margin: 0; font-size: 18px; color: #e0e0e0;">$3.1 trillion</p>
      </div>
      
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #ccc; font-weight: 500;">Language</h3>
        <p style="margin: 0; font-size: 18px; color: #e0e0e0;">English</p>
      </div>
      
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #ccc; font-weight: 500;">Currency</h3>
        <p style="margin: 0; font-size: 18px; color: #e0e0e0;">British Pound (GBP)</p>
      </div>
      
      <div style="margin-bottom: 25px; padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #ccc; font-weight: 500;">Quick Stats</h3>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 13px; color: #999;">Area</span>
          <span style="font-size: 13px; color: #4CAF50; font-weight: 500;">243,610 km²</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 13px; color: #999;">Density</span>
          <span style="font-size: 13px; color: #2196F3; font-weight: 500;">275/km²</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="font-size: 13px; color: #999;">Time Zone</span>
          <span style="font-size: 13px; color: #FF9800; font-weight: 500;">UTC+0</span>
        </div>
      </div>
    </div>
  `;

  sidebar.appendChild(sidebarContent);
  document.body.appendChild(sidebar);

  // Create all dashboard panels and toggle buttons (existing code)
  createDashboardPanels();

  // Create animated radar footer
  createRadarFooter();

selectedFeatures.on(['add', 'remove'], function () {
    const selectedCountries = selectedFeatures.getArray();
    
    // Clear any pending deselection timeout since we have a new selection event
    if (deselectionTimeout) {
      clearTimeout(deselectionTimeout);
      deselectionTimeout = null;
    }
    
    if (selectedCountries.length === 1) {
      // Store original view state only if this is the first selection
      if (!originalViewState) {
        const view = map.getView();
        originalViewState = {
          center: view.getCenter()!.slice(), // Clone the center array
          zoom: view.getZoom()!
        };
      }
      
      // Show sidebar for single country selection
      const selectedCountry = selectedCountries[0];
      const countryName = getCountryName(selectedCountry);
      const countryNameElement = document.getElementById('country-name');
      if (countryNameElement) {
        countryNameElement.textContent = countryName;
      }
      sidebar.style.left = '30px';
      
      // Zoom to the selected country
      const geometry = selectedCountry.getGeometry();
      if (geometry) {
        let extent = geometry.getExtent();
        
        // Special handling for United States - zoom to continental US only
        if (countryName.toLowerCase().includes('united states') || 
            countryName.toLowerCase().includes('usa') ||
            countryName.toLowerCase() === 'us') {
          // Continental US approximate extent (excludes Alaska and Hawaii)
          extent = [-14000000, 2800000, -7500000, 6500000]; // [minX, minY, maxX, maxY] in Web Mercator
        }
        
        map.getView().fit(extent, {
          duration: 800, // Smooth animation duration
          padding: [50, 50, 50, 50], // Padding around the country
          maxZoom: 6 // Don't zoom in too much for very small countries
        });
      }
      
    } else if (selectedCountries.length > 1) {
      // Store original view state only if this is the first selection
      if (!originalViewState) {
        const view = map.getView();
        originalViewState = {
          center: view.getCenter()!.slice(),
          zoom: view.getZoom()!
        };
      }
      
      // Show sidebar for multiple countries
      const countryNameElement = document.getElementById('country-name');
      if (countryNameElement) {
        countryNameElement.textContent = `${selectedCountries.length} Countries Selected`;
      }
      sidebar.style.left = '30px';
      
      // Zoom to fit all selected countries
      const allExtents = selectedCountries
        .map((feature: any) => feature.getGeometry()?.getExtent())
        .filter((extent: any) => extent !== undefined) as number[][];
      
      if (allExtents.length > 0) {
        // Calculate combined extent of all selected countries
        const combinedExtent = allExtents.reduce((combined: number[], extent: number[]) => {
          return [
            Math.min(combined[0], extent[0]), // min x
            Math.min(combined[1], extent[1]), // min y
            Math.max(combined[2], extent[2]), // max x
            Math.max(combined[3], extent[3])  // max y
          ];
        });
        
        map.getView().fit(combinedExtent, {
          duration: 800,
          padding: [50, 50, 50, 50],
          maxZoom: 6
        });
      }
      
    } else {
      // Immediately handle deselection - no timeout needed for direct deselection
      sidebar.style.left = '-380px';
      
      // Return to original view state if we have it stored
      if (originalViewState) {
        map.getView().animate({
          center: originalViewState.center,
          zoom: originalViewState.zoom,
          duration: 800
        });
        originalViewState = null; // Clear the stored state
      }
    }
  });
}

// Function to create dashboard panels (extracted from the existing code)
function createDashboardPanels() {
  // All the existing dashboard creation code goes here...
  // (I'll keep this condensed for brevity but include the full implementation)
  
  // Create dashboard panels on the right side
  const dailyMemoPanel = document.createElement('div');
  dailyMemoPanel.id = 'daily-memo-panel';
  dailyMemoPanel.style.cssText = `
    position: fixed;
    top: 80px;
    right: 30px;
    width: 320px;
    height: 420px;
    background: rgba(0, 0, 0, 0.85);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    padding: 25px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: white;
    overflow-y: auto;
  `;

  const dailyMemoContent = document.createElement('div');
  dailyMemoContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: white;">Daily Memo</h3>
      <button id="close-daily-memo" style="
        background: none;
        border: none;
        color: #999;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: color 0.2s ease;
      " onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#999'">×</button>
    </div>
    
    <div style="space-y: 15px;">
      <div style="margin-bottom: 15px;">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #ccc; font-weight: 500;">Key Updates</h4>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #e0e0e0;">• Market analysis for Q4 expansion</p>
        <p style="margin: 4px 0 0 0; font-size: 13px; line-height: 1.5; color: #e0e0e0;">• Regional performance review</p>
        <p style="margin: 4px 0 0 0; font-size: 13px; line-height: 1.5; color: #e0e0e0;">• Customer feedback integration</p>
      </div>
      
      <div style="margin-bottom: 15px;">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #ccc; font-weight: 500;">Today's Focus</h4>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #e0e0e0;">Review expansion opportunities in EMEA region and assess market readiness for new product launches.</p>
      </div>
      
      <div style="margin-bottom: 15px;">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #ccc; font-weight: 500;">Metrics</h4>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 12px; color: #999;">Active Regions</span>
          <span style="font-size: 12px; color: #4CAF50; font-weight: 500;">12</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 12px; color: #999;">Coverage</span>
          <span style="font-size: 12px; color: #2196F3; font-weight: 500;">85%</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="font-size: 12px; color: #999;">Growth Rate</span>
          <span style="font-size: 12px; color: #FF9800; font-weight: 500;">+14%</span>
        </div>
      </div>
    </div>
  `;

  dailyMemoPanel.appendChild(dailyMemoContent);
  document.body.appendChild(dailyMemoPanel);

  // Plan of Action Panel
  const planActionPanel = document.createElement('div');
  planActionPanel.id = 'plan-action-panel';
  planActionPanel.style.cssText = `
    position: fixed;
    top: 520px;
    right: 30px;
    width: 320px;
    height: 250px;
    background: rgba(0, 0, 0, 0.85);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    padding: 25px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: white;
    overflow-y: auto;
  `;

  const planActionContent = document.createElement('div');
  planActionContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: white;">Plan of Action</h3>
      <button id="close-plan-action" style="
        background: none;
        border: none;
        color: #999;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: color 0.2s ease;
      " onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#999'">×</button>
    </div>
    
    <div style="space-y: 12px;">
      <div style="margin-bottom: 12px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 13px; color: #e0e0e0; font-weight: 500;">Market Research</span>
          <span style="font-size: 11px; color: #FF9800; background: rgba(255, 152, 0, 0.1); padding: 2px 6px; border-radius: 4px;">High Priority</span>
        </div>
        <p style="margin: 0; font-size: 12px; color: #ccc; line-height: 1.4;">Analyze competitor presence in Southeast Asia</p>
      </div>
      
      <div style="margin-bottom: 12px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 13px; color: #e0e0e0; font-weight: 500;">Team Review</span>
          <span style="font-size: 11px; color: #4CAF50; background: rgba(76, 175, 80, 0.1); padding: 2px 6px; border-radius: 4px;">Medium</span>
        </div>
        <p style="margin: 0; font-size: 12px; color: #ccc; line-height: 1.4;">Schedule quarterly assessment meeting</p>
      </div>
      
      <div style="margin-bottom: 12px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 13px; color: #e0e0e0; font-weight: 500;">Data Collection</span>
          <span style="font-size: 11px; color: #2196F3; background: rgba(33, 150, 243, 0.1); padding: 2px 6px; border-radius: 4px;">Low</span>
        </div>
        <p style="margin: 0; font-size: 12px; color: #ccc; line-height: 1.4;">Update regional performance metrics</p>
      </div>
    </div>
  `;

  planActionPanel.appendChild(planActionContent);
  document.body.appendChild(planActionPanel);

  // Create toggle buttons and add functionality...
  // (Continuing with the rest of the dashboard creation code)
  
  // Create toggle buttons container
  const toggleButtonsContainer = document.createElement('div');
  toggleButtonsContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 30px;
    display: flex;
    flex-direction: row;
    gap: 15px;
    z-index: 1001;
  `;

  // Daily Memo toggle button
  const dailyMemoToggle = document.createElement('button');
  dailyMemoToggle.id = 'toggle-daily-memo';
  dailyMemoToggle.innerHTML = '📝';
  dailyMemoToggle.title = 'Toggle Daily Memo';
  dailyMemoToggle.style.cssText = `
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  // Plan of Action toggle button
  const planActionToggle = document.createElement('button');
  planActionToggle.id = 'toggle-plan-action';
  planActionToggle.innerHTML = '📋';
  planActionToggle.title = 'Toggle Plan of Action';
  planActionToggle.style.cssText = `
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  // Add hover effects
  [dailyMemoToggle, planActionToggle].forEach(button => {
    button.addEventListener('mouseenter', function(this: HTMLButtonElement) {
      this.style.background = 'rgba(0, 0, 0, 0.95)';
      this.style.borderColor = 'rgba(255, 255, 255, 0.4)';
      this.style.transform = 'scale(1.05)';
    });
    
    button.addEventListener('mouseleave', function(this: HTMLButtonElement) {
      this.style.background = 'rgba(0, 0, 0, 0.8)';
      this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      this.style.transform = 'scale(1)';
    });
  });

  toggleButtonsContainer.appendChild(dailyMemoToggle);
  toggleButtonsContainer.appendChild(planActionToggle);
  document.body.appendChild(toggleButtonsContainer);

  // Add close functionality
  document.getElementById('close-daily-memo')?.addEventListener('click', function() {
    dailyMemoPanel.style.display = 'none';
  });

  document.getElementById('close-plan-action')?.addEventListener('click', function() {
    planActionPanel.style.display = 'none';
  });

  // Add toggle functionality
  dailyMemoToggle.addEventListener('click', function() {
    if (dailyMemoPanel.style.display === 'none') {
      dailyMemoPanel.style.display = 'block';
    } else {
      dailyMemoPanel.style.display = 'none';
    }
  });

  planActionToggle.addEventListener('click', function() {
    if (planActionPanel.style.display === 'none') {
      planActionPanel.style.display = 'block';
    } else {
      planActionPanel.style.display = 'none';
    }
  });
}

// Function to create animated radar footer
function createRadarFooter() {
  // Create footer container
  const footer = document.createElement('div');
  footer.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 15px;
    z-index: 1000;
  `;

  // Create radar container
  const radarContainer = document.createElement('div');
  radarContainer.id = 'radar';
  radarContainer.style.cssText = `
    position: relative;
    width: 30px;
    height: 30px;
    background: black;
    border-radius: 50%;
  `;

  // Create canvas for radar animation
  const canvas = document.createElement('canvas');
  const diameter = 30;
  const radius = diameter / 2;
  canvas.width = diameter;
  canvas.height = diameter;
  canvas.style.cssText = `
    width: ${diameter}px;
    height: ${diameter}px;
    display: block;
  `;

  const ctx = canvas.getContext('2d')!;

  // Radar animation variables
  let sweepAngle = 270;
  const sweepSize = 2;
  const sweepSpeed = 1.2;
  const rings = 3; // Reduced for smaller size
  const hueStart = 120;
  const hueEnd = 170;
  const hueDiff = Math.abs(hueEnd - hueStart);
  const saturation = 60;
  const lightness = 50;
  const lineWidth = 1;

  // Create gradient
  const gradient = ctx.createLinearGradient(radius, 0, 0, 0);
  gradient.addColorStop(0, `hsla(${hueStart}, ${saturation}%, ${lightness}%, 1)`);
  gradient.addColorStop(1, `hsla(${hueEnd}, ${saturation}%, ${lightness}%, 0.1)`);

  // Utility function
  const dToR = (degrees: number) => degrees * (Math.PI / 180);

  // Render functions
  const renderRings = () => {
    for (let i = 0; i < rings; i++) {
      ctx.beginPath();
      ctx.arc(radius, radius, ((radius - (lineWidth / 2)) / rings) * (i + 1), 0, Math.PI * 2, false);
      ctx.strokeStyle = `hsla(${hueEnd - (i * (hueDiff / rings))}, ${saturation}%, ${lightness}%, 0.3)`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  };

  const renderGrid = () => {
    ctx.beginPath();
    ctx.moveTo(radius - lineWidth / 2, lineWidth);
    ctx.lineTo(radius - lineWidth / 2, diameter - lineWidth);
    ctx.moveTo(lineWidth, radius - lineWidth / 2);
    ctx.lineTo(diameter - lineWidth, radius - lineWidth / 2);
    ctx.strokeStyle = `hsla(${(hueStart + hueEnd) / 2}, ${saturation}%, ${lightness}%, 0.2)`;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  const renderSweep = () => {
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(dToR(sweepAngle));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius - 1, dToR(-sweepSize), dToR(sweepSize), false);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  };

  const clearCanvas = () => {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'hsla(0, 0%, 0%, 0.1)';
    ctx.fillRect(0, 0, diameter, diameter);
  };

  const draw = () => {
    ctx.globalCompositeOperation = 'lighter';
    renderRings();
    renderGrid();
    renderSweep();
  };

  // Animation loop
  const animate = () => {
    clearCanvas();
    sweepAngle += sweepSpeed;
    draw();
    requestAnimationFrame(animate);
  };

  // Create text label
  const label = document.createElement('span');
  label.textContent = 'RADAR by Sydnee, Andy, Max, and Liam';
  label.style.cssText = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: black;
    letter-spacing: 0.5px;
  `;

  // Assemble footer
  radarContainer.appendChild(canvas);
  footer.appendChild(radarContainer);
  footer.appendChild(label);
  document.body.appendChild(footer);

  // Start animation
  animate();
}
