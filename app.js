const CSV_FILE_PATH = 'delhi.csv'; 
const EUR_RATE = 0.0095; 

let rawData = [];
let filteredData = [];

const commonConfig = {
    background: "transparent", 
    font: "Outfit",
    axis: {
        labelColor: "#94a3b8", 
        titleColor: "#f8fafc", 
        gridColor: "rgba(255,255,255,0.1)", 
        domainColor: "rgba(255,255,255,0.1)",
        labelFontSize: 11,
        titleFontSize: 12
    },
    legend: {
        labelColor: "#94a3b8",
        titleColor: "#f8fafc",
        labelFontSize: 11,
        titleFontSize: 12
    },
    title: { 
        color: "#f8fafc",
        fontSize: 14
    },
    view: { 
        stroke: "transparent" 
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard initialized');
    loadDataAutomatically();
});

function loadDataAutomatically() {
    const loader = document.getElementById('loader');
    
    fetch(CSV_FILE_PATH)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP Error!`);
            return response.text();
        })
        .then(csvText => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    rawData = results.data.filter(d => d.price && d.airline);
                    rawData.forEach(d => {
                        d.route = `${d.source_city} → ${d.destination_city}`;
                        d.price_eur = Math.round(d.price * EUR_RATE); // Euró számítás
                    });
                    filteredData = [...rawData];
                    populateFilters();
                    updateDashboard();
                    loader.style.display = 'none';
                },
                error: (err) => console.error('Parse Error:', err)
            });
        })
        .catch(err => console.error('Fetch Error:', err));
}

function populateFilters() {
    const airlines = [...new Set(rawData.map(d => d.airline))].sort();
    const airlineSelect = document.getElementById('filter-airline');
    airlines.forEach(airline => {
        const option = document.createElement('option');
        option.value = airline;
        option.textContent = airline;
        airlineSelect.appendChild(option);
    });

    const times = ['Early_Morning', 'Morning', 'Afternoon', 'Evening', 'Night', 'Late_Night'];
    const timeSelect = document.getElementById('filter-time');
    times.forEach(time => {
        const option = document.createElement('option');
        option.value = time;
        option.textContent = time.replace('_', ' ');
        timeSelect.appendChild(option);
    });

    const stops = [...new Set(rawData.map(d => d.stops))].sort();
    const stopSelect = document.getElementById('filter-stops');
    stops.forEach(stop => {
        const option = document.createElement('option');
        option.value = stop;
        option.textContent = stop === 'zero' ? 'Direct' : stop === 'one' ? '1 Stop' : '2+ Stops';
        stopSelect.appendChild(option);
    });
}

function updateDashboard() {
    const airlineVal = document.getElementById('filter-airline').value;
    const timeVal = document.getElementById('filter-time').value;
    const stopsVal = document.getElementById('filter-stops').value;
    const daysVal = parseInt(document.getElementById('filter-days').value);

    document.getElementById('days-val').textContent = daysVal;

    filteredData = rawData.filter(d => {
        return (
            (airlineVal === 'all' || d.airline === airlineVal) &&
            (timeVal === 'all' || d.departure_time === timeVal) &&
            (stopsVal === 'all' || d.stops === stopsVal) &&
            (d.days_left <= daysVal)
        );
    });

    updateStats();
    renderCharts();
    generateInsights();
}

function resetFilters() {
    document.getElementById('filter-airline').value = 'all';
    document.getElementById('filter-time').value = 'all';
    document.getElementById('filter-stops').value = 'all';
    document.getElementById('filter-days').value = 50;
    updateDashboard();
}

function formatCurrency(inr) {
    const eur = Math.round(inr * EUR_RATE);
    return `₹${inr.toLocaleString()} (€${eur.toLocaleString()})`;
}

function updateStats() {
    const prices = filteredData.map(d => d.price);
    const total = prices.length;
    const avg = total ? prices.reduce((a, b) => a + b, 0) / total : 0;
    const min = total ? Math.min(...prices) : 0;
    const max = total ? Math.max(...prices) : 0;

    document.getElementById('stat-total').textContent = total.toLocaleString();
    document.getElementById('stat-avg').textContent = formatCurrency(Math.round(avg));
    document.getElementById('stat-min').textContent = formatCurrency(min);
    document.getElementById('stat-max').textContent = formatCurrency(max);
    document.getElementById('data-count').textContent = total.toLocaleString();
}

function generateInsights() {
    const insights = [];
    if (filteredData.length === 0) {
        insights.push('<i class="ri-error-warning-line"></i> No data matches current filters.');
    } else {
        const avgByAirline = {};
        filteredData.forEach(d => {
            if (!avgByAirline[d.airline]) avgByAirline[d.airline] = [];
            avgByAirline[d.airline].push(d.price);
        });
        
        const airlineAvgs = Object.entries(avgByAirline).map(([airline, prices]) => ({
            airline,
            avg: prices.reduce((a, b) => a + b) / prices.length
        }));
        
        airlineAvgs.sort((a, b) => a.avg - b.avg);
        
        if (airlineAvgs.length > 0) {
            const bestPrice = Math.round(airlineAvgs[0].avg);
            insights.push(`<i class="ri-lightbulb-line" style="color:#f59e0b"></i> <strong>${airlineAvgs[0].airline}</strong> offers the lowest average price at ${formatCurrency(bestPrice)}`);
        }

        const directFlights = filteredData.filter(d => d.stops === 'zero');
        const connectingFlights = filteredData.filter(d => d.stops !== 'zero');
        
        if (directFlights.length > 0 && connectingFlights.length > 0) {
            const directAvg = directFlights.reduce((sum, d) => sum + d.price, 0) / directFlights.length;
            const connectingAvg = connectingFlights.reduce((sum, d) => sum + d.price, 0) / connectingFlights.length;
            const diff = Math.abs(directAvg - connectingAvg);
            
            insights.push(`<i class="ri-git-merge-line" style="color:#6366f1"></i> Difference between Direct and Connecting: ${formatCurrency(Math.round(diff))}`);
        }
    }
    document.getElementById('insights-list').innerHTML = insights.map(i => `<li>${i}</li>`).join('');
}

function renderCharts() {
    const dataObj = { values: filteredData };
    
    // Alap tooltip beállítás a nyers adatokhoz
    const priceTooltips = [
        { field: "airline", title: "Airline" },
        { field: "price", title: "Price (₹)", format: "," },
        { field: "price_eur", title: "Price (€)", format: "," },
    ];

    // Chart 1: Scatter (Days vs Price)
    vegaEmbed('#viz-days', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 350, data: dataObj,
        mark: { type: "circle", size: 60, opacity: 0.6 },
        encoding: {
            x: { field: "days_left", type: "quantitative", title: "Days Before Departure" },
            y: { field: "price", type: "quantitative", title: "Price (₹)" },
            color: { field: "airline", type: "nominal", legend: { title: "Airline" } },
            tooltip: [ ...priceTooltips, { field: "days_left", title: "Days Left" } ]
        },
        config: commonConfig
    }, { actions: false });

    // Chart 2: Bar (Airline Avg)
    vegaEmbed('#viz-airline', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 400, data: dataObj,
        mark: { type: "bar", cornerRadiusEnd: 4, color: "#6366f1" },
        encoding: {
            x: { field: "airline", type: "nominal", sort: "-y", title: null, axis: { labelAngle: -45 } },
            y: { field: "price", aggregate: "average", type: "quantitative", title: "Average Price (₹)" },
            tooltip: [ 
                { field: "airline", title: "Airline" }, 
                { field: "price", aggregate: "average", title: "Avg (₹)", format: ",.0f" },
                { field: "price_eur", aggregate: "average", title: "Avg (€)", format: ",.0f" } // JAVÍTVA
            ]
        },
        config: commonConfig
    }, { actions: false });

    // Chart 3: Box Plot (Stops)
    vegaEmbed('#viz-stops', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 300, data: dataObj,
        mark: { type: "boxplot", extent: 1.5 },
        encoding: {
            x: { field: "stops", type: "nominal", sort: ["zero", "one", "two_or_more"], title: null },
            y: { field: "price", type: "quantitative", title: "Price (₹)" },
            color: { field: "stops", legend: null, scale: { scheme: "dark2" } },
            tooltip: [ 
                { field: "stops", title: "Stops" }, 
                { field: "price", title: "Price (₹)", format: "," },
                { field: "price_eur", title: "Price (€)", format: "," } // JAVÍTVA
            ]
        },
        config: commonConfig
    }, { actions: false });

    // Chart 4: Heatmap (Route)
    vegaEmbed('#viz-heatmap', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 350, data: dataObj,
        mark: "rect",
        encoding: {
            x: { field: "airline", type: "nominal", axis: { labelAngle: -45 } },
            y: { field: "route", type: "nominal", title: "Route" },
            color: { 
                field: "price", 
                aggregate: "average", 
                type: "quantitative", 
                scale: { scheme: "viridis" }, 
                title: "Avg Price" 
            },
            tooltip: [ 
                { field: "route", title: "Route" }, 
                { field: "airline", title: "Airline" }, 
                { field: "price", aggregate: "average", title: "Avg (₹)", format: ",.0f" },
                { field: "price_eur", aggregate: "average", title: "Avg (€)", format: ",.0f" } // JAVÍTVA
            ]
        },
        config: commonConfig
    }, { actions: false });

    // Chart 5: Line (Time of Day)
    vegaEmbed('#viz-time', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 300, data: dataObj,
        mark: { type: "line", point: true, strokeWidth: 3, color: "#f43f5e" },
        encoding: {
            x: { field: "departure_time", type: "nominal", sort: ['Early_Morning', 'Morning', 'Afternoon', 'Evening', 'Night', 'Late_Night'], axis: { labelAngle: -45 } },
            y: { field: "price", aggregate: "average", type: "quantitative", title: "Average Price (₹)" },
            tooltip: [ 
                { field: "departure_time", title: "Time" }, 
                { field: "price", aggregate: "average", title: "Avg (₹)", format: ",.0f" },
                { field: "price_eur", aggregate: "average", title: "Avg (€)", format: ",.0f" } // JAVÍTVA
            ]
        },
        config: commonConfig
    }, { actions: false });

    // Chart 6: Correlation (Duration)
    vegaEmbed('#viz-duration', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 300, data: dataObj,
        mark: { type: "point", filled: true, size: 50, opacity: 0.6 },
        encoding: {
            x: { field: "duration", type: "quantitative", title: "Flight Duration (hours)" },
            y: { field: "price", type: "quantitative", title: "Price (₹)" },
            color: { field: "stops", type: "nominal" },
            tooltip: [ 
                { field: "duration", title: "Duration" }, 
                { field: "price", title: "Price (₹)", format: "," },
                { field: "price_eur", title: "Price (€)", format: "," }, // JAVÍTVA
                { field: "stops", title: "Stops" }
            ]
        },
        config: commonConfig
    }, { actions: false });
}