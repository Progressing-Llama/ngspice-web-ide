import os
import subprocess
import tempfile
import re
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def parse_raw_file(filepath):
    """Parses an ASCII ngspice raw file into a list of dictionaries."""
    try:
        with open(filepath, 'r') as f:
            lines = f.readlines()
        
        data = []
        variables = []
        num_variables = 0
        in_variables = False
        in_values = False
        
        current_point = {}
        var_index = 0

        for line in lines:
            line = line.strip()
            if not line: continue

            if line.startswith("No. Variables:"):
                num_variables = int(line.split(":")[1].strip())
            elif line.startswith("Variables:"):
                in_variables = True
                continue
            elif line.startswith("Values:"):
                in_variables = False
                in_values = True
                continue
            
            if in_variables:
                # Format: index name type
                parts = line.split()
                if len(parts) >= 2:
                    variables.append(parts[1])
            
            elif in_values:
                # Values are listed point by point
                # First value of a point starts with an index
                parts = line.split()
                
                if len(parts) > 1: # Start of a new point
                    if current_point:
                        data.append(current_point)
                    current_point = {}
                    var_index = 0
                    # parts[0] is index, parts[1] is value
                    val = float(parts[1])
                    current_point[variables[var_index]] = val
                    var_index += 1
                else: # Continuation of values for the current point
                    val = float(parts[0])
                    current_point[variables[var_index]] = val
                    var_index += 1
                
                if var_index == num_variables:
                    # Point complete (handled by the next line's start-of-point check or loop end)
                    pass

        if current_point:
            data.append(current_point)
            
        return data
    except Exception as e:
        print(f"Error parsing raw file: {e}")
        return []

@app.route('/status', methods=['GET'])
def status():
    return jsonify({"status": "online", "message": "ngspice bridge is running"})

@app.route('/simulate', methods=['POST'])
def simulate():
    data = request.json
    netlist = data.get('netlist', '')
    
    if not netlist:
        return jsonify({"error": "No netlist provided"}), 400

    # Ensure ASCII output in the netlist if not present
    # We look for .control and add 'set filetype=ascii'
    if ".control" in netlist.lower() and "set filetype=ascii" not in netlist.lower():
        netlist = netlist.replace(".control", ".control\nset filetype=ascii")
    elif ".control" not in netlist.lower():
        # If no control block, we might need to add one or just hope for the best
        # Actually, we can add it before .end
        if ".end" in netlist.lower():
            netlist = netlist.replace(".end", ".control\nset filetype=ascii\nrun\n.endc\n.end")

    with tempfile.NamedTemporaryFile(suffix='.cir', delete=False, mode='w') as tmp:
        tmp.write(netlist)
        tmp_path = tmp.name

    raw_output_path = tmp_path + ".raw"
    
    try:
        # Run ngspice
        process = subprocess.Popen(
            ['ngspice', '-b', '-r', raw_output_path, tmp_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate()

        plot_data = []
        if os.path.exists(raw_output_path):
            plot_data = parse_raw_file(raw_output_path)

        return jsonify({
            "stdout": stdout,
            "stderr": stderr,
            "success": process.returncode == 0,
            "plotData": plot_data
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        if os.path.exists(raw_output_path):
            os.remove(raw_output_path)

if __name__ == '__main__':
    app.run(port=5000)
