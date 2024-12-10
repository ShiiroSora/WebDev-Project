const TOMORROW_API_KEY = 'aAbyMyhPMcll8kkHORXugH1jAf0p24xH'; // Tomorrow.io API Key
const AQICN_API_KEY = 'ed81cb96be8109d85467ecaee3dab915f16b6a6e'; // AQICN API Key
const OPENCAGE_API_KEY = '6f04c5cda4e04c94a3f7adc77109e00c'; // OpenCage Geocoder API Key

// Cache to avoid redundant API calls
const apiCache = {};

//For the Loading Feature when fetching data
let activeRequests = 0;

// Show error message function
function showError(message) {
    const errorElement = document.getElementById("errorMessage");
    errorElement.textContent = message;
    errorElement.style.display = "block";
    setTimeout(() => {
        errorElement.style.display = "none";
    }, 5000);
}

// Fetch coordinates using OpenCage API
async function fetchCoordinates(cityName) {
    return await withLoading(async () => {
        const cacheKey = `coordinates-${cityName.toLowerCase()}`;
        const cached = getCache(cacheKey);
        if (cached) {
            console.log(`Using cached coordinates for ${cityName}`);
            return cached;
        }

        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(cityName)}&key=${OPENCAGE_API_KEY}&limit=1`;
        const response = await fetch(url);

        if (!response.ok) throw new Error("Failed to fetch coordinates.");

        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const geometry = data.results[0].geometry;
            const result = { name: data.results[0].formatted, lat: geometry.lat, lon: geometry.lng };
            setCache(cacheKey, result); // Cache the result
            return result;
        }
        throw new Error("Location not found.");
    });
}

// Fetch weather data using Tomorrow.io API
async function fetchWeatherData(city) {
    return await withLoading(async () => {
        const cacheKey = `weather-${city.lat}-${city.lon}`;
        const cached = getCache(cacheKey);
        if (cached) {
            console.log(`Using cached weather data for ${city.name}`);
            return cached;
        }

        const url = `https://api.tomorrow.io/v4/timelines?location=${city.lat},${city.lon}&fields=temperature,humidity,windSpeed&timesteps=current&units=metric&apikey=${TOMORROW_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error("Failed to fetch weather data.");

        const data = await response.json();
        if (!data.data || !data.data.timelines) throw new Error("Weather data is missing or invalid.");

        const values = data.data.timelines[0].intervals[0].values;

        document.getElementById("temperatureValue").textContent = `${values.temperature} °C`;
        document.getElementById("humidityValue").textContent = `${values.humidity} %`;
        document.getElementById("windSpeedValue").textContent = `${values.windSpeed} m/s`;

        setCache(cacheKey, values); // Cache the result
        return values;
    });
}


// Fetch air quality data using AQICN API
async function fetchAirQualityData(city) {
    return await withLoading(async () => {
        const cacheKey = `airQuality-${city.lat}-${city.lon}`;
        const cached = getCache(cacheKey);
        if (cached) {
            console.log(`Using cached air quality data for ${city.name}`);
            return cached;
        }

        const url = `https://api.waqi.info/feed/geo:${city.lat};${city.lon}/?token=${AQICN_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error("Failed to fetch air quality data.");

        const data = await response.json();
        if (data.status !== "ok" || !data.data || !data.data.iaqi) throw new Error("Air quality data is missing or invalid.");

        const iaqi = data.data.iaqi;
        setCache(cacheKey, iaqi); // Cache the result
        return iaqi;
       
    });
}

// Fetch and display air quality metrics
async function fetchAndDisplayAirQuality(city) {
    try {
        const iaqi = await fetchAirQualityData(city);

        const pm25 = iaqi.pm25?.v || "N/A";
        const pm10 = iaqi.pm10?.v || "N/A";
        const no2 = iaqi.no2?.v || "N/A";
        const co = iaqi.co?.v || "N/A";
        const so2 = iaqi.so2?.v || "N/A";

        // Update the DOM elements
        const pm25Element = document.getElementById("pm25Value");
        const pm10Element = document.getElementById("pm10Value");
        const no2Element = document.getElementById("no2Value");
        const coElement = document.getElementById("co2Value");
        const so2Element = document.getElementById("so2Value");

        if (pm25Element) pm25Element.textContent = `${pm25} µg/m³`;
        if (pm10Element) pm10Element.textContent = `${pm10} µg/m³`;
        if (no2Element) no2Element.textContent = `${no2} µg/m³`;
        if (coElement) coElement.textContent = `${co} µg/m³`;
        if (so2Element) so2Element.textContent = `${so2} µg/m³`;

    } catch (error) {
        console.error("Error displaying air quality data:", error);
        showError("Unable to fetch air quality data. Please try again.");
    }
}

async function fetchSuggestions(query) {
    console.log("Fetching suggestions for query:", query);
    const cacheKey = `suggestions-${query.toLowerCase()}`;
    return getCache(cacheKey) || await withLoading(async () => {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_API_KEY}&limit=5`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`Failed to fetch suggestions: ${response.status}`);
            return []; // Return empty array on failure
        }

        const data = await response.json();
        if (!data.results || data.results.length === 0) {
            console.warn("No suggestions found for query:", query);
            return []; // Gracefully handle no results
        }

        // Extract formatted results and cache them
        const suggestions = data.results.map(result => result.formatted);
        setCache(cacheKey, suggestions);
        return suggestions;
    });
}


/*
Search Related functions
 */

// Event listener for search button
document.getElementById("searchButton").addEventListener("click", async () => {
    const cityName = document.getElementById("searchInput").value.trim();

    if (!cityName) {
        showError("Please enter a city name.");
        return;
    }

    try {
        const city = await fetchCoordinates(cityName);

        // Fetch weather and air quality data using withLoading
        await withLoading(() => fetchWeatherData(city));
        
        await fetchAndDisplayAirQuality(city);

        // Update header with the city name
        document.querySelector("header h1").textContent = `Weather Dashboard - ${city.name}`;
    } catch (error) {
        console.error("Error during city search:", error);
        showError("City not found or invalid. Please try again.");
    }
});

document.getElementById("searchInput").addEventListener("input", async (event) => {
    const query = event.target.value.trim();

    if (!query) {
        clearSuggestions();
        return;
    }

    try {
        console.log("Fetching suggestions for query:", query);
        const suggestions = await fetchSuggestions(query);
        console.log("Fetched suggestions:", suggestions);
        displaySuggestions(suggestions);
    } catch (error) {
        console.error("Error fetching suggestions:", error);
        clearSuggestions(); // Hide dropdown on error
    }
});

function displaySuggestions(suggestions) {
    const suggestionsContainer = document.getElementById("autocompleteResults");
    suggestionsContainer.innerHTML = ""; // Clear existing suggestions

    if (suggestions.length === 0) {
        suggestionsContainer.style.display = "none"; // Hide dropdown if no suggestions
        console.log("No suggestions to display.");
        return;
    }

    suggestions.forEach((suggestion) => {
        const suggestionItem = document.createElement("div");
        suggestionItem.textContent = suggestion;
        suggestionItem.className = "suggestion-item";

        suggestionItem.addEventListener("click", () => {
            document.getElementById("searchInput").value = suggestion;
            clearSuggestions(); // Clear suggestions after selection
        });

        suggestionsContainer.appendChild(suggestionItem);
    });

    suggestionsContainer.style.display = "block"; // Show dropdown
    console.log("Displayed suggestions:", suggestions);
}

function clearSuggestions() {
    const suggestionsContainer = document.getElementById("autocompleteResults");
    suggestionsContainer.innerHTML = "";
    suggestionsContainer.style.display = "none"; // Hide suggestions
}


/*
Caching Functions
 */
function setCache(key, value, ttl = 300000) { // Default TTL: 5 minutes
    apiCache[key] = {
        value,
        expiry: Date.now() + ttl
    };
    localStorage.setItem("apiCache", JSON.stringify(apiCache));
}

function getCache(key) {
    const cached = apiCache[key];
    if (cached && Date.now() < cached.expiry) {
        return cached.value;
    }
    delete apiCache[key]; // Remove expired data
    return null;
}


function saveCacheToStorage() {
    console.log("Saving cache to localStorage...");
    localStorage.setItem("apiCache", JSON.stringify(apiCache));
}

function loadCacheFromStorage() {
    console.log("Loading cache from localStorage...");
    const cachedData = localStorage.getItem("apiCache");
    if (cachedData) {
        Object.assign(apiCache, JSON.parse(cachedData));
        console.log("Loaded cache:", apiCache);
    }
}

document.addEventListener("DOMContentLoaded", loadCacheFromStorage);
window.addEventListener("beforeunload", saveCacheToStorage);

/*
Loading when Fetching Function
*/
function toggleLoading(isLoading) {
    const loadingElement = document.getElementById("loadingIndicator");

    if (isLoading) {
        activeRequests++;
        loadingElement.style.display = "block";
        console.log(`Active requests: ${activeRequests}`);
    } else {
        activeRequests = Math.max(0, activeRequests - 1);
        if (activeRequests === 0) {
            loadingElement.style.display = "none";
        }
    }
}

async function withLoading(asyncOperation) {
    toggleLoading(true); // Show spinner
    try {
        return await asyncOperation(); // Execute the async operation
    } finally {
        toggleLoading(false); // Hide spinner
    }
}

/*
 Tab Switching Functionalities
 */

 // Tab switching logic
const menuItems = document.querySelectorAll(".menuItem");
const contentSections = document.querySelectorAll(".content");

menuItems.forEach(menuItem => {
    menuItem.addEventListener("click", event => {
        event.preventDefault();

        // Remove 'active' class from all menu items and sections
        menuItems.forEach(item => item.classList.remove("active"));
        contentSections.forEach(section => section.classList.remove("active"));

        // Add 'active' class to the clicked menu item
        menuItem.classList.add("active");

        // Show the associated content section
        const contentId = menuItem.getAttribute("data-content");
        const targetContent = document.getElementById(contentId);
        if (targetContent) {
            targetContent.classList.add("active");
        }
    });
});

