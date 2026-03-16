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

@app.route('/debug', methods=['GET'])
def debug():
    """Checks if ngspice is available in the system path."""
    try:
        process = subprocess.Popen(['ngspice', '-v'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate(timeout=5)
        return jsonify({
            "ngspice_found": True,
            "version_info": stdout or stderr,
            "path": subprocess.check_output(['which', 'ngspice']).decode().strip() if os.name != 'nt' else "Windows path"
        })
    except Exception as e:
        return jsonify({
            "ngspice_found": False,
            "error": str(e)
        })

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

    # Use a fixed filename in the temp directory to avoid permission issues
    tmp_dir = tempfile.gettempdir()
    tmp_path = os.path.join(tmp_dir, f"sim_{os.getpid()}.cir")
    raw_output_path = tmp_path + ".raw"
    log_output_path = tmp_path + ".log"

    try:
        with open(tmp_path, 'w') as f:
            f.write(netlist)
            f.flush()
            os.fsync(f.fileno())

        # Use batch mode (-b)
        # -n: don't read .spiceinit
        # -r: raw output file
        # -o: output log file (often more reliable than pipe capture in batch mode)
        cmd = ['ngspice', '-b', '-n', '-r', raw_output_path, '-o', log_output_path, tmp_path]
        
        print(f"Running command: {' '.join(cmd)}")
        
        # We still capture stdout/stderr just in case, but rely on the log file
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, # Merge stderr into stdout
            text=True
        )
        stdout_capture, _ = process.communicate(timeout=30)

        # Read the log file which contains the actual simulation output and print results
        log_content = ""
        if os.path.exists(log_output_path):
            with open(log_output_path, 'r') as f:
                log_content = f.read()
        
        # Combine captured stdout and log content
        final_output = log_content if log_content else stdout_capture

        print(f"Output length: {len(final_output)}")

        plot_data = []
        if os.path.exists(raw_output_path):
            plot_data = parse_raw_file(raw_output_path)
            print(f"Parsed {len(plot_data)} data points.")

        return jsonify({
            "stdout": final_output or "No output captured from ngspice.",
            "stderr": "", # Merged into stdout
            "success": True,
            "plotData": plot_data,
            "debug": {
                "command": ' '.join(cmd),
                "return_code": process.returncode,
                "log_exists": os.path.exists(log_output_path)
            }
        })

    except subprocess.TimeoutExpired:
        if 'process' in locals(): process.kill()
        return jsonify({"error": "Simulation timed out"}), 500
    except Exception as e:
        print(f"Simulation error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        for p in [tmp_path, raw_output_path, log_output_path]:
            if os.path.exists(p):
                try: os.remove(p)
                except: pass

if __name__ == '__main__':
    app.run(port=5000)
