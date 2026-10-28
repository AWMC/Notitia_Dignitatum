// create map
const map = L.map('map', {
  // give it inertia so it feels good
  inertia: true,
  // disable default zoom control so that we can change where it is
  zoomControl: false,
  // set max zoom because of CAWM limitations
  maxZoom: 11,
// set view and zoom to correct area so (most of) the points are in frame when the map loads
}).setView([40, 16], 5);

const infoPanel = L.control({ position: 'bottomleft' });

let infoPanelFocus = {};
let focusHistory = [];
let infoBody = null;

infoPanel.onAdd = (map) => {
  //create html div
  const infoContainer = L.DomUtil.create('div', 'panel');

  L.DomEvent.disableClickPropagation(infoContainer);
  L.DomEvent.disableScrollPropagation(infoContainer);
  
  //content
  infoBody = L.DomUtil.create('div', 'panel-body', infoContainer);

  refreshDOM();

  const infoCloseButton = L.DomUtil.create('a', "panel-close-button", infoContainer);
  infoCloseButton.innerHTML = '&#215;';
  infoCloseButton.href = '#';

  L.DomEvent.on(infoCloseButton, 'click', (e) => {
    L.DomEvent.stop(e);
    infoPanel.remove();
  });

  return infoContainer;
};

function refreshDOM() {
  if (!infoBody) return;
  
  infoBody.innerHTML = '';
  
  const infoContent = L.DomUtil.create('div', 'panel-content', infoBody);
  
  let infoPanelInnerHTML = `
  <h3>Lorem Ipsum</h3>
  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
  `;

  if (infoPanelFocus.entry) {
    const entry = infoPanelFocus.entry;
    infoPanelInnerHTML =`<h2>${entry.name}</h2>`;
    if (entry.command.length != 0) {
      infoPanelInnerHTML += `<p>Subordinates</p>`;
      entry.command.forEach((subordinate) => {
        const subordLink = L.DomUtil.create('a', 'subord-link', infoBody);
        subordLink.innerHTML = subordinate.name+'<br>';
        subordLink.href = '#';
        L.DomEvent.on(subordLink, 'click', e => {
          L.DomEvent.stop(e);
          ChooseEntry(subordinate);
        })
      });
    }
  } 
  
  else if (infoPanelFocus.layer) {
    const layer = infoPanelFocus.layer;
    infoPanelInnerHTML = `<h2>${layer.feature.properties.name}</h2>`;
    if (layer.feature.properties.diocese) {
      infoPanelInnerHTML += `<h3>Diocese of ${layer.feature.properties.diocese}</h3>`;
    }
    if (layer.feature.properties.entries.length != 0) {
      infoPanelInnerHTML += `<p>Entries</p>`;
      layer.feature.properties.entries.forEach((ent) => {
        const entryLink = L.DomUtil.create('a', 'entry-link', infoBody);
        entryLink.innerHTML = ent.name+'<br>';
        entryLink.href = '#';
        
        L.DomEvent.on(entryLink, 'click', e => {
          L.DomEvent.stop(e);
          ChooseEntry(ent);
        });
      });
    }
  } 

  infoContent.innerHTML = infoPanelInnerHTML;

  if (focusHistory.length > 0) {
    const backButton = L.DomUtil.create('a', 'info-back-button', infoBody);
    backButton.innerHTML = '&#9664;';
    backButton.href = '#';
    L.DomEvent.on(backButton, 'click', e => {
      L.DomEvent.stop(e);
      const previousFocus = focusHistory.pop();
      if (previousFocus.entry) {
        ChooseEntry(previousFocus.entry, goingBack=true);
      } else if (previousFocus.layer) {
        ChooseLayer(previousFocus.layer, territory=false, goingBack=true);
      }
    })
  }

};

function updateInfoPanel({entry = false, layer = false} = {}, back=false) {
  if (!back) {
    if (infoPanelFocus.entry || infoPanelFocus.layer) {
      focusHistory.push(infoPanelFocus);
  }}
  infoPanelFocus = {entry: entry, layer: layer};
  refreshDOM();
};

// create Consortium of Ancient World Mappers layer (better for a map of the ancient world)
const overlay = L.tileLayer('https://cawm.lib.uiowa.edu/tiles/{z}/{x}/{y}.png', {
  // proper attribution
  attribution: '&copy; <a href="https://cawm.lib.uiowa.edu/index.html" target="_blank">Consortium of Ancient World Mappers</a>'
// add CAWM layer to the map layer (after adding OSM layer so CAWM is on top)
}).addTo(map);

const dioceses = L.geoJSON(diocesesGeoJSON, {
  style: {
    color: "black",
    fillOpacity: 0,
    fillColor: "blue",
    zIndex: 1
  },
  onEachFeature: (feature, layer) => {
    feature.properties.entries = [];
    feature.properties.searchName = "Diocese of "+feature.properties.name;
  },
  chosen: false,
  geoType: 'diocese'
}).addTo(map);

