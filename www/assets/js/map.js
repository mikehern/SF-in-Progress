var eventBus = _.extend({}, Backbone.Events)

var tooltipTemplate = function tooltipTemplate(data){
	var template = _.template($("#tooltip").html());
	return template(data);
};

var bindEvents = function bindFilterEvents(){
	// Add event listeners to filter checkboxes
	$("#legend .filter-status input").on('click', function(e){
		var property = $(e.currentTarget).attr('name');
		var newVal = $(e.currentTarget).prop('checked');
		filterState.setOne(property, newVal, 'projectStatus');
	});
	$("#legend .filter-type input").on('click', function(e){
		var property = $(e.currentTarget).attr('name');
		var newVal = $(e.currentTarget).prop('checked');
		filterState.setOne(property, newVal, 'developmentType');
	});
	$("#sidebar input").on('click', function(e){
		var property = $(e.currentTarget).attr('name');
		var newVal = $(e.currentTarget).prop('checked');
		filterState.setOne(property, newVal, 'neighborhood');
	});
	$("#select-all").on('click', function(){
		filterState.setAllNeighborhoods(true);
	});
	$("#clear-all").on('click', function(){
		filterState.setAllNeighborhoods(false);
	});

	//make all checkboxes look selected
	$("#sidebar input").prop("checked", true);
	$("#legend input").prop("checked", true);

	$( "#collapse" ).accordion({
      collapsible: true,
      active: false,
      heightStyle: 'content'
    });

    // when a project profile is dismissed, show all markers again
    eventBus.on('close:profile', function() {
    	window.map.markers.clearLayers();
    	fetchData(placeMarkers);
    });
};

var initializeMap = function initializeMap(){
	L.mapbox.accessToken = 'pk.eyJ1Ijoiam1jZWxyb3kiLCJhIjoiVVg5eHZldyJ9.FFzKtamuKHb_8_b_6fAOFg';
	var map = L.mapbox.map('map-container', 'jmcelroy.lje09j35', {
		zoomControl: false,
		legendControl: {
			position: 'bottomright'
		}
	}).setView([37.77, -122.47], 13);
	// putting zoom control in top-right corner
	new L.Control.Zoom({ position: 'topright' }).addTo(map);
	return map;
};

var fetchData = function(callback) {
	$.get('/projects', function(projects) {
		callback(projects);
	});
};

var fetchOneProject = function(id, callback) {
	$.get('/projects/' + id, function(project) {
		callback(project)
	});
}

var createGeoJson = function createGeoJson(projects){
	var featureCollection = {
		type: "FeatureCollection",
		features: []
	};

	_.each(projects, function(project) {
		var markerType;
		switch (project.zoning) {
			case "Residential":
				markerType = "building";
				break;
			case "Mixed Use":
				markerType = "town";
				break;
			default:
				markerType = "building";
		}

		var markerColor;
		if (project.statusCategory === "construction") markerColor = "#04ff54"; //green
		else if (project.statusCategory == "planning") markerColor = "#307de1"; //blue
		else if (project.statusCategory == "building") markerColor = '#ff3b52'; //red

		var markerGeoJson = {
    		type: "Feature",
	        geometry: {
	        	"type": "Point", 
	        	"coordinates": project.coordinates
	        },
	        properties: {
	        	id: project._id,
		        address: project.address,
		        neighborhood: project.neighborhood,
		        description: project.description,
		     	zoning: project.zoning,
		        units: project.units,
		        status: project.status,
		        statusCategory: project.statusCategory,
		        'marker-size': 'medium',
		        'marker-color': markerColor, 
		        'marker-symbol': markerType
    		}
		};

		featureCollection.features.push(markerGeoJson);

	});
	return featureCollection;
};


var setOneActiveMarker = function(marker) {
	// clear all current markers
	window.map.markers.clearLayers()
	// this will fetch the project then 
	// place a marker for it
	fetchOneProject(marker, function(project) {
		placeMarkers([project]);
	});
}

var placeMarkers = function(data){

	var geoJSON = createGeoJson(data);
	var markerLayer = L.mapbox.featureLayer();

	markerLayer.on('click', function(e) {
		// suppress Mapbox tooltip
		e.layer.closePopup();
		var project = e.layer.feature.properties;
		// clear all except the active marker
		setOneActiveMarker(project.id)
		// trigger event w/ projct so profile renders
		eventBus.trigger('select:project', project)
	})

	// Add them all to the map 
	markerLayer.setGeoJSON(geoJSON);
	markerLayer.addTo(window.map);

	// so we can access markers from other components
	window.map.markers = markerLayer;
};

// Variable names from dataset

var FIELDS = [
	'location_1', 
	'planning_neighborhood', 
	'planning_project_description', 
	'dbi_project_description',
	'zoning_generalized',
	'units',
	'beststat_group'
];

var NEIGHBORHOODS = [
	"Balboa Park",
	"Bayshore",
	"Bernal Heights",
	"Buena Vista",
	"BVHP Area A,B", 
	"Candlestick",
	"Central",
	"Central Waterfront",
	"Downtown",
	"East SoMa",
	"Executive Park",
	"HP Shipyard",
	"India Basin",
	"Ingleside, Other",
	"Inner Sunset",
	"Japantown",
	"Marina",
	"Market Octavia",
	"Mission",
	"Mission Bay",
	"Northeast",
	"Outer Sunset",
	"Park Merced",
	"Richmond",
	"Rincon Hill",
	"Showpl/Potrero",
	"South Central, Other",
	"South of Market, Other",
	"TB Combo",
	"VisVal",
	"Western Addition",		
	"WSoMa"
];

var filterState = {
	neighborhood: {},
	developmentType: {
		"Mixed Use": true,
		"Residential": true
	},
	projectStatus: {
		"construction": true,
		"planning": true,
		"building": true
	},
	setOne: function(property, newVal, filterToSet){
		// property is the filter name (e.g. Bayshore)
		// newVal is a boolean (show or not show)
		// filterToSet is the filter category (e.g. neighborhood)
		this[filterToSet][property] = newVal;
		filterMapboxMarkers();
	},
	setAllNeighborhoods: function(set){
		// set is a boolean: true to select all and false to clear all
		$("#sidebar input").prop("checked", set);
		_.each(this.neighborhood, function(val, key){
			filterState.neighborhood[key] = set;
		});
		filterMapboxMarkers();
	}
};

// populating intial neighborhood state because im too lazy 
// to re-type the list in object form 
_.each(NEIGHBORHOODS, function(neighborhood){
	filterState.neighborhood[neighborhood] = true;
});

var filterMapboxMarkers = function filterMapboxMarkers(){
	// this function tells mapbox to filter markers 
	// to reflect the current filter state
	window.map.markers.setFilter(function(marker){
		if (filterState.neighborhood[marker.properties.neighborhood] &&
			filterState.projectStatus[marker.properties.statusCategory] &&
			filterState.developmentType[marker.properties.zoning]) {
			return true;
		} else {
			return false;
		}
	});
	// TODO: make a loading indicator appear bc this is slow
};

$(document).ready(function() {
	bindEvents();
	window.map = initializeMap();
	fetchData(placeMarkers);
});