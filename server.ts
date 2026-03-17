import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock API for the preview environment
  app.get("/api/mock/status", (req, res) => {
    res.json({ status: "online", message: "Mock bridge active for preview" });
  });

  app.post("/api/mock/simulate", (req, res) => {
    const { netlist } = req.body;
    
    // Simulate some ngspice output for the preview
    const mockOutput = `
Circuit: * Mock Simulation
Doing analysis at TEMP = 27.000000 and TNOM = 27.000000
Initial Transient Solution
--------------------------
Node                                   Voltage
----                                   -------
v(1)                                         5
v(2)                                   2.50000
source                                 0.00000

No. of Data Columns : 3
Total analysis time: 0.001s
Simulation complete.
    `;

    // Generate some mock plot data
    const mockPlotData = Array.from({ length: 20 }, (_, i) => ({
      time: i * 0.1,
      v1: 5 * Math.sin(i * 0.5) + 5,
      v2: 2.5 * Math.sin(i * 0.5) + 2.5
    }));

    // Check if hardcopy is used in netlist
    let svgData = null;
    if (netlist.toLowerCase().includes("hardcopy")) {
      svgData = `
        <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#1a1b1e"/>
          <path d="M 0 100 Q 100 0 200 100 T 400 100" stroke="#3b82f6" fill="transparent" stroke-width="2"/>
          <path d="M 0 100 Q 100 50 200 100 T 400 100" stroke="#10b981" fill="transparent" stroke-width="2"/>
          <text x="10" y="20" fill="white" font-size="12">Mock Native ngspice Plot (SVG)</text>
          <line x1="0" y1="100" x2="400" y2="100" stroke="white" stroke-opacity="0.2"/>
        </svg>
      `;
    }

    res.json({
      stdout: mockOutput,
      stderr: "",
      success: true,
      plotData: mockPlotData,
      svgData: svgData
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
