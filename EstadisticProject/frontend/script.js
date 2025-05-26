// Configuración
const API_BASE_URL = 'http://localhost:5000/api';
let currentChart = null;
let sp500Companies = [];

// Elementos del DOM
const elements = {
    tickerSelect: document.getElementById('ticker-select'),
    searchBtn: document.getElementById('search-btn'),
    rentabilidadInput: document.getElementById('rentabilidad-input'),
    calcProbBtn: document.getElementById('calc-prob-btn'),
    resultsContainer: document.getElementById('results-container'),
    errorDisplay: document.getElementById('error-display'),
    companyName: document.getElementById('company-name'),
    companyMeta: document.getElementById('company-meta'),
    currentPrice: document.getElementById('current-price'),
    avgReturn: document.getElementById('avg-return'),
    confidenceInterval: document.getElementById('confidence-interval'),
    probGain: document.getElementById('prob-gain'),
    volatility: document.getElementById('volatility'),
    hypothesisTestResult: document.getElementById('hypothesis-test-result'),
    hypothesisTestDetails: document.getElementById('hypothesis-test-details'),
    normalityTestResult: document.getElementById('normality-test-result'),
    normalityTestDetails: document.getElementById('normality-test-details'),
    probabilitySection: document.getElementById('probability-section'),
    expectedProbability: document.getElementById('expected-probability'),
    probabilityDescription: document.getElementById('probability-description'),
    chartContainer: document.getElementById('chart-container')
};

// Formateadores
const format = {
    currency: (value) => value ? `$${value.toFixed(2)}` : '--',
    percent: (value, decimals = 2) => value ? `${(value * 100).toFixed(decimals)}%` : '--',
    smallNumber: (value) => value ? value.toExponential(2) : '--'
};

// Cargar lista de empresas del S&P 500
async function loadSP500Companies() {
    try {
        // En un proyecto real, podrías cargar esto desde una API o archivo JSON
        // Aquí un ejemplo con algunas empresas comunes
        sp500Companies = [
            { symbol: 'AAPL', name: 'Apple Inc.' },
            { symbol: 'MSFT', name: 'Microsoft Corporation' },
            { symbol: 'GOOGL', name: 'Alphabet Inc. (Google)' },
            { symbol: 'AMZN', name: 'Amazon.com Inc.' },
            { symbol: 'META', name: 'Meta Platforms Inc.' },
            { symbol: 'TSLA', name: 'Tesla Inc.' },
            { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
            { symbol: 'V', name: 'Visa Inc.' },
            { symbol: 'NVDA', name: 'NVIDIA Corporation' },
            { symbol: 'WMT', name: 'Walmart Inc.' }
            // Puedes agregar más empresas según necesites
        ];

        // Limpiar y poblar el selector
        elements.tickerSelect.innerHTML = '';
        
        // Opción por defecto
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Selecciona una empresa --';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        elements.tickerSelect.appendChild(defaultOption);
        
        // Agregar empresas
        sp500Companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.symbol;
            option.textContent = `${company.symbol} - ${company.name}`;
            elements.tickerSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error al cargar empresas:', error);
        showError('No se pudieron cargar las empresas. Recarga la página.');
    }
}

// Analizar la empresa seleccionada
async function analyzeStock() {
    const ticker = elements.tickerSelect.value;
    
    if (!ticker) {
        showError('Por favor selecciona una empresa');
        return;
    }

    try {
        showLoading(ticker);
        
        const response = await fetch(`${API_BASE_URL}/empresa/${ticker}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error al cargar datos para ${ticker}`);
        }
        
        const data = await response.json();
        displayResults(data);
        await loadHistogram(ticker);
        clearError();
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
        hideResults();
    }
}

