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
    console.log('🚀 Dashboard inicializálva');
    loadDataAutomatically();
});

function loadDataAutomatically() {
    const loader = document.getElementById('loader');

    fetch(CSV_FILE_PATH)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP Hiba!`);
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
                error: (err) => console.error('Parse Hiba:', err)
            });
        })
        .catch(err => console.error('Fetch Hiba:', err));
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
    const timeLabels = {
        'Early_Morning': 'Kora reggel',
        'Morning': 'Reggel',
        'Afternoon': 'Délután',
        'Evening': 'Este',
        'Night': 'Éjszaka',
        'Late_Night': 'Késő éjjel'
    };
    const timeSelect = document.getElementById('filter-time');
    times.forEach(time => {
        const option = document.createElement('option');
        option.value = time; 
        option.textContent = timeLabels[time] || time;
        timeSelect.appendChild(option);
    });

  
    const stops = [...new Set(rawData.map(d => d.stops))].sort();
    const stopSelect = document.getElementById('filter-stops');
    stops.forEach(stop => {
        const option = document.createElement('option');
        option.value = stop; 
        const label = stop === 'zero' ? 'Közvetlen' : stop === 'one' ? '1 Átszállás' : '2+ Átszállás';
        option.textContent = label;
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
        insights.push('<i class="ri-error-warning-line"></i> Nincs a szűrésnek megfelelő adat.');
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
            insights.push(`<i class="ri-lightbulb-line" style="color:#f59e0b"></i> <strong>${airlineAvgs[0].airline}</strong> kínálja a legalacsonyabb átlagárat: ${formatCurrency(bestPrice)}`);
        }

        const directFlights = filteredData.filter(d => d.stops === 'zero');
        const connectingFlights = filteredData.filter(d => d.stops !== 'zero');

        if (directFlights.length > 0 && connectingFlights.length > 0) {
            const directAvg = directFlights.reduce((sum, d) => sum + d.price, 0) / directFlights.length;
            const connectingAvg = connectingFlights.reduce((sum, d) => sum + d.price, 0) / connectingFlights.length;
            const diff = Math.abs(directAvg - connectingAvg);

            insights.push(`<i class="ri-git-merge-line" style="color:#6366f1"></i> Különbség a közvetlen és átszállásos között: ${formatCurrency(Math.round(diff))}`);
        }
    }
    document.getElementById('insights-list').innerHTML = insights.map(i => `<li>${i}</li>`).join('');
}

function renderCharts() {
    const dataObj = { values: filteredData };

   
    const priceTooltips = [
        { field: "airline", title: "Légitársaság" },
        { field: "price", title: "Ár (₹)", format: "," },
        { field: "price_eur", title: "Ár (€)", format: "," },
    ];

    // Chart 1
    vegaEmbed('#viz-days', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 350, data: dataObj,
        mark: { type: "circle", size: 60, opacity: 0.6 },
        encoding: {
            x: { field: "days_left", type: "quantitative", title: "Napok indulásig" },
            y: { field: "price", type: "quantitative", title: "Ár (₹)" },
            color: { field: "airline", type: "nominal", legend: { title: "Légitársaság" } },
            tooltip: [...priceTooltips, { field: "days_left", title: "Napok száma" }]
        },
        config: commonConfig
    }, { actions: false });

    // Chart 2: Bar
    vegaEmbed('#viz-airline', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 400, data: dataObj,
        mark: { type: "bar", cornerRadiusEnd: 4, color: "#6366f1" },
        encoding: {
            x: { field: "airline", type: "nominal", sort: "-y", title: null, axis: { labelAngle: -45 } },
            y: { field: "price", aggregate: "average", type: "quantitative", title: "Átlagár (₹)" },
            tooltip: [
                { field: "airline", title: "Légitársaság" },
                { field: "price", aggregate: "average", title: "Átlag (₹)", format: ",.0f" },
                { field: "price_eur", aggregate: "average", title: "Átlag (€)", format: ",.0f" }
            ]
        },
        config: commonConfig
    }, { actions: false });

    // Chart 3
    vegaEmbed('#viz-stops', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 300, data: dataObj,
        mark: { type: "boxplot", extent: 1.5 },
        encoding: {
            x: {
                field: "stops", type: "nominal", sort: ["zero", "one", "two_or_more"], title: null, axis: {
                    labelExpr: "datum.value == 'zero' ? 'Közvetlen' : datum.value == 'one' ? '1 Átszállás' : '2+ Átszállás'"
                }
            },
            y: { field: "price", type: "quantitative", title: "Ár (₹)" },
            color: { field: "stops", legend: null, scale: { scheme: "dark2" } },
            tooltip: [
                { field: "stops", title: "Típus" },
                { field: "price", title: "Ár (₹)", format: "," },
                { field: "price_eur", title: "Ár (€)", format: "," }
            ]
        },
        config: commonConfig
    }, { actions: false });

    // Chart 4:
    vegaEmbed('#viz-heatmap', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 350, data: dataObj,
        mark: "rect",
        encoding: {
            x: { field: "airline", type: "nominal", axis: { labelAngle: -45 }, title: "Légitársaság" },
            y: { field: "route", type: "nominal", title: "Útvonal" },
            color: {
                field: "price",
                aggregate: "average",
                type: "quantitative",
                scale: { scheme: "viridis" },
                title: "Átlagár"
            },
            tooltip: [
                { field: "route", title: "Útvonal" },
                { field: "airline", title: "Légitársaság" },
                { field: "price", aggregate: "average", title: "Átlag (₹)", format: ",.0f" },
                { field: "price_eur", aggregate: "average", title: "Átlag (€)", format: ",.0f" }
            ]
        },
        config: commonConfig
    }, { actions: false });

    // Chart 5:
    vegaEmbed('#viz-time', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 300, data: dataObj,
        mark: { type: "line", point: true, strokeWidth: 3, color: "#f43f5e" },
        encoding: {
            x: {
                field: "departure_time",
                type: "nominal",
                sort: ['Early_Morning', 'Morning', 'Afternoon', 'Evening', 'Night', 'Late_Night'],
                axis: { labelAngle: -45 },
                title: "Napszak"
            },
            y: { field: "price", aggregate: "average", type: "quantitative", title: "Átlagár (₹)" },
            tooltip: [
                { field: "departure_time", title: "Időszak" },
                { field: "price", aggregate: "average", title: "Átlag (₹)", format: ",.0f" },
                { field: "price_eur", aggregate: "average", title: "Átlag (€)", format: ",.0f" }
            ]
        },
        config: commonConfig
    }, { actions: false });

    // Chart 6
    vegaEmbed('#viz-duration', {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: "container", height: 300, data: dataObj,
        mark: { type: "point", filled: true, size: 50, opacity: 0.6 },
        encoding: {
            x: { field: "duration", type: "quantitative", title: "Repülési idő (óra)" },
            y: { field: "price", type: "quantitative", title: "Ár (₹)" },
            color: { field: "stops", type: "nominal", legend: { title: "Átszállás" } },
            tooltip: [
                { field: "duration", title: "Időtartam" },
                { field: "price", title: "Ár (₹)", format: "," },
                { field: "price_eur", title: "Ár (€)", format: "," },
                { field: "stops", title: "Átszállás kód" }
            ]
        },
        config: commonConfig
    }, { actions: false });
}