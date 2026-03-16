import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

interface SchematicViewerProps {
  netlist: string;
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  type: 'circuit-node' | 'component';
  label: string;
  compType?: string;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string;
  target: string;
  label: string;
}

export const SchematicViewer: React.FC<SchematicViewerProps> = ({ netlist }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const graphData = useMemo(() => {
    const nodes: Node[] = [];
    const links: Link[] = [];
    const nodeSet = new Set<string>();
    const componentNodes: Node[] = [];

    const lines = netlist.split('\n');
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('.')) return;

      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) return;

      const name = parts[0];
      const type = name[0].toUpperCase();

      // Basic components: Name Node1 Node2 ...
      if ('RCLVIDQM'.includes(type)) {
        const n1 = parts[1];
        const n2 = parts[2];
        
        if (n1 && n2) {
          const compId = `comp-${idx}-${name}`;
          componentNodes.push({ id: compId, type: 'component', label: name, compType: type });
          
          [n1, n2].forEach(n => {
            if (!nodeSet.has(n)) {
              nodes.push({ id: n, type: 'circuit-node', label: n });
              nodeSet.add(n);
            }
          });

          links.push({ source: n1, target: compId, label: '' });
          links.push({ source: compId, target: n2, label: '' });
        }
      } else if (type === 'X') {
        // Subcircuits
        const compId = `comp-${idx}-${name}`;
        componentNodes.push({ id: compId, type: 'component', label: name, compType: 'X' });
        
        // Nodes are between name and subcircuit name (last part)
        for (let i = 1; i < parts.length - 1; i++) {
          const n = parts[i];
          if (!nodeSet.has(n)) {
            nodes.push({ id: n, type: 'circuit-node', label: n });
            nodeSet.add(n);
          }
          links.push({ source: n, target: compId, label: '' });
        }
      }
    });

    return { nodes: [...nodes, ...componentNodes], links };
  }, [netlist]);

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const simulation = d3.forceSimulation<Node>(graphData.nodes)
      .force('link', d3.forceLink<Node, Link>(graphData.links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60))
      .velocityDecay(0.4); // Slower movement, feels more "heavy"

    const g = svg.append('g');

    // Grid background
    const gridSize = 20;
    const grid = g.append('g').attr('class', 'grid');
    
    const gridRange = 3000;
    for (let x = -gridRange; x <= gridRange; x += gridSize) {
      grid.append('line')
        .attr('x1', x).attr('y1', -gridRange)
        .attr('x2', x).attr('y2', gridRange)
        .attr('stroke', '#ffffff08')
        .attr('stroke-width', 0.5);
    }
    for (let y = -gridRange; y <= gridRange; y += gridSize) {
      grid.append('line')
        .attr('x1', -gridRange).attr('y1', y)
        .attr('x2', gridRange).attr('y2', y)
        .attr('stroke', '#ffffff08')
        .attr('stroke-width', 0.5);
    }

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Orthogonal path generator
    const generateOrthogonalPath = (s: any, t: any) => {
      if (!s || !t) return '';
      const midX = (s.x + t.x) / 2;
      // Simple L-shape or Z-shape routing
      // We try to keep wires horizontal/vertical
      if (Math.abs(s.x - t.x) > Math.abs(s.y - t.y)) {
        // More horizontal distance: Z-shape (H-V-H)
        return `M ${s.x} ${s.y} L ${midX} ${s.y} L ${midX} ${t.y} L ${t.x} ${t.y}`;
      } else {
        // More vertical distance: Z-shape (V-H-V)
        const midY = (s.y + t.y) / 2;
        return `M ${s.x} ${s.y} L ${s.x} ${midY} L ${t.x} ${midY} L ${t.x} ${t.y}`;
      }
    };

    const link = g.append('g')
      .selectAll('path')
      .data(graphData.links)
      .join('path')
      .attr('stroke', '#4ade80') // Technical green for wires
      .attr('stroke-width', 1.5)
      .attr('fill', 'none')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round');

    const node = g.append('g')
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .style('cursor', 'crosshair')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Draw nodes
    node.each(function(d: Node) {
      const el = d3.select(this);
      if (d.type === 'component') {
        const type = d.compType;
        const color = '#60a5fa';
        
        // Component body background (solid to hide grid)
        el.append('rect')
          .attr('width', 44)
          .attr('height', 44)
          .attr('x', -22)
          .attr('y', -22)
          .attr('fill', '#151619');

        if (type === 'R') {
          el.append('path')
            .attr('d', 'M -20 0 L -15 0 L -12.5 -6 L -7.5 6 L -2.5 -6 L 2.5 6 L 7.5 -6 L 12.5 6 L 15 0 L 20 0')
            .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2);
        } else if (type === 'C') {
          el.append('line').attr('x1', -20).attr('y1', 0).attr('x2', -4).attr('y2', 0).attr('stroke', color).attr('stroke-width', 2);
          el.append('line').attr('x1', 20).attr('y1', 0).attr('x2', 4).attr('y2', 0).attr('stroke', color).attr('stroke-width', 2);
          el.append('line').attr('x1', -4).attr('y1', -12).attr('x2', -4).attr('y2', 12).attr('stroke', color).attr('stroke-width', 2);
          el.append('line').attr('x1', 4).attr('y1', -12).attr('x2', 4).attr('y2', 12).attr('stroke', color).attr('stroke-width', 2);
        } else if (type === 'L') {
          el.append('path')
            .attr('d', 'M -20 0 L -15 0 C -15 -12, -5 -12, -5 0 C -5 -12, 5 -12, 5 0 C 5 -12, 15 -12, 15 0 L 20 0')
            .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2);
        } else if (type === 'V' || type === 'I') {
          el.append('circle').attr('r', 15).attr('fill', '#151619').attr('stroke', color).attr('stroke-width', 2);
          el.append('line').attr('x1', -25).attr('y1', 0).attr('x2', -15).attr('y2', 0).attr('stroke', color).attr('stroke-width', 2);
          el.append('line').attr('x1', 25).attr('y1', 0).attr('x2', 15).attr('y2', 0).attr('stroke', color).attr('stroke-width', 2);
          if (type === 'V') {
            el.append('text').attr('x', -8).attr('y', 4).attr('fill', color).attr('font-size', '12px').attr('font-weight', 'bold').text('+');
            el.append('text').attr('x', 2).attr('y', 4).attr('fill', color).attr('font-size', '12px').attr('font-weight', 'bold').text('-');
          } else {
            el.append('path').attr('d', 'M -7 0 L 7 0 M 3 -4 L 7 0 L 3 4').attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2);
          }
        } else if (type === 'Q') {
          el.append('line').attr('x1', -5).attr('y1', -12).attr('x2', -5).attr('y2', 12).attr('stroke', color).attr('stroke-width', 2.5);
          el.append('line').attr('x1', -20).attr('y1', 0).attr('x2', -5).attr('y2', 0).attr('stroke', color).attr('stroke-width', 2);
          el.append('line').attr('x1', -5).attr('y1', -6).attr('x2', 12).attr('y2', -15).attr('stroke', color).attr('stroke-width', 2);
          el.append('line').attr('x1', -5).attr('y1', 6).attr('x2', 12).attr('y2', 15).attr('stroke', color).attr('stroke-width', 2);
          el.append('circle').attr('r', 18).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1).attr('opacity', 0.3);
        } else if (type === 'D') {
          el.append('path').attr('d', 'M -8 -10 L -8 10 L 8 0 Z').attr('fill', color);
          el.append('line').attr('x1', 8).attr('y1', -10).attr('x2', 8).attr('y2', 10).attr('stroke', color).attr('stroke-width', 2);
          el.append('line').attr('x1', -20).attr('y1', 0).attr('x2', 20).attr('y2', 0).attr('stroke', color).attr('stroke-width', 2);
        } else {
          el.append('rect').attr('width', 36).attr('height', 24).attr('x', -18).attr('y', -12).attr('rx', 2).attr('fill', '#151619').attr('stroke', color).attr('stroke-width', 2);
        }
        
        el.append('text')
          .attr('dy', 32)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('fill', '#93c5fd')
          .attr('font-weight', '600')
          .text(d.label);
      } else {
        // Draw circuit node as a small connection dot
        el.append('circle')
          .attr('r', 4)
          .attr('fill', d.id === '0' ? '#10b981' : '#4ade80')
          .attr('stroke', '#151619')
          .attr('stroke-width', 1);
        
        if (d.id === '0') {
          const gnd = el.append('g').attr('transform', 'translate(0, 4)');
          gnd.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 8).attr('stroke', '#10b981').attr('stroke-width', 2);
          gnd.append('line').attr('x1', -10).attr('y1', 8).attr('x2', 10).attr('y2', 8).attr('stroke', '#10b981').attr('stroke-width', 2);
          gnd.append('line').attr('x1', -6).attr('y1', 12).attr('x2', 6).attr('y2', 12).attr('stroke', '#10b981').attr('stroke-width', 1.5);
          gnd.append('line').attr('x1', -2).attr('y1', 16).attr('x2', 2).attr('y2', 16).attr('stroke', '#10b981').attr('stroke-width', 1);
        } else {
          el.append('text')
            .attr('dy', -12)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#4ade80')
            .attr('font-weight', '500')
            .text(d.label);
        }
      }
    });

    simulation.on('tick', () => {
      link.attr('d', (d: any) => generateOrthogonalPath(d.source, d.target));
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.1).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      // Snap to grid during drag
      event.subject.fx = Math.round(event.x / gridSize) * gridSize;
      event.subject.fy = Math.round(event.y / gridSize) * gridSize;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      // Keep fixed position after drag
      event.subject.fx = Math.round(event.subject.x / gridSize) * gridSize;
      event.subject.fy = Math.round(event.subject.y / gridSize) * gridSize;
    }

    return () => {
      simulation.stop();
    };
  }, [graphData]);

  return (
    <div className="h-full w-full bg-[#1e1e1e] border border-white/10 rounded-lg overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
          <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Circuit Node</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#10b981]" />
          <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Ground (0)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#3b82f6]" />
          <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Component</span>
        </div>
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-move" />
    </div>
  );
};
