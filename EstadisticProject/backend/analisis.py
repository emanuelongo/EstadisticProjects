import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from scipy.stats import norm, t, ttest_1samp, shapiro, normaltest
import matplotlib.pyplot as plt
import json

class AnalisisAccion:
    def __init__(self, codigo_empresa):
        self.codigo_empresa = codigo_empresa
        self.fecha_inicio = (datetime.now() - timedelta(days=4*365)).strftime('%Y-%m-%d')
        self.data = self.descargar_datos()
        self.calcular_rentabilidad_diaria()

    def descargar_datos(self):
        datos = yf.download(self.codigo_empresa, self.fecha_inicio)
        datos = datos[['Open', 'High', 'Low', 'Close', 'Volume']]
        datos.columns = ['apertura', 'maximo', 'minimo', 'ultimo', 'volumen']
        return datos

    def calcular_rentabilidad_diaria(self):
        rentabilidad_logaritmica = np.log(self.data['ultimo'] / self.data['ultimo'].shift(1))
        self.data['rentabilidad'] = rentabilidad_logaritmica

    def get_datos(self):
        return self.data

    def rentabilidad_promedio(self):
        return self.data['rentabilidad'].mean()

    def calcular_probabilidad_rentabilidad(self):
        rentabilidad = self.data['rentabilidad'].dropna()
        casos_favorables = (rentabilidad > 0).sum()
        casos_totales = len(rentabilidad)
        return (casos_favorables / casos_totales) if casos_totales > 0 else 0

    def calcular_desviacion_estandar(self):
        return self.data['rentabilidad'].std()

    def calcular_probabilidad_esperada(self, rent_esperada):
        media = self.rentabilidad_promedio()
        desviacion = self.calcular_desviacion_estandar()
        prob = 1 - norm.cdf(rent_esperada/100, loc=media, scale=desviacion)
        return prob

    def intervalo_confianza_rentabilidad(self, confianza=0.95):
        rentabilidades = self.data['rentabilidad'].dropna()
        n = len(rentabilidades)
        media = rentabilidades.mean()
        std_error = rentabilidades.std(ddof=1)/np.sqrt(n)
        
        if n < 30:
            return t.interval(confianza, n-1, loc=media, scale=std_error)
        return norm.interval(confianza, loc=media, scale=std_error)

    def prueba_hipotesis_rentabilidad_positiva(self, alpha=0.05):
        rentabilidades = self.data['rentabilidad'].dropna()
        t_stat, p_valor = ttest_1samp(rentabilidades, 0, alternative='greater')
        
        return {
            'p_valor': p_valor,
            'rechaza_H0': p_valor < alpha,
            'estadistico': t_stat,
            'conclusion': f"Rentabilidad {'es' if p_valor < alpha else 'no es'} significativamente positiva"
        }

    def prueba_normalidad_rentabilidades(self):
        rentabilidades = self.data['rentabilidad'].dropna()
        
        if len(rentabilidades) < 5000:
            stat, p = shapiro(rentabilidades)
            metodo = "Shapiro-Wilk"
        else:
            stat, p = normaltest(rentabilidades)
            metodo = "D'Agostino-Pearson"
        
        return {
            'metodo': metodo,
            'p_valor': p,
            'es_normal': p > 0.05
        }

    def generar_histograma(self):
        plt.figure(figsize=(10, 6))
        self.data['ultimo'].hist(bins=50)
        plt.title(f'Distribución de precios de {self.codigo_empresa}')
        plt.xlabel('Precio de cierre')
        plt.ylabel('Frecuencia')
        plt.grid(True)
        return plt

    # En el método get_resumen_estadistico()
    def get_resumen_estadistico(self):
        return {
            'empresa': str(self.codigo_empresa),  # Asegurar string
            'precio_actual': float(self.data['ultimo'].iloc[-1]),  # Asegurar float
            'rentabilidad_promedio': float(self.rentabilidad_promedio()),
            'probabilidad_ganancia': float(self.calcular_probabilidad_rentabilidad()),
            'volatilidad': float(self.calcular_desviacion_estandar()),
            'intervalo_confianza': [float(x) for x in self.intervalo_confianza_rentabilidad()],
            'prueba_hipotesis': {
                'p_valor': float(self.prueba_hipotesis_rentabilidad_positiva()['p_valor']),
                'rechaza_H0': bool(self.prueba_hipotesis_rentabilidad_positiva()['rechaza_H0']),
                'estadistico': float(self.prueba_hipotesis_rentabilidad_positiva()['estadistico']),
                'conclusion': str(self.prueba_hipotesis_rentabilidad_positiva()['conclusion'])
            },
            'normalidad': {
                'metodo': str(self.prueba_normalidad_rentabilidades()['metodo']),
                'p_valor': float(self.prueba_normalidad_rentabilidades()['p_valor']),
                'es_normal': bool(self.prueba_normalidad_rentabilidades()['es_normal'])
            }
        }