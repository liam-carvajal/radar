import './style.css'
import 'ol/ol.css'
import GeoJSON from 'ol/format/GeoJSON.js';
import Map from 'ol/Map.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import View from 'ol/View.js';
import {Select} from 'ol/interaction.js';
import {Fill, Stroke, Style} from 'ol/style.js';
import Feature from 'ol/Feature.js';
import { apiService } from './api';
import type { CountryNewsData } from './api';

// Global variables to track initialization state
let mapInitialized = false;
let map: Map;
let vectorSource: VectorSource;
let selectedFeatures: any;
let sidebar: HTMLDivElement;
let countryDataCache: { [country: string]: CountryNewsData } = {};
let countriesWithData: string[] = [];

// Function to fetch countries that have actual data
async function fetchCountriesWithData(): Promise<void> {
  try {
    const response = await fetch('http://localhost:3001/api/countries-with-data');
    const data = await response.json();
    if (data.success) {
      countriesWithData = data.data;
      console.log('Countries with data:', countriesWithData);
    }
  } catch (error) {
    console.error('Failed to fetch countries with data:', error);
  }
}

// Function to get country name from feature (handles different property structures)
function getCountryName(feature: any): string {
  return feature.get('NAME') || feature.get('name') || 'Unknown';
}

// Function to map backend region names to map country names
function mapBackendToMapCountry(backendName: string): string {
  const mapping: { [key: string]: string } = {
    'US': 'United States of America', // Map to the exact GeoJSON name
    'United States': 'United States of America',
    'Mexico': 'Mexico',
    'Canada': 'Canada',
    'Japan': 'Japan',
    'South Korea': 'South Korea',
    'China': 'China',
    'Singapore': 'Singapore',
    'Australia': 'Australia',
    'France': 'France',
    'Spain': 'Spain',
    'Germany': 'Germany',
    'Italy': 'Italy',
    'Portugal': 'Portugal',
    'India': 'India',
    'Netherlands': 'Netherlands',
    'Brazil': 'Brazil',
    'United Kingdom': 'United Kingdom'
  };
  return mapping[backendName] || backendName;
}

// Function to map map country names to backend names
function mapMapToBackendCountry(mapName: string): string {
  const mapping: { [key: string]: string } = {
    'United States': 'US',
    'United States of America': 'US',
    'USA': 'US',
    'Mexico': 'Mexico',
    'Canada': 'Canada',
    'Japan': 'Japan',
    'South Korea': 'South Korea',
    'China': 'China',
    'Singapore': 'Singapore',
    'Australia': 'Australia',
    'France': 'France',
    'Spain': 'Spain',
    'Germany': 'Germany',
    'Italy': 'Italy',
    'Portugal': 'Portugal',
    'India': 'India',
    'Netherlands': 'Netherlands',
    'Brazil': 'Brazil',
    'United Kingdom': 'United Kingdom',
    'UK': 'United Kingdom',
    'Great Britain': 'United Kingdom'
  };
  return mapping[mapName] || mapName;
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

// Function to get a color based on the overall score (red to green gradient)
function getScoreColor(score: number): string {
  if (score <= 1) {
    return '#FF0000'; // Pure red for score 1
  } else if (score >= 10) {
    return '#00FF00'; // Pure green for score 10
  } else {
    // Interpolate between red and green
    const normalizedScore = (score - 1) / 9; // 0 to 1
    
    // Red component decreases from 255 to 0
    const red = Math.round(255 * (1 - normalizedScore));
    // Green component increases from 0 to 255
    const green = Math.round(255 * normalizedScore);
    // Blue component stays at 0 for pure red-green transition
    const blue = 0;
    
    return `rgb(${red}, ${green}, ${blue})`;
  }
}

// Function to load all country data and update map
async function loadAllCountryData() {
  try {
    console.log('Loading all country data...');
    const allNews = await apiService.getAllNews();
    if (allNews.success) {
      // Map backend data to map country names
      const mappedData: { [country: string]: CountryNewsData } = {};
      Object.entries(allNews.data.countries).forEach(([backendName, data]) => {
        const mapName = mapBackendToMapCountry(backendName);
        mappedData[mapName] = data as CountryNewsData;
      });
      countryDataCache = mappedData;
      // Trigger map re-render to update colors
      if (map) {
        map.render();
      }
      console.log(`Loaded data for ${Object.keys(countryDataCache).length} countries`);
    }
  } catch (error) {
    console.error('Failed to load country data:', error);
  }
}

// Listen for the initialization event from homescreen
window.addEventListener('initializeMap', initializeMap);

function initializeMap() {
  if (mapInitialized) return;
  
  console.log('Initializing map...');
  mapInitialized = true;

  // Fetch countries with data first
  fetchCountriesWithData();

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
    // Re-render map once features are loaded and we have countries data
    if (map && countriesWithData.length > 0) {
      map.render();
    }
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
          const backendCountryName = mapMapToBackendCountry(countryName);
          
          // Check if this country has data available
          if (!countriesWithData.includes(backendCountryName)) {
            // Country has no data - light gray, not clickable
            const fill = style.getFill();
            const stroke = style.getStroke();
            if (fill) {
              fill.setColor('rgba(200, 200, 200, 0.3)');
            }
            if (stroke) {
              stroke.setColor('rgba(255, 255, 255, 0.5)');
              stroke.setWidth(1);
            }
            return style;
          }
          
          // Check if we have cached data for this country
          const countryData = countryDataCache[backendCountryName];
          let color = 'rgba(100, 150, 200, 0.6)'; // Default blue for clickable countries
          
          if (countryData && countryData.overallScore) {
            // Color based on overall score (red to green gradient)
            const score = countryData.overallScore;
            color = getScoreColor(score);
          }
          
          const fill = style.getFill();
          const stroke = style.getStroke();
          if (fill) {
            fill.setColor(color);
          }
          if (stroke) {
            stroke.setColor('rgba(255, 255, 255, 0.8)');
            stroke.setWidth(countryData ? 2 : 1.5);
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

  // Ensure only single selection by clearing previous selections
  select.on('select', function(event) {
    if (event.selected.length > 0 && selectedFeatures.getLength() > 1) {
      // Clear all and select only the most recent
      const newSelection = event.selected[event.selected.length - 1];
      selectedFeatures.clear();
      selectedFeatures.push(newSelection);
    }
  });

  selectedFeatures = select.getFeatures();

  // Add click handler for deselecting when clicking on ocean/empty areas
  map.on('click', function(evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
      return feature;
    });
    
    // If no feature was clicked (ocean/empty area), clear selection
    if (!feature) {
      selectedFeatures.clear();
    }
  });

  // Add double-click handler to clear selection
  map.on('dblclick', function(evt) {
    selectedFeatures.clear();
  });

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
      const countryData = countryDataCache[countryName];
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
      
      // Show tooltip if country has data
      if (countryData && countryData.overallScore) {
        const tooltip = document.createElement('div');
        tooltip.id = 'country-tooltip';
        tooltip.style.cssText = `
          position: absolute;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          pointer-events: none;
          z-index: 10000;
          white-space: nowrap;
        `;
        tooltip.textContent = `${countryName} - Score: ${countryData.overallScore.toFixed(1)}`;
        document.body.appendChild(tooltip);
        
        // Position tooltip near mouse
        const mousePos = evt.pixel;
        tooltip.style.left = (mousePos[0] + 10) + 'px';
        tooltip.style.top = (mousePos[1] - 30) + 'px';
      }
    } else if (!(feature instanceof Feature)) {
      hoveredFeature = null;
      // Remove tooltip
      const tooltip = document.getElementById('country-tooltip');
      if (tooltip) {
        tooltip.remove();
      }
    }
  });

  // Reset hover when mouse leaves the map
  map.getViewport().addEventListener('mouseleave', function() {
    if (hoveredFeature && !selectedFeatures.getArray().includes(hoveredFeature)) {
      hoveredFeature.setStyle(undefined);
      hoveredFeature = null;
    }
    // Remove tooltip
    const tooltip = document.getElementById('country-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  });

  // Store original view state for returning after zoom
  let originalViewState: { center: number[], zoom: number } | null = null;

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

  // Load initial data
  loadAllCountryData();

  // Function to update sidebar content with country data
  function updateSidebarContent(countryName: string, countryData: CountryNewsData | null, isLoading: boolean, errorMessage?: string) {
    const sidebarContent = sidebar.querySelector('div');
    if (!sidebarContent) return;

    if (isLoading) {
      sidebarContent.innerHTML = `
        <div style="border-bottom: 2px solid rgba(255, 255, 255, 0.2); padding-bottom: 20px; margin-bottom: 30px;">
          <h2 id="country-name" style="margin: 0; font-size: 28px; color: white; font-weight: 600;">${countryName}</h2>
        </div>
        <div style="text-align: center; padding: 40px 0;">
          <div style="width: 40px; height: 40px; border: 3px solid rgba(255, 255, 255, 0.3); border-top: 3px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
          <p style="color: #ccc; margin: 0;">Loading country data...</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      return;
    }

    if (errorMessage) {
      sidebarContent.innerHTML = `
        <div style="border-bottom: 2px solid rgba(255, 255, 255, 0.2); padding-bottom: 20px; margin-bottom: 30px;">
          <h2 id="country-name" style="margin: 0; font-size: 28px; color: white; font-weight: 600;">${countryName}</h2>
        </div>
        <div style="text-align: center; padding: 40px 0;">
          <p style="color: #ff6b6b; margin: 0;">${errorMessage}</p>
        </div>
      `;
      return;
    }

    if (!countryData) {
      sidebarContent.innerHTML = `
        <div style="border-bottom: 2px solid rgba(255, 255, 255, 0.2); padding-bottom: 20px; margin-bottom: 30px;">
          <h2 id="country-name" style="margin: 0; font-size: 28px; color: white; font-weight: 600;">${countryName}</h2>
        </div>
        <div style="text-align: center; padding: 40px 0;">
          <p style="color: #ccc; margin: 0;">No data available for this country</p>
        </div>
      `;
      return;
    }

    // Generate content for industries
    const industriesContent = Object.entries(countryData.industries || countryData.industryScores || {}).map(([industry, data], index) => {
      // Handle both old and new data structures
      const industryData = data as any;
      const averagePositivity = industryData.averagePositivity || industryData.positivityScore || 0;
      const averageImportance = industryData.averageImportance || industryData.importanceScore || 0;
      
      // If we have news items, display them
      let newsItems = '';
      if (countryData.industries && countryData.industries[industry]) {
        // New structure: industry-specific news
        const industryNews = countryData.industries[industry];
        if (Array.isArray(industryNews)) {
          // New structure with array of news items
          newsItems = industryNews.map((news: any, newsIndex: number) => {
            const link = news.link || '';
            
            return `
              <div style="margin-bottom: 15px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #e0e0e0; line-height: 1.4;">
                  <a href="#" onclick="window.open('${link}', '_blank'); return false;" style="color: #2196F3; text-decoration: none; cursor: pointer;">${news.title} ↗</a>
                </p>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999;">
                  <span>Positivity: ${news.positivityScore}/10</span>
                  <span>Importance: ${news.importanceScore}/10</span>
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #ccc; line-height: 1.3;">
                  ${news.effect || ''}
                </div>
              </div>
            `;
          }).join('');
        } else {
          // Old structure with news array
          const newsArray = (industryNews as any).news || [];
          newsItems = newsArray.map((news: any, newsIndex: number) => {
            const link = news.link || '';
            
            return `
              <div style="margin-bottom: 15px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #e0e0e0; line-height: 1.4;">
                  <a href="#" onclick="window.open('${link}', '_blank'); return false;" style="color: #2196F3; text-decoration: none; cursor: pointer;">${news.title} ↗</a>
                </p>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999;">
                  <span>Positivity: ${news.positivityScore}/10</span>
                  <span>Importance: ${news.importanceScore}/10</span>
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #ccc; line-height: 1.3;">
                  ${news.effect || ''}
                </div>
              </div>
            `;
          }).join('');
        }
      } else if (countryData.newsTitles) {
        // Fallback to old structure
        newsItems = countryData.newsTitles.map((title: string, newsIndex: number) => {
          const link = countryData.newsLinks?.[newsIndex] || '';
          
          return `
            <div style="margin-bottom: 15px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #4CAF50; font-weight: 600;">${industry}</h4>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #e0e0e0; line-height: 1.4;">
                <a href="#" onclick="window.open('${link}', '_blank'); return false;" style="color: #2196F3; text-decoration: none; cursor: pointer;">${title} ↗</a>
              </p>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999;">
                <span>News Item ${newsIndex + 1}</span>
                <span>Industry: ${industry}</span>
              </div>
            </div>
          `;
        }).join('');
      }

      return `
        <div id="industry-${index}" style="margin-bottom: 25px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden;">
          <div class="industry-header" data-industry-index="${index}" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(255, 255, 255, 0.05); cursor: pointer;">
            <h3 style="margin: 0; font-size: 16px; color: #ccc; font-weight: 500; text-transform: capitalize;">${industry}</h3>
            <button class="minimize-industry-btn" data-industry-index="${index}" style="
              background: none;
              border: none;
              color: #999;
              font-size: 18px;
              cursor: pointer;
              padding: 0;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 4px;
              transition: color 0.2s ease;
            ">−</button>
          </div>
          <div id="industry-content-${index}" class="industry-content" style="padding: 15px; display: block;">
            <div style="margin-bottom: 10px; padding: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 12px; color: #999;">Avg Positivity</span>
                <span style="font-size: 12px; color: #4CAF50; font-weight: 500;">${averagePositivity.toFixed(1)}/10</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="font-size: 12px; color: #999;">Avg Importance</span>
                <span style="font-size: 12px; color: #2196F3; font-weight: 500;">${averageImportance.toFixed(1)}/10</span>
              </div>
            </div>
            ${newsItems}
          </div>
        </div>
      `;
    }).join('');

      sidebarContent.innerHTML = `
    <div style="border-bottom: 2px solid rgba(255, 255, 255, 0.2); padding-bottom: 20px; margin-bottom: 30px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <h2 id="country-name" style="margin: 0; font-size: 28px; color: white; font-weight: 600;">${countryName}</h2>
        <button id="close-country-sidebar" style="
          background: none;
          border: none;
          color: #999;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: color 0.2s ease;
        " onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#999'">×</button>
      </div>
      <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">Last updated: ${new Date(countryData.lastUpdated).toLocaleString()}</p>
    </div>
      
      <div style="margin-bottom: 25px; padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #ccc; font-weight: 500;">Overall Score</h3>
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: conic-gradient(from 0deg, ${getScoreColor(countryData.overallScore)} 0deg, ${getScoreColor(countryData.overallScore)} ${countryData.overallScore * 36}deg, rgba(255, 255, 255, 0.1) ${countryData.overallScore * 36}deg); display: flex; align-items: center; justify-content: center; margin-right: 15px;">
            <span style="font-size: 18px; font-weight: 600; color: white;">${countryData.overallScore.toFixed(1)}</span>
          </div>
          <div>
            <p style="margin: 0; font-size: 14px; color: #e0e0e0;">Overall Market Sentiment</p>
            <p style="margin: 0; font-size: 12px; color: #999;">Based on ${Object.keys(countryData.industries || countryData.industryScores || {}).length} industries</p>
          </div>
        </div>
      </div>
      
      <div style="space-y: 20px;">
        ${industriesContent}
      </div>
    `;

    // Add event listeners for industry interactions
    setTimeout(() => {
      // Add click handler for close country sidebar button
      const closeCountryBtn = document.getElementById('close-country-sidebar');
      if (closeCountryBtn) {
        closeCountryBtn.addEventListener('click', () => {
          selectedFeatures.clear(); // This will trigger the sidebar to close
        });
      }

      // Add click handlers for industry headers (toggle expand/collapse)
      const industryHeaders = sidebar.querySelectorAll('.industry-header');
      industryHeaders.forEach(header => {
        header.addEventListener('click', (e) => {
          // Don't toggle if clicking the minimize button
          if ((e.target as HTMLElement).classList.contains('minimize-industry-btn')) {
            return;
          }
          
          const index = (header as HTMLElement).getAttribute('data-industry-index');
          const content = document.getElementById(`industry-content-${index}`);
          const button = header.querySelector('.minimize-industry-btn') as HTMLElement;
          
          if (content && button) {
            if (content.style.display === 'none') {
              content.style.display = 'block';
              button.textContent = '−';
              button.title = 'Minimize section';
            } else {
              content.style.display = 'none';
              button.textContent = '+';
              button.title = 'Expand section';
            }
          }
        });
      });

      // Add click handlers for minimize/expand buttons
      const minimizeButtons = sidebar.querySelectorAll('.minimize-industry-btn');
      minimizeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent header click
          
          const index = (button as HTMLElement).getAttribute('data-industry-index');
          const content = document.getElementById(`industry-content-${index}`);
          
          if (content) {
            if (content.style.display === 'none') {
              content.style.display = 'block';
              (button as HTMLElement).textContent = '−';
              (button as HTMLElement).title = 'Minimize section';
            } else {
              content.style.display = 'none';
              (button as HTMLElement).textContent = '+';
              (button as HTMLElement).title = 'Expand section';
            }
          }
        });

        // Add hover effects for minimize buttons
        button.addEventListener('mouseenter', () => {
          (button as HTMLElement).style.color = '#4CAF50';
        });
        
        button.addEventListener('mouseleave', () => {
          (button as HTMLElement).style.color = '#999';
        });
      });
    }, 100);
  }

  // Add event listeners for selected features
  selectedFeatures.on(['add', 'remove'], async function () {
    const selectedCountries = selectedFeatures.getArray();
    
    // Check if selected country has data - if not, deselect it
    if (selectedCountries.length === 1) {
      const selectedCountry = selectedCountries[0];
      const countryName = getCountryName(selectedCountry);
      const backendCountryName = mapMapToBackendCountry(countryName);
      
      if (!countriesWithData.includes(backendCountryName)) {
        console.log(`${countryName} has no data available, deselecting...`);
        selectedFeatures.clear();
        return;
      }
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
      const backendCountryName = mapMapToBackendCountry(countryName);
      const countryNameElement = document.getElementById('country-name');
      if (countryNameElement) {
        countryNameElement.textContent = countryName;
      }
      
      // Show loading state
      sidebar.style.left = '30px';
      updateSidebarContent(countryName, null, true);
      
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
      
      // Fetch country data from backend
      try {
        const backendCountryName = mapMapToBackendCountry(countryName);
        console.log(`Mapping: "${countryName}" -> "${backendCountryName}"`);
        
        const countryData = await apiService.getCountryNews(backendCountryName);
        console.log(`API response for ${backendCountryName}:`, countryData);
        
        if (countryData.success) {
          // Cache the data and update map
          countryDataCache[countryName] = countryData.data;
          map.render();
          updateSidebarContent(countryName, countryData.data, false);
        } else {
          console.error(`No data for ${backendCountryName}:`, countryData);
          updateSidebarContent(countryName, null, false, 'No data available for this country');
        }
      } catch (error) {
        console.error('Failed to fetch country data:', error);
        updateSidebarContent(countryName, null, false, 'Failed to load data');
      }
      
    } else {
      // No selection - hide sidebar and return to original view
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

  // Create legend panel
  const legendPanel = document.createElement('div');
  legendPanel.id = 'legend-panel';
  legendPanel.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 30px;
    width: 280px;
    background: rgba(0, 0, 0, 0.85);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    padding: 20px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: white;
  `;

  const legendContent = document.createElement('div');
  legendContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: white;">Market Sentiment Legend</h3>
      <button id="close-legend" style="
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
    
    <div style="space-y: 10px;">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="width: 20px; height: 20px; background: #00FF00; border-radius: 4px; margin-right: 12px;"></div>
        <span style="font-size: 13px; color: #e0e0e0;">Excellent (8-10)</span>
      </div>
      
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="width: 20px; height: 20px; background: #80FF80; border-radius: 4px; margin-right: 12px;"></div>
        <span style="font-size: 13px; color: #e0e0e0;">Good (6-7)</span>
      </div>
      
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="width: 20px; height: 20px; background: #FFFF00; border-radius: 4px; margin-right: 12px;"></div>
        <span style="font-size: 13px; color: #e0e0e0;">Neutral (4-5)</span>
      </div>
      
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="width: 20px; height: 20px; background: #FF8000; border-radius: 4px; margin-right: 12px;"></div>
        <span style="font-size: 13px; color: #e0e0e0;">Poor (2-3)</span>
      </div>
      
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="width: 20px; height: 20px; background: #FF0000; border-radius: 4px; margin-right: 12px;"></div>
        <span style="font-size: 13px; color: #e0e0e0;">Very Poor (1)</span>
      </div>
      
      <div style="display: flex; align-items: center;">
        <div style="width: 20px; height: 20px; background: #ffffff; border-radius: 4px; margin-right: 12px;"></div>
        <span style="font-size: 13px; color: #e0e0e0;">No Data</span>
      </div>
    </div>
    
    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
      <p style="margin: 0; font-size: 11px; color: #999; line-height: 1.4;">
        Colors indicate overall market sentiment based on recent news analysis across beauty/wellness, clothing/apparel, retail, and ticketing/events industries. Red = negative, Green = positive.
      </p>
    </div>
  `;

  legendPanel.appendChild(legendContent);
  document.body.appendChild(legendPanel);

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

  // Refresh News button
  const refreshNewsButton = document.createElement('button');
  refreshNewsButton.id = 'refresh-news';
  refreshNewsButton.type = 'button'; // Prevent form submission
  refreshNewsButton.innerHTML = '🔄';
  refreshNewsButton.title = 'Refresh News Data (Fetch latest news from multiple sources)';
  refreshNewsButton.style.cssText = `
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

  // Legend toggle button
  const legendToggle = document.createElement('button');
  legendToggle.id = 'toggle-legend';
  legendToggle.innerHTML = '🎨';
  legendToggle.title = 'Toggle Legend';
  legendToggle.style.cssText = `
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
  [dailyMemoToggle, planActionToggle, legendToggle, refreshNewsButton].forEach(button => {
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

  // Create loading overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'loading-overlay';
  loadingOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const loadingContent = document.createElement('div');
  loadingContent.style.cssText = `
    background: rgba(0, 0, 0, 0.9);
    padding: 40px;
    border-radius: 12px;
    text-align: center;
    color: white;
    max-width: 400px;
    width: 90%;
  `;

  loadingContent.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="width: 60px; height: 60px; border: 4px solid rgba(255, 255, 255, 0.3); border-top: 4px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
    </div>
    <h3 style="margin: 0 0 15px 0; font-size: 18px; color: white;">Updating News Data</h3>
    <p style="margin: 0 0 20px 0; font-size: 14px; color: #ccc;">Fetching latest news from multiple sources...</p>
    <div style="background: rgba(255, 255, 255, 0.1); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 15px;">
      <div id="progress-bar" style="height: 100%; background: linear-gradient(90deg, #4CAF50, #2196F3); width: 0%; transition: width 0.3s ease;"></div>
    </div>
    <p id="progress-text" style="margin: 0; font-size: 12px; color: #999;">Initializing...</p>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;

  loadingOverlay.appendChild(loadingContent);
  document.body.appendChild(loadingOverlay);

  // Add refresh news functionality
  refreshNewsButton.addEventListener('click', async function(event) {
    // Prevent default browser behavior
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    console.log('Refresh button clicked!');
    
    try {
      // Show loading overlay
      loadingOverlay.style.display = 'flex';
      const progressBar = document.getElementById('progress-bar') as HTMLElement;
      const progressText = document.getElementById('progress-text') as HTMLElement;
      
      console.log('Loading overlay displayed');
      
      // Simulate progress updates
      const updateProgress = (percent: number, text: string) => {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = text;
        console.log(`Progress: ${percent}% - ${text}`);
      };

      updateProgress(5, 'Initializing deep research model...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      updateProgress(15, 'Connecting to news sources...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      updateProgress(25, 'Searching for recent articles...');
      await new Promise(resolve => setTimeout(resolve, 4000));

      updateProgress(35, 'Analyzing market sentiment...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      updateProgress(45, 'Processing country-specific data...');
      await new Promise(resolve => setTimeout(resolve, 4000));

      updateProgress(55, 'Evaluating industry impacts...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      updateProgress(65, 'Calculating sentiment scores...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      updateProgress(75, 'Validating news sources...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      updateProgress(85, 'Updating map data...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Actually trigger the backend update
      const updateResponse = await apiService.updateNews();
      
      if (updateResponse.success) {
        updateProgress(95, 'Finalizing updates...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        updateProgress(100, 'Update complete!');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reload all country data
        await loadAllCountryData();
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(76, 175, 80, 0.9);
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          z-index: 10001;
          animation: slideDown 0.3s ease;
        `;
        successMessage.textContent = '✅ News data updated successfully!';
        document.body.appendChild(successMessage);
        
        // Remove success message after 3 seconds
        setTimeout(() => {
          successMessage.remove();
        }, 3000);
        
        // Add slideDown animation
        const style = document.createElement('style');
        style.textContent = `
          @keyframes slideDown {
            from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
        
      } else {
        throw new Error('Backend update failed');
      }
      
    } catch (error) {
      console.error('Failed to refresh news:', error);
      
      // Show error message
      const errorMessage = document.createElement('div');
      errorMessage.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(244, 67, 54, 0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 10001;
        animation: slideDown 0.3s ease;
      `;
      errorMessage.textContent = '❌ Failed to update news data';
      document.body.appendChild(errorMessage);
      
      // Remove error message after 3 seconds
      setTimeout(() => {
        errorMessage.remove();
      }, 3000);
      
    } finally {
      // Hide loading overlay
      loadingOverlay.style.display = 'none';
    }
    
    // Return false to prevent any default behavior
    return false;
  });

  toggleButtonsContainer.appendChild(refreshNewsButton);
  toggleButtonsContainer.appendChild(dailyMemoToggle);
  toggleButtonsContainer.appendChild(planActionToggle);
  toggleButtonsContainer.appendChild(legendToggle);
  document.body.appendChild(toggleButtonsContainer);

  // Test if refresh button is accessible
  setTimeout(() => {
    const testButton = document.getElementById('refresh-news');
    if (testButton) {
      console.log('✅ Refresh button found in DOM');
      console.log('Button position:', testButton.getBoundingClientRect());
      console.log('Button visible:', testButton.offsetParent !== null);
      
      // Test if button is clickable
      testButton.addEventListener('click', function(e) {
        console.log('🎯 Test click detected!');
        e.preventDefault();
        e.stopPropagation();
        alert('Refresh button is working!');
      }, { once: true });
      
    } else {
      console.log('❌ Refresh button not found in DOM');
    }
  }, 1000);

  // Add close functionality
  document.getElementById('close-daily-memo')?.addEventListener('click', function() {
    dailyMemoPanel.style.display = 'none';
  });

  document.getElementById('close-plan-action')?.addEventListener('click', function() {
    planActionPanel.style.display = 'none';
  });

  document.getElementById('close-legend')?.addEventListener('click', function() {
    legendPanel.style.display = 'none';
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

  legendToggle.addEventListener('click', function() {
    if (legendPanel.style.display === 'none') {
      legendPanel.style.display = 'block';
    } else {
      legendPanel.style.display = 'none';
    }
  });

  // Create zoom controls
  const zoomControls = document.createElement('div');
  zoomControls.style.cssText = `
    position: fixed;
    top: 20px;
    left: 30px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 1001;
  `;

  // Zoom in button
  const zoomInButton = document.createElement('button');
  zoomInButton.id = 'zoom-in';
  zoomInButton.innerHTML = '+';
  zoomInButton.title = 'Zoom In';
  zoomInButton.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 20px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  // Zoom out button
  const zoomOutButton = document.createElement('button');
  zoomOutButton.id = 'zoom-out';
  zoomOutButton.innerHTML = '−';
  zoomOutButton.title = 'Zoom Out';
  zoomOutButton.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 20px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  // Add hover effects for zoom buttons
  [zoomInButton, zoomOutButton].forEach(button => {
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

  // Add zoom functionality
  zoomInButton.addEventListener('click', function() {
    const view = map.getView();
    const zoom = view.getZoom();
    if (zoom !== undefined) {
      view.animate({
        zoom: zoom + 1,
        duration: 300
      });
    }
  });

  zoomOutButton.addEventListener('click', function() {
    const view = map.getView();
    const zoom = view.getZoom();
    if (zoom !== undefined) {
      view.animate({
        zoom: zoom - 1,
        duration: 300
      });
    }
  });

  zoomControls.appendChild(zoomInButton);
  zoomControls.appendChild(zoomOutButton);
  document.body.appendChild(zoomControls);

  // Add hover effects
  [dailyMemoToggle, planActionToggle, legendToggle, refreshNewsButton].forEach(button => {
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

  console.log('Refresh button created:', refreshNewsButton);
  console.log('Refresh button in DOM:', document.getElementById('refresh-news'));

  // Add refresh news functionality
  refreshNewsButton.addEventListener('click', async function(event) {
    // Prevent default browser behavior
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Refresh button clicked!');
    
    try {
      // Show loading overlay
      loadingOverlay.style.display = 'flex';
      const progressBar = document.getElementById('progress-bar') as HTMLElement;
      const progressText = document.getElementById('progress-text') as HTMLElement;
      
      console.log('Loading overlay displayed');
      
      // Simulate progress updates
      const updateProgress = (percent: number, text: string) => {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = text;
        console.log(`Progress: ${percent}% - ${text}`);
      };

      updateProgress(5, 'Initializing deep research model...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      updateProgress(15, 'Connecting to news sources...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      updateProgress(25, 'Searching for recent articles...');
      await new Promise(resolve => setTimeout(resolve, 4000));

      updateProgress(35, 'Analyzing market sentiment...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      updateProgress(45, 'Processing country-specific data...');
      await new Promise(resolve => setTimeout(resolve, 4000));

      updateProgress(55, 'Evaluating industry impacts...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      updateProgress(65, 'Calculating sentiment scores...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      updateProgress(75, 'Validating news sources...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      updateProgress(85, 'Updating map data...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Actually trigger the backend update
      const updateResponse = await apiService.updateNews();
      
      if (updateResponse.success) {
        updateProgress(95, 'Finalizing updates...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        updateProgress(100, 'Update complete!');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reload all country data
        await loadAllCountryData();
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(76, 175, 80, 0.9);
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          z-index: 10001;
          animation: slideDown 0.3s ease;
        `;
        successMessage.textContent = '✅ News data updated successfully!';
        document.body.appendChild(successMessage);
        
        // Remove success message after 3 seconds
        setTimeout(() => {
          successMessage.remove();
        }, 3000);
        
        // Add slideDown animation
        const style = document.createElement('style');
        style.textContent = `
          @keyframes slideDown {
            from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
        
      } else {
        throw new Error('Backend update failed');
      }
      
    } catch (error) {
      console.error('Failed to refresh news:', error);
      
      // Show error message
      const errorMessage = document.createElement('div');
      errorMessage.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(244, 67, 54, 0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 10001;
        animation: slideDown 0.3s ease;
      `;
      errorMessage.textContent = '❌ Failed to update news data';
      document.body.appendChild(errorMessage);
      
      // Remove error message after 3 seconds
      setTimeout(() => {
        errorMessage.remove();
      }, 3000);
      
    } finally {
      // Hide loading overlay
      loadingOverlay.style.display = 'none';
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
