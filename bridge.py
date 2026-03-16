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

    # Clean up netlist and ensure ASCII output for parsing
    # Batch mode (-b) is more stable for server-side execution
    
    # 1. Ensure 'set filetype=ascii' and 'run' are in the control block
    if ".control" in netlist.lower():
        if "set filetype=ascii" not in netlist.lower():
            netlist = re.sub(r"\.control", ".control\nset filetype=ascii", netlist, flags=re.IGNORECASE)
        if "run" not in netlist.lower():
            # Try to insert 'run' before .endc
            netlist = re.sub(r"\.endc", "run\n.endc", netlist, flags=re.IGNORECASE)
    else:
        # 2. If no control block, add one to ensure 'run' and 'ascii' output
        if ".end" in netlist.lower():
            netlist = netlist.replace(".end", ".control\nset filetype=ascii\nrun\n.endc\n.end")
        else:
            netlist += "\n.control\nset filetype=ascii\nrun\n.endc\n.end"

    with tempfile.NamedTemporaryFile(suffix='.cir', delete=False, mode='w') as tmp:
        tmp.write(netlist)
        tmp_path = tmp.name

    raw_output_path = tmp_path + ".raw"
    
    try:
        # Use batch mode (-b)
        # We use -n to avoid reading .spiceinit which might have conflicting settings
        process = subprocess.Popen(
            ['ngspice', '-b', '-n', '-r', raw_output_path, tmp_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(timeout=30)

        plot_data = []
        if os.path.exists(raw_output_path):
            plot_data = parse_raw_file(raw_output_path)

        return jsonify({
            "stdout": stdout or "No stdout captured.",
            "stderr": stderr or "No stderr captured.",
            "success": True, # We treat it as success if we got output, App.tsx handles the rest
            "plotData": plot_data
        })

    except subprocess.TimeoutExpired:
        process.kill()
        return jsonify({"error": "Simulation timed out"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        if os.path.exists(raw_output_path):
            try:
                os.remove(raw_output_path)
            except:
                pass

if __name__ == '__main__':
    app.run(port=5000)
