import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

interface SchematicViewerProps {
  netlist: string;
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  type: 'circuit-node' | 'component';
  label: string;
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
          componentNodes.push({ id: compId, type: 'component', label: name });
          
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
        componentNodes.push({ id: compId, type: 'component', label: name });
        
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
      .force('link', d3.forceLink<Node, Link>(graphData.links).id(d => d.id).distance(50))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const link = g.append('g')
      .attr('stroke', '#4b5563')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke-width', 2);

    const node = g.append('g')
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Draw nodes
    node.each(function(d: Node) {
      const el = d3.select(this);
      if (d.type === 'component') {
        // Draw component as a box
        el.append('rect')
          .attr('width', 40)
          .attr('height', 20)
          .attr('x', -20)
          .attr('y', -10)
          .attr('rx', 4)
          .attr('fill', '#3b82f6')
          .attr('stroke', '#2563eb')
          .attr('stroke-width', 1);
        
        el.append('text')
          .attr('dy', 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('fill', 'white')
          .attr('font-weight', 'bold')
          .text(d.label);
      } else {
        // Draw circuit node as a circle
        el.append('circle')
          .attr('r', 6)
          .attr('fill', d.id === '0' ? '#10b981' : '#f59e0b')
          .attr('stroke', 'white')
          .attr('stroke-width', 1);
        
        el.append('text')
          .attr('dy', -10)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('fill', '#9ca3af')
          .text(d.id === '0' ? 'GND' : d.label);
      }
    });

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
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
