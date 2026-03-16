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

    res.json({
      stdout: mockOutput,
      stderr: "",
      success: true,
      plotData: mockPlotData
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