// Mostrar resultados en la UI
function displayResults(data) {
    // Mostrar contenedor de resultados
    elements.resultsContainer.style.display = 'block';
    
    // Información de la empresa
    const company = sp500Companies.find(c => c.symbol === data.empresa) || { name: data.empresa };
    elements.companyName.textContent = company.name;
    elements.companyMeta.textContent = `Símbolo: ${data.empresa}`;
    
    // Métricas básicas
    elements.currentPrice.textContent = format.currency(data.precio_actual);
    elements.avgReturn.textContent = format.percent(data.rentabilidad_promedio, 4);
    elements.probGain.textContent = format.percent(data.probabilidad_ganancia);
    elements.volatility.textContent = data.volatilidad.toFixed(6);
    
    // Intervalo de confianza
    const [lower, upper] = data.intervalo_confianza;
    elements.confidenceInterval.textContent = `Intervalo 95%: ${format.percent(lower, 4)} a ${format.percent(upper, 4)}`;
    
    // Prueba de hipótesis
    elements.hypothesisTestResult.textContent = data.prueba_hipotesis.rechaza_H0 
        ? '✅ Rentabilidad significativamente positiva' 
        : '❌ Rentabilidad no significativa';
    elements.hypothesisTestDetails.textContent = `p-valor: ${format.smallNumber(data.prueba_hipotesis.p_valor)}`;
    
    // Prueba de normalidad
    elements.normalityTestResult.textContent = data.normalidad.es_normal 
        ? '✅ Datos normales' 
        : '❌ Datos no normales';
    elements.normalityTestDetails.textContent = `p-valor: ${format.smallNumber(data.normalidad.p_valor)} (${data.normalidad.metodo})`;
    
    // Resetear sección de probabilidad
    elements.probabilitySection.style.display = 'block';
    elements.expectedProbability.textContent = '--';
    elements.probabilityDescription.textContent = 'Ingresa una rentabilidad esperada y haz clic en "Calcular Probabilidad"';
}

// Cargar histograma
async function loadHistogram(ticker) {
    try {
        const response = await fetch(`${API_BASE_URL}/empresa/${ticker}/histograma`);
        const data = await response.json();
        
        // Limpiar contenedor
        elements.chartContainer.innerHTML = '';
        
        // Crear imagen del gráfico
        const img = document.createElement('img');
        img.src = `data:image/png;base64,${data.imagen}`;
        img.alt = `Distribución de precios para ${ticker}`;
        img.className = 'histogram-image';
        
        elements.chartContainer.appendChild(img);
        
    } catch (error) {
        console.error('Error al cargar histograma:', error);
        elements.chartContainer.innerHTML = '<p class="chart-error">No se pudo cargar el gráfico</p>';
    }
}

// Calcular probabilidad de rentabilidad esperada
async function calculateExpectedProbability() {
    const ticker = elements.tickerSelect.value;
    const rentabilidad = parseFloat(elements.rentabilidadInput.value);
    
    if (!ticker) {
        showError('Primero selecciona una empresa');
        return;
    }
    
    if (isNaN(rentabilidad)) {
        showError('Ingresa un valor numérico válido para la rentabilidad esperada');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/empresa/${ticker}/probabilidad`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                rentabilidad_esperada: rentabilidad
            })
        });
        
        const data = await response.json();
        
        // Mostrar resultado
        elements.expectedProbability.textContent = format.percent(data.probabilidad);
        elements.probabilityDescription.textContent = `Probabilidad de alcanzar ${rentabilidad}% de rentabilidad diaria`;
        
    } catch (error) {
        console.error('Error:', error);
        showError('Error al calcular probabilidad');
    }
}

// Funciones auxiliares
function showLoading(ticker) {
    elements.companyName.textContent = `Cargando ${ticker}...`;
    elements.errorDisplay.textContent = '';
    elements.errorDisplay.style.display = 'none';
}

function showError(message) {
    elements.errorDisplay.textContent = message;
    elements.errorDisplay.style.display = 'block';
}

function clearError() {
    elements.errorDisplay.style.display = 'none';
}

function hideResults() {
    elements.resultsContainer.style.display = 'none';
}

// Event listeners
elements.searchBtn.addEventListener('click', analyzeStock);
elements.calcProbBtn.addEventListener('click', calculateExpectedProbability);

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadSP500Companies();
    
    // Opcional: Analizar automáticamente al seleccionar una empresa
    elements.tickerSelect.addEventListener('change', function() {
        if (this.value) analyzeStock();
    });
});