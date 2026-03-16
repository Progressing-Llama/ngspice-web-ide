import os
import subprocess
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow requests from the web app

@app.route('/status', methods=['GET'])
def status():
    return jsonify({"status": "online", "message": "ngspice bridge is running"})

@app.route('/simulate', methods=['POST'])
def simulate():
    data = request.json
    netlist = data.get('netlist', '')
    
    if not netlist:
        return jsonify({"error": "No netlist provided"}), 400

    # Create a temporary file for the netlist
    with tempfile.NamedTemporaryFile(suffix='.cir', delete=False, mode='w') as tmp:
        tmp.write(netlist)
        tmp_path = tmp.name

    try:
        # Run ngspice in batch mode
        # -b: batch mode
        # -r: raw output file (optional, but good for parsing)
        raw_output_path = tmp_path + ".raw"
        process = subprocess.Popen(
            ['ngspice', '-b', tmp_path, '-r', raw_output_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate()

        # Basic parsing of raw file if it exists (simplified for this bridge)
        # In a real app, you'd parse the binary/ascii raw file for plotting
        plot_data = []
        if os.path.exists(raw_output_path):
            # For now, we just return that the file was generated
            # A more advanced bridge would parse this into JSON
            pass

        return jsonify({
            "stdout": stdout,
            "stderr": stderr,
            "success": process.returncode == 0,
            "raw_file": raw_output_path if os.path.exists(raw_output_path) else None
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == '__main__':
    # Run on a port the user can access
    print("Starting ngspice bridge on http://localhost:5000")
    app.run(port=5000)