const provinces = L.geoJSON(provincesGeoJSON, {
  style: {
    color: "black",
    weight: 1,
    fillOpacity: 0,
    fillColor: "orange",
    zIndex: 2
  },
  onEachFeature: (feature, layer) => {
    layer.on({
      mouseover: MouseOverLayer,
      mouseout: MouseOutLayer,
      click: ClickLayer
    });
    feature.properties.entries = [];
    feature.properties.searchName = "Province of "+feature.properties.name;
  },
  chosen: false,
  geoType: 'province'
}).addTo(map);

const areas = L.geoJSON(areasGeoJSON, {
  style: {
    zIndex: 3
  },
  onEachFeature: (feature, layer) => {
    feature.properties.entries = [];
  },
  chosen: false,
  geoType: 'area'
})

const places = L.geoJSON(pointsGeoJSON, {
  style: {
    zIndex: 4
  },
  onEachFeature: (feature, layer) => {
    feature.properties.entries = [];
  },
  chosen: false,
  geoType: 'place'
})

const allLayers = L.layerGroup([provinces, dioceses]);

function MouseOverLayer(e) {
  const layer = e.target;

  if (!layer.options.chosen) {
    layer.setStyle({
      fillOpacity: 0.5
    });
  }
};

function MouseOutLayer(e) {
  const layer = e.target;
  if (!layer.options.chosen) {
    layer.setStyle({
      fillOpacity: 0
    });
  }
};

function ClickLayer(e) {
  ChooseLayer(e.target);
}

function ChooseLayer(layer, territory=false, goingBack=false) {
  dioceses.eachLayer((l) => {
    l.options.chosen = false;
    l.setStyle({
      fillOpacity: 0
    });
  });

  provinces.eachLayer((l) => {
    l.options.chosen = false;
    l.setStyle({
      fillOpacity: 0
    });
  });

  areas.eachLayer((l) => {
    l.options.chosen = false;
    l.remove();
  });

  places.eachLayer((l) => {
    l.options.chosen = false;
    l.remove();
  })
  
  layer.options.chosen = true;
  
  if (layer.options.geoType === 'diocese' || layer.options.geoType === 'province') {
    layer.setStyle({
      fillOpacity: 1
    });
    map.fitBounds(layer.getBounds(), {
      paddingTopLeft: [500, 100],
      paddingBottomRight: [0, 0]
    });
  } 
  
  else if (layer.options.geoType === 'area'){
    layer.addTo(map);
    map.fitBounds(layer.getBounds(), {
      maxZoom: 8,
      paddingTopLeft: [500, 100],
      paddingBottomRight: [0, 0]
    });
  } 
  
  else if (layer.options.geoType === 'place') {
    layer.addTo(map);
    map.setView(layer.getLatLng(), 8);
  }
  
  if (!territory) {
    updateInfoPanel({layer: layer}, back=goingBack);
    infoPanel.addTo(map);
  };
};

demoJSON.forEach((entry) => {
  if (entry.officialOrunit === "official") {
    entry.name = entry.officialName;
  } else if (entry.officialOrunit === "unit") {
    entry.name = entry.unitName;
  }
  
  entry.chosen = false;
  entry.command = [];
  entry.subdisp = entry.subDispName.split('; ');
});

demoJSON.forEach((entry) => {
  demoJSON.forEach((innerEntry) => {
    if (innerEntry.subdisp.includes(entry.name)) {
      entry.command.push(innerEntry);
    }
  });

  let foundLayer = null;
  
  const matchLayer = (layer) => {
    if (entry.GeometryName === layer.feature.properties.name) {
      foundLayer = layer;
    }
  };

  if (entry.GeometryType === "Diocese") {
    dioceses.eachLayer(matchLayer);
  } else if (entry.GeometryType === "Province") {
    provinces.eachLayer(matchLayer);
  } else if (entry.GeometryType === "Area") {
    areas.eachLayer(matchLayer);
  } else if (entry.GeometryType === "Point") {
    places.eachLayer(matchLayer);
  }

  entry.territory = foundLayer;
  if (entry.territory) {
    entry.territory.feature.properties.entries.push(entry);
  };

});

function ChooseEntry(entry, goingBack=false) {
  demoJSON.forEach((ent) => {
    ent.chosen = false;
  });

  entry.chosen = true;

  if (entry.territory) {
    ChooseLayer(entry.territory, territory=true);
  }
  
  updateInfoPanel({entry: entry}, back=goingBack);
  infoPanel.addTo(map);
};

const searchBar = new L.Control.Search({
  layer: allLayers,
  textPlaceholder: "Search...",
  initial: false,
  propertyName: "searchName",
  marker: false
});

searchBar.on('search:locationfound', (e) => {
  const searchLayer = e.layer;

  ChooseLayer(searchLayer);
});

map.addControl(searchBar);

// test
demoJSON.forEach((ent) => {
  if (ent.name === 'Comes rei militaris Africae') {
    ChooseEntry(ent);
  }
});