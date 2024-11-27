const TOMORROW_API_KEY = 'aAbyMyhPMcll8kkHORXugH1jAf0p24xH'; // Tomorrow.io API Key
const AQICN_API_KEY = 'ed81cb96be8109d85467ecaee3dab915f16b6a6e'; // AQICN API Key
const OPENCAGE_API_KEY = '6f04c5cda4e04c94a3f7adc77109e00c'; // OpenCage Geocoder API Key
const apiCache = {};

// Fetch coordinates using OpenCage Geocoder
async function fetchCoordinates(cityName) {
    const cacheKey = `coordinates-${cityName.toLowerCase()}`;
    if (apiCache[cacheKey]) {
        document.getElementById("infoMessage").textContent = `Using cached data for ${city.name}.`;
        setTimeout(() => {
            document.getElementById("infoMessage").textContent = ""; // Clear the message after 3 seconds
        }, 3000);
    }
    
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(cityName)}&key=${OPENCAGE_API_KEY}&limit=1`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Failed to fetch coordinates.");
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
        const geometry = data.results[0].geometry;
        const result = { name: data.results[0].formatted, lat: geometry.lat, lon: geometry.lng };
        apiCache[cacheKey] = result; // Cache the result
        return result;
    } else {
        throw new Error("Location not found.");
    }
}

// Fetch temperature, humidity, and wind speed from Tomorrow.io
function fetchWeatherData(city) {
    const fields = ["temperature", "humidity", "windSpeed"]; 
    const timesteps = "current"; 
    const units = "metric";

    const url = `https://api.tomorrow.io/v4/timelines?location=${city.lat},${city.lon}&fields=${fields.join(",")}&timesteps=${timesteps}&units=${units}&apikey=${TOMORROW_API_KEY}`;

    return fetch(url)
        .then(response => response.json())
        .then(data => {
            const values = data.data.timelines[0].intervals[0].values;

            // Update temperature, humidity, and wind speed
            document.getElementById("temperatureValue").textContent = `${values.temperature} °C`; //Temperature in degrees celcius
            document.getElementById("humidityValue").textContent = `${values.humidity} %`; //Humidity by %
            document.getElementById("windSpeedValue").textContent = `${values.windSpeed} m/s`; // Wind speed in meters/second

            return values; // Pass data to be logged or combined later
        })
        .catch(error => console.error(`Error fetching weather data:`, error));
}

// Fetch air quality data from AQICN
function fetchAirQualityData(city) {
    const url = `https://api.waqi.info/feed/geo:${city.lat};${city.lon}/?token=${AQICN_API_KEY}`;

    return fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.status === "ok") {
                const iaqi = data.data.iaqi;

                // Update air quality metrics
                document.getElementById("pm25Value").textContent = `${iaqi.pm25?.v || "N/A"} µg/m³`;
                document.getElementById("pm10Value").textContent = `${iaqi.pm10?.v || "N/A"} µg/m³`;
                document.getElementById("no2Value").textContent = `${iaqi.no2?.v || "N/A"} µg/m³`;
                document.getElementById("co2Value").textContent = `${iaqi.co?.v || "N/A"} µg/m³`;
                document.getElementById("so2Value").textContent = `${iaqi.so2?.v || "N/A"} µg/m³`;

                return iaqi; // Pass data to be logged or combined later
            } else {
                throw new Error("Failed to fetch air quality data");
            }
        })
        .catch(error => console.error(`Error fetching air quality data:`, error));
}

// Handle city search
document.getElementById("searchButton").addEventListener("click", async () => {
    const cityName = document.getElementById("searchInput").value.trim();

    if (!cityName) {
        showError("Please enter a city name.");
        return;
    }

    try {
        // Fetch city coordinates
        const city = await fetchCoordinates(cityName);

        // Update the dashboard
        await fetchWeatherData(city);

        // Update temperature and air quality charts
        const temperatureData = await fetchTemperatureData(city);
        initializeTemperatureChart(temperatureData);

        const airQualityData = await fetchAirQualityDataForChart(city);
        initializeAirQualityChart(airQualityData);

        // Update header with the city name
        document.querySelector("header h1").textContent = `Weather Dashboard - ${city.name}`;
    } catch (error) {
        console.error("Error during city search:", error);
        showError("City not found or invalid. Please try again.");
    }
});


// Fetch suggestions from OpenCage API
function fetchSuggestions(query) {
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_API_KEY}&limit=5`;

    return fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.results) {
                return data.results.map(result => ({
                    name: result.formatted,
                    lat: result.geometry.lat,
                    lon: result.geometry.lng
                }));
            } else {
                return [];
            }
        });
}

// Display suggestions in the dropdown
function displaySuggestions(suggestions) {
    const autocompleteResults = document.getElementById("autocompleteResults");
    autocompleteResults.innerHTML = ""; // Clear previous suggestions

    if (suggestions.length > 0) {
        suggestions.forEach(suggestion => {
            const div = document.createElement("div");
            div.textContent = suggestion.name;
            div.addEventListener("click", async () => {
                document.getElementById("searchInput").value = suggestion.name;
                autocompleteResults.style.display = "none"; // Hide dropdown
            
                try {
                    await fetchWeatherData(suggestion);
                    const temperatureData = await fetchTemperatureData(suggestion);
                    initializeTemperatureChart(temperatureData);
                    const airQualityData = await fetchAirQualityDataForChart(suggestion);
                    initializeAirQualityChart(airQualityData);
            
                    document.querySelector("header h1").textContent = `Weather Dashboard - ${suggestion.name}`;
                } catch (error) {
                    if (error.message.includes("429")) {
                        showError("API rate limit exceeded. Please try again later.");
                    } else {
                        showError("Unable to fetch data for the selected suggestion.");
                    }
                    console.error("Error fetching data for the suggestion:", error);
                }
            });
            
            autocompleteResults.appendChild(div);
        });
        autocompleteResults.style.display = "block"; // Show dropdown
    } else {
        autocompleteResults.style.display = "none"; // Hide dropdown if no suggestions
    }
}

// Add event listener for auto-complete
document.getElementById("searchInput").addEventListener("input", event => {
    const query = event.target.value.trim();

    if (query.length > 2) {
        fetchSuggestions(query)
            .then(suggestions => displaySuggestions(suggestions))
            .catch(error => {
                console.error("Error fetching suggestions:", error);
                document.getElementById("autocompleteResults").style.display = "none";
            });
    } else {
        document.getElementById("autocompleteResults").style.display = "none";
    }
});

// Fetch temperature data for ECharts
async function fetchTemperatureData(city) {
    const url = `https://api.tomorrow.io/v4/timelines?location=${city.lat},${city.lon}&fields=temperature&timesteps=1h&units=metric&apikey=${TOMORROW_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        console.error(`Failed to fetch temperature data: ${response.status} ${response.statusText}`);
        throw new Error("Failed to fetch temperature data.");
    }

    const data = await response.json();
    if (!data.data || !data.data.timelines) {
        console.error("Invalid temperature data response:", data);
        throw new Error("Temperature data is missing or invalid.");
    }

    return data.data.timelines[0].intervals.map(interval => ({
        time: new Date(interval.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        temperature: interval.values.temperature
    }));
}


// Fetch air quality data for ECharts
async function fetchAirQualityDataForChart(city) {
    const cacheKey = `airQuality-${city.lat}-${city.lon}`;
    if (apiCache[cacheKey]) {
        document.getElementById("infoMessage").textContent = `Using cached data for ${city.name}.`;
        setTimeout(() => {
            document.getElementById("infoMessage").textContent = ""; // Clear the message after 3 seconds
        }, 3000);
    }
    
    const url = `https://api.waqi.info/feed/geo:${city.lat};${city.lon}/?token=${AQICN_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Failed to fetch air quality data.");
    }

    const data = await response.json();
    if (data.status === "ok") {
        const iaqi = data.data.iaqi;
        const result = [
            [iaqi.pm25?.v || 0, iaqi.pm10?.v || 0],
            [iaqi.no2?.v || 0, iaqi.co?.v || 0],
            [iaqi.so2?.v || 0, iaqi.pm25?.v || 0]
        ];
        apiCache[cacheKey] = result; // Cache the result
        return result;
    } else {
        throw new Error("Invalid air quality data response.");
    }
}

async function fetchAndRenderCharts(city) {
    try {
        // Fetch and render temperature data for charts
        const temperatureData = await fetchTemperatureData(city);
        initializeTemperatureChart(temperatureData);

        // Fetch and render air quality data for charts
        const airQualityData = await fetchAirQualityDataForChart(city);
        initializeAirQualityChart(airQualityData);

        // Fetch and render dashboard weather data
        await fetchWeatherData(city); // Includes temperature, humidity, and wind speed
    } catch (error) {
        // Centralized error handling
        console.error("Error rendering charts:", error);
        showError("Unable to fetch data for the provided city. Please try again.");
    }
}

function initializeOrUpdateChart(chartInstance, containerId, option) {
    const chart = chartInstance || echarts.init(document.getElementById(containerId));
    chart.setOption(option);
    return chart; // Return the chart instance to save globally if needed
}

function initializeTemperatureChart(dataPoints) {
    const option = {
        title: { text: 'Hourly Temperature Trends', left: 'center' },
        tooltip: { trigger: 'axis', formatter: '{b}: {c} °C' },
        xAxis: { type: 'category', data: dataPoints.map(point => point.time), boundaryGap: false },
        yAxis: { type: 'value', axisLabel: { formatter: '{value} °C' } },
        series: [
            { name: 'Temperature', type: 'line', data: dataPoints.map(point => point.temperature), smooth: true }
        ]
    };
    window.temperatureChartInstance = initializeOrUpdateChart(
        window.temperatureChartInstance,
        'temperatureChart',
        option
    );
}

function initializeAirQualityChart(dataPoints) {
    const option = {
        title: { text: 'Air Quality Metrics', left: 'center' },
        tooltip: {
            trigger: 'item',
            formatter: params =>
                `${params.seriesName}<br/>PM2.5: ${params.value[0]} µg/m³<br/>PM10: ${params.value[1]} µg/m³`
        },
        xAxis: { type: 'value', name: 'PM2.5 (µg/m³)', axisLabel: { formatter: '{value}' } },
        yAxis: { type: 'value', name: 'PM10 (µg/m³)', axisLabel: { formatter: '{value}' } },
        series: [
            { name: 'Air Quality', type: 'scatter', data: dataPoints, symbolSize: 10, itemStyle: { color: '#3f51b5' } }
        ]
    };
    window.airQualityChartInstance = initializeOrUpdateChart(
        window.airQualityChartInstance,
        'airQualityChart',
        option
    );
}

// Handle side menu tab switching and ensure charts render properly
document.querySelectorAll('.menuItem').forEach(menuItem => {
    menuItem.addEventListener('click', event => {
        event.preventDefault();

        // Remove 'active' class from all menu items
        document.querySelectorAll('.menuItem').forEach(item => {
            item.classList.remove('active');
        });

        // Add 'active' class to the clicked menu item
        menuItem.classList.add('active');

        // Hide all content sections
        document.querySelectorAll('.content').forEach(content => {
            content.classList.remove('active');
        });

        // Show the content section corresponding to the clicked menu item
        const contentId = menuItem.getAttribute('data-content');
        const contentElement = document.getElementById(contentId);
        contentElement.classList.add('active');

        // Re-render charts if switching to "Graphs" tab
        if (contentId === 'graphsContent') {
            setTimeout(() => {
                if (window.temperatureChartInstance) {
                    window.temperatureChartInstance.resize();
                }
                if (window.airQualityChartInstance) {
                    window.airQualityChartInstance.resize();
                }
            }, 100); // Delay ensures the container is fully visible before resizing
        }
    });
});

function showError(message) {
    const errorElement = document.getElementById("errorMessage");
    errorElement.textContent = message;
    errorElement.style.display = "block"; // Show the error message

    setTimeout(() => {
        errorElement.style.display = "none"; // Hide after 5 seconds
    }, 5000);
}

