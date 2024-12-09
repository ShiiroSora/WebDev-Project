const TOMORROW_API_KEY = 'aAbyMyhPMcll8kkHORXugH1jAf0p24xH'; // Tomorrow.io API Key
const AQICN_API_KEY = 'ed81cb96be8109d85467ecaee3dab915f16b6a6e'; // AQICN API Key
const OPENCAGE_API_KEY = '6f04c5cda4e04c94a3f7adc77109e00c'; // OpenCage Geocoder API Key

// Cache to avoid redundant API calls
const apiCache = {};

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
    const cacheKey = `coordinates-${cityName.toLowerCase()}`;
    return getCachedData(cacheKey, async () => {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(cityName)}&key=${OPENCAGE_API_KEY}&limit=1`;
        const response = await fetch(url);

        if (!response.ok) throw new Error("Failed to fetch coordinates.");

        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const geometry = data.results[0].geometry;
            return { name: data.results[0].formatted, lat: geometry.lat, lon: geometry.lng };
        }
        throw new Error("Location not found.");
    });
}

// Fetch weather data using Tomorrow.io API
async function fetchWeatherData(city) {
    const cacheKey = `weather-${city.lat}-${city.lon}`;
    return getCachedData(cacheKey, async () => {
        const url = `https://api.tomorrow.io/v4/timelines?location=${city.lat},${city.lon}&fields=temperature,humidity,windSpeed&timesteps=current&units=metric&apikey=${TOMORROW_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error("Failed to fetch weather data.");

        const data = await response.json();
        if (!data.data || !data.data.timelines) throw new Error("Weather data is missing or invalid.");

        const values = data.data.timelines[0].intervals[0].values;

        // Update the DOM elements
        document.getElementById("temperatureValue").textContent = `${values.temperature} °C`;
        document.getElementById("humidityValue").textContent = `${values.humidity} %`;
        document.getElementById("windSpeedValue").textContent = `${values.windSpeed} m/s`;

        return values; // Return the weather values
    });
}

// Fetch air quality data using AQICN API
async function fetchAirQualityData(city) {
    const cacheKey = `airQuality-${city.lat}-${city.lon}`;
    return getCachedData(cacheKey, async () => {
        const url = `https://api.waqi.info/feed/geo:${city.lat};${city.lon}/?token=${AQICN_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error("Failed to fetch air quality data.");

        const data = await response.json();
        if (data.status !== "ok" || !data.data || !data.data.iaqi) throw new Error("Air quality data is missing or invalid.");

        return data.data.iaqi; // Return the air quality metrics
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
    const cacheKey = `suggestions-${query.toLowerCase()}`;
    return getCachedData(cacheKey, async () => {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_API_KEY}&limit=5`;
        const response = await fetch(url);

        if (!response.ok) throw new Error("Failed to fetch suggestions.");

        const data = await response.json();
        if (!data.results || data.results.length === 0) throw new Error("No suggestions found.");

        return data.results.map(result => result.formatted); // Return the list of suggestions
    });
}

// Event listener for search button
document.getElementById("searchButton").addEventListener("click", async () => {
    const cityName = document.getElementById("searchInput").value.trim();

    if (!cityName) {
        showError("Please enter a city name.");
        return;
    }

    try {
        const city = await fetchCoordinates(cityName);

        // Fetch weather and air quality data
        await fetchWeatherData(city);
        await fetchAndDisplayAirQuality(city);

        // Update header with the city name
        document.querySelector("header h1").textContent = `Weather Dashboard - ${city.name}`;
    } catch (error) {
        console.error("Error during city search:", error);
        showError("City not found or invalid. Please try again.");
    }
});

function getCachedData(cacheKey, fetchFunction) {
    if (apiCache[cacheKey]) {
        console.log(`Using cached data for ${cacheKey}`);
        return Promise.resolve(apiCache[cacheKey]);
    }
    return fetchFunction().then(data => {
        apiCache[cacheKey] = data;
        return data;
    });
}


