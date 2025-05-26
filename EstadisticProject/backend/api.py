from flask import Flask, jsonify, request
from flask_cors import CORS
from analisis import AnalisisAccion
import matplotlib.pyplot as plt
import io
import base64
import json

app = Flask(__name__)
CORS(app)

class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (bool, np.bool_)):
            return bool(obj)
        if isinstance(obj, (np.float32, np.float64)):
            return float(obj)
        if isinstance(obj, (np.int32, np.int64)):
            return int(obj)
        return super().default(obj)

app.json_encoder = EnhancedJSONEncoder

@app.route('/api/empresa/<codigo>', methods=['GET'])
def obtener_analisis(codigo):
    try:
        accion = AnalisisAccion(codigo)
        # Convertimos manualmente los valores no serializables
        resumen = accion.get_resumen_estadistico()
        
        # Aseguramos que todos los valores sean serializables
        resumen_serializable = {
            'empresa': str(resumen['empresa']),
            'precio_actual': float(resumen['precio_actual']),
            'rentabilidad_promedio': float(resumen['rentabilidad_promedio']),
            'probabilidad_ganancia': float(resumen['probabilidad_ganancia']),
            'volatilidad': float(resumen['volatilidad']),
            'intervalo_confianza': [float(x) for x in resumen['intervalo_confianza']],
            'prueba_hipotesis': {
                'p_valor': float(resumen['prueba_hipotesis']['p_valor']),
                'rechaza_H0': bool(resumen['prueba_hipotesis']['rechaza_H0']),
                'estadistico': float(resumen['prueba_hipotesis']['estadistico']),
                'conclusion': str(resumen['prueba_hipotesis']['conclusion'])
            },
            'normalidad': {
                'metodo': str(resumen['normalidad']['metodo']),
                'p_valor': float(resumen['normalidad']['p_valor']),
                'es_normal': bool(resumen['normalidad']['es_normal'])
            }
        }
        
        return jsonify(resumen_serializable)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/empresa/<codigo>/histograma', methods=['GET'])
def obtener_histograma(codigo):
    try:
        accion = AnalisisAccion(codigo)
        plot = accion.generar_histograma()
        
        img = io.BytesIO()
        plot.savefig(img, format='png', bbox_inches='tight')
        img.seek(0)
        plt.close()
        
        return jsonify({
            'imagen': base64.b64encode(img.getvalue()).decode('utf-8')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/empresa/<codigo>/probabilidad', methods=['POST'])
def calcular_probabilidad(codigo):
    try:
        data = request.get_json()
        rent_esperada = float(data['rentabilidad_esperada'])
        
        accion = AnalisisAccion(codigo)
        prob = accion.calcular_probabilidad_esperada(rent_esperada)
        
        return jsonify({
            'probabilidad': float(prob),
            'rentabilidad_esperada': rent_esperada
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(port=5000, debug=True)