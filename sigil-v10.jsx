import React, { useState } from 'react';

// Heat map configuration
const HEAT_CONFIG = {
  gridSize: 6,        // 6x6 grid (~33px cells for 200px canvas)
  cellThreshold: 2,   // 2+ intersections = warm cell
  zoneThreshold: 2,   // severity sum to trigger alternatives (lowered for more sensitivity)
};

// Layout modes
const LayoutMode = {
  STANDARD: 'standard',
  VENN: 'venn',
  EXTRA_RINGS: 'extra_rings',
  SATELLITE: 'satellite',
};

// Grid-based heat map analysis
const analyzeHeatMap = (intersections, size, gridSize = HEAT_CONFIG.gridSize) => {
  const cellSize = size / gridSize;
  const cells = [];

  // Initialize grid
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      cells.push({
        x: x * cellSize,
        y: y * cellSize,
        gridX: x,
        gridY: y,
        count: 0,
        intersections: []
      });
    }
  }

  // Count intersections per cell
  for (const int of intersections) {
    const gridX = Math.min(gridSize - 1, Math.floor(int.x / cellSize));
    const gridY = Math.min(gridSize - 1, Math.floor(int.y / cellSize));
    const cellIdx = gridY * gridSize + gridX;
    cells[cellIdx].count++;
    cells[cellIdx].intersections.push(int);
  }

  // Find warm cells (count >= threshold)
  const warmCells = cells.filter(c => c.count >= HEAT_CONFIG.cellThreshold);

  // Flood-fill to find connected hot zones
  const visited = new Set();
  const zones = [];

  const getNeighbors = (cell) => {
    const neighbors = [];
    const { gridX, gridY } = cell;
    for (const [dx, dy] of [[-1,0], [1,0], [0,-1], [0,1], [-1,-1], [1,-1], [-1,1], [1,1]]) {
      const nx = gridX + dx;
      const ny = gridY + dy;
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
        const neighbor = warmCells.find(c => c.gridX === nx && c.gridY === ny);
        if (neighbor) neighbors.push(neighbor);
      }
    }
    return neighbors;
  };

  for (const cell of warmCells) {
    const key = `${cell.gridX},${cell.gridY}`;
    if (visited.has(key)) continue;

    // BFS flood-fill
    const zone = [];
    const queue = [cell];

    while (queue.length > 0) {
      const curr = queue.shift();
      const currKey = `${curr.gridX},${curr.gridY}`;
      if (visited.has(currKey)) continue;
      visited.add(currKey);
      zone.push(curr);

      for (const neighbor of getNeighbors(curr)) {
        const nKey = `${neighbor.gridX},${neighbor.gridY}`;
        if (!visited.has(nKey)) queue.push(neighbor);
      }
    }

    if (zone.length > 0) {
      // Calculate zone center and severity
      const totalCount = zone.reduce((sum, c) => sum + c.count, 0);
      const centerX = zone.reduce((sum, c) => sum + (c.x + cellSize/2) * c.count, 0) / totalCount;
      const centerY = zone.reduce((sum, c) => sum + (c.y + cellSize/2) * c.count, 0) / totalCount;
      const radius = Math.max(...zone.map(c =>
        Math.hypot(c.x + cellSize/2 - centerX, c.y + cellSize/2 - centerY)
      )) + cellSize;

      zones.push({
        centerX,
        centerY,
        radius,
        severity: totalCount,
        cells: zone
      });
    }
  }

  const globalScore = zones.reduce((sum, z) => sum + z.severity, 0);
  const isHot = globalScore >= HEAT_CONFIG.zoneThreshold;

  return { isHot, globalScore, zones, cells, cellSize };
};

const processText = (text) => {
  const words = text.toLowerCase().split(/\s+/);
  const noVowels = words.map(w => w.replace(/[aeiou]/g, ''));
  const allChars = noVowels.join('');
  const unique = [...new Set(allChars.split(''))].filter(c => c.match(/[a-z]/));
  const numbers = unique.map(c => c.charCodeAt(0) - 96);
  return { words, noVowels, unique, numbers };
};

const isAdjacentOnRing = (p1, p2, pointsPerRing) => {
  if (p1.ringIndex !== p2.ringIndex) return false;
  // Prevent arcs across different groups (venn/satellite layouts)
  if (p1.group && p2.group && p1.group !== p2.group) return false;
  const diff = Math.abs(p1.positionInRing - p2.positionInRing);
  const max = Math.min(pointsPerRing, p1.ringTotal);
  return diff === 1 || diff === max - 1;
};

const seededRandom = (seed) => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

// Interior angle at vertex (0-180, where 0 = hairpin, 180 = straight)
const calculateVertexAngle = (prev, curr, next) => {
  const v1x = prev.x - curr.x;
  const v1y = prev.y - curr.y;
  const v2x = next.x - curr.x;
  const v2y = next.y - curr.y;
  
  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);
  
  if (len1 === 0 || len2 === 0) return 180;
  
  const dot = (v1x / len1) * (v2x / len2) + (v1y / len1) * (v2y / len2);
  const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
  return angleRad * (180 / Math.PI);
};

// 0 = parallel, 90 = perpendicular
const calculateCrossingAngle = (line1From, line1To, line2From, line2To) => {
  const d1x = line1To.x - line1From.x;
  const d1y = line1To.y - line1From.y;
  const d2x = line2To.x - line2From.x;
  const d2y = line2To.y - line2From.y;
  
  const len1 = Math.hypot(d1x, d1y);
  const len2 = Math.hypot(d2x, d2y);
  
  if (len1 === 0 || len2 === 0) return 45;
  
  const dot = Math.abs((d1x / len1) * (d2x / len2) + (d1y / len1) * (d2y / len2));
  const angleRad = Math.acos(Math.min(1, dot));
  return angleRad * (180 / Math.PI);
};

const lineLineIntersection = (p1, p2, p3, p4) => {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.001) return null;
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  if (t > 0.08 && t < 0.92 && u > 0.08 && u < 0.92) {
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1), t };
  }
  return null;
};

const lineArcIntersection = (lineFrom, lineTo, arcFrom, arcTo, cx, cy, radius) => {
  const steps = 24;
  const angle1 = Math.atan2(arcFrom.y - cy, arcFrom.x - cx);
  let angle2 = Math.atan2(arcTo.y - cy, arcTo.x - cx);
  
  let angleDiff = angle2 - angle1;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  for (let i = 0; i < steps; i++) {
    const t1 = i / steps;
    const t2 = (i + 1) / steps;
    const a1 = angle1 + angleDiff * t1;
    const a2 = angle1 + angleDiff * t2;
    
    const p1 = { x: cx + Math.cos(a1) * radius, y: cy + Math.sin(a1) * radius };
    const p2 = { x: cx + Math.cos(a2) * radius, y: cy + Math.sin(a2) * radius };
    
    const int = lineLineIntersection(lineFrom, lineTo, p1, p2);
    if (int) return { x: int.x, y: int.y };
  }
  return null;
};

const getArcPoint = (arcFrom, arcTo, cx, cy, radius, t) => {
  const angle1 = Math.atan2(arcFrom.y - cy, arcFrom.x - cx);
  let angle2 = Math.atan2(arcTo.y - cy, arcTo.x - cx);
  
  let angleDiff = angle2 - angle1;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  const angle = angle1 + angleDiff * t;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
};

// Arc length
const getArcLength = (arcFrom, arcTo, cx, cy, radius) => {
  const angle1 = Math.atan2(arcFrom.y - cy, arcFrom.x - cx);
  const angle2 = Math.atan2(arcTo.y - cy, arcTo.x - cx);
  
  let angleDiff = Math.abs(angle2 - angle1);
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
  
  return angleDiff * radius;
};

const arcPathD = (p1, p2, cx, cy, radius) => {
  const angle1 = Math.atan2(p1.y - cy, p1.x - cx);
  const angle2 = Math.atan2(p2.y - cy, p2.x - cx);
  let angleDiff = angle2 - angle1;
  
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  const sweep = angleDiff > 0 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 0 ${sweep} ${p2.x} ${p2.y}`;
};

// Check bar collision - returns distance to nearest collision, or Infinity if none
const getBarCollisionDistance = (endPoint, perpAngle, barLen, pathData, cx, cy, lastPathIndex) => {
  const bar1 = { x: endPoint.x + Math.cos(perpAngle) * barLen, y: endPoint.y + Math.sin(perpAngle) * barLen };
  const bar2 = { x: endPoint.x - Math.cos(perpAngle) * barLen, y: endPoint.y - Math.sin(perpAngle) * barLen };
  
  let minDist = Infinity;
  
  for (let i = 0; i < pathData.length; i++) {
    const p = pathData[i];
    if (i === lastPathIndex) continue;
    
    if (p.type === 'line') {
      const int = lineLineIntersection(bar1, bar2, p.from, p.to);
      if (int) {
        const dist = Math.hypot(int.x - endPoint.x, int.y - endPoint.y);
        minDist = Math.min(minDist, dist);
      }
      
      // Also check proximity to endpoints
      const distToFrom = Math.hypot(
        (bar1.x + bar2.x) / 2 - p.from.x,
        (bar1.y + bar2.y) / 2 - p.from.y
      );
      const distToTo = Math.hypot(
        (bar1.x + bar2.x) / 2 - p.to.x,
        (bar1.y + bar2.y) / 2 - p.to.y
      );
      
      // Check if bar endpoints are very close to line
      for (const barEnd of [bar1, bar2]) {
        const closestOnLine = closestPointOnSegment(barEnd, p.from, p.to);
        const d = Math.hypot(barEnd.x - closestOnLine.x, barEnd.y - closestOnLine.y);
        if (d < 4) minDist = Math.min(minDist, d);
      }
    } else if (p.type === 'arc') {
      const arcCx = p.from.circleCx ?? cx;
      const arcCy = p.from.circleCy ?? cy;
      const int = lineArcIntersection(bar1, bar2, p.from, p.to, arcCx, arcCy, p.radius);
      if (int) {
        const dist = Math.hypot(int.x - endPoint.x, int.y - endPoint.y);
        minDist = Math.min(minDist, dist);
      }
    }
  }

  return minDist;
};

const closestPointOnSegment = (pt, segA, segB) => {
  const dx = segB.x - segA.x;
  const dy = segB.y - segA.y;
  const lenSq = dx * dx + dy * dy;
  
  if (lenSq === 0) return segA;
  
  let t = ((pt.x - segA.x) * dx + (pt.y - segA.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  return { x: segA.x + t * dx, y: segA.y + t * dy };
};

// Standard layout: concentric rings
const generateStandardLayout = (unique, numbers, size, pointsPerRing, cx, cy) => {
  const n = unique.length;
  const numRings = Math.ceil(n / pointsPerRing);
  const maxRadius = size * 0.42;
  const minRadius = maxRadius / (1 + (numRings - 1) / 2);
  const ringGap = minRadius / 2;

  const rings = [];
  for (let i = 0; i < numRings; i++) {
    rings.push(maxRadius - i * ringGap);
  }

  const points = unique.map((letter, i) => {
    const ringIndex = Math.floor(i / pointsPerRing);
    const positionInRing = i % pointsPerRing;
    const radius = rings[ringIndex];

    const startOfRing = ringIndex * pointsPerRing;
    const endOfRing = Math.min(startOfRing + pointsPerRing, n);
    const ringTotal = endOfRing - startOfRing;

    const angle = (positionInRing / ringTotal) * Math.PI * 2 - Math.PI / 2;

    return {
      letter, number: numbers[i], index: i, ringIndex, positionInRing, ringTotal, radius,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      angle,
      group: 'main'
    };
  });

  return { points, rings, maxRadius };
};

// Venn layout: two overlapping offset circles
const generateVennLayout = (unique, numbers, size, pointsPerRing, cx, cy) => {
  const n = unique.length;
  const margin = size * 0.05;
  const availableWidth = size - 2 * margin;
  // Two circles with ~60% overlap: total width = 2*radius + offset = 2*radius + 0.4*radius = 2.4*radius
  const maxRadius = availableWidth / 2.4;
  const offset = maxRadius * 0.4; // 60% overlap

  // Split points between left and right circles
  const leftCount = Math.ceil(n / 2);
  const rightCount = n - leftCount;

  const leftCx = cx - offset / 2;
  const rightCx = cx + offset / 2;

  const rings = [maxRadius]; // Single ring per circle
  const points = [];

  // Left circle points
  for (let i = 0; i < leftCount; i++) {
    const angle = (i / leftCount) * Math.PI * 2 - Math.PI / 2;
    points.push({
      letter: unique[i],
      number: numbers[i],
      index: i,
      ringIndex: 0,
      positionInRing: i,
      ringTotal: leftCount,
      radius: maxRadius,
      x: leftCx + Math.cos(angle) * maxRadius,
      y: cy + Math.sin(angle) * maxRadius,
      angle,
      group: 'left',
      circleCx: leftCx,
      circleCy: cy
    });
  }

  // Right circle points
  for (let i = 0; i < rightCount; i++) {
    const globalIdx = leftCount + i;
    const angle = (i / rightCount) * Math.PI * 2 - Math.PI / 2;
    points.push({
      letter: unique[globalIdx],
      number: numbers[globalIdx],
      index: globalIdx,
      ringIndex: 0,
      positionInRing: i,
      ringTotal: rightCount,
      radius: maxRadius,
      x: rightCx + Math.cos(angle) * maxRadius,
      y: cy + Math.sin(angle) * maxRadius,
      angle,
      group: 'right',
      circleCx: rightCx,
      circleCy: cy
    });
  }

  return { points, rings, maxRadius, leftCx, rightCx, cy: cy };
};

// Extra rings layout: more rings with fewer points each
const generateExtraRingsLayout = (unique, numbers, size, pointsPerRing, cx, cy) => {
  // Reduce points per ring to ~60% to create more rings
  const reducedPointsPerRing = Math.max(3, Math.floor(pointsPerRing * 0.6));
  return generateStandardLayout(unique, numbers, size, reducedPointsPerRing, cx, cy);
};

// Satellite layout: main ring + connected smaller ring
const generateSatelliteLayout = (unique, numbers, size, pointsPerRing, cx, cy) => {
  const n = unique.length;
  const mainCount = Math.ceil(n * 0.7); // 70% on main ring
  const satCount = n - mainCount; // 30% on satellite

  // Calculate sizes to fit within canvas
  const margin = size * 0.05;
  const gap = size * 0.03;
  // Total width: mainRadius + mainRadius + gap + satRadius + satRadius = 2*main + gap + 2*sat
  // With sat = 0.5 * main: 2*main + gap + main = 3*main + gap
  // Available = size - 2*margin, so main = (available - gap) / 3
  const availableWidth = size - 2 * margin;
  const mainRadius = (availableWidth - gap) / 3;
  const satRadius = mainRadius * 0.5;
  const satOffset = mainRadius + gap + satRadius;

  // Sort by value to determine which go to satellite (highest values)
  const sorted = unique.map((letter, i) => ({ letter, number: numbers[i], origIndex: i }))
    .sort((a, b) => a.number - b.number);

  const mainLetters = sorted.slice(0, mainCount);
  const satLetters = sorted.slice(mainCount);

  const rings = [mainRadius, satRadius];
  const points = [];

  // Shift main ring left so the whole composition is centered
  const mainCx = cx - (gap / 2 + satRadius);

  // Main ring points (restore original order for placement)
  const mainByOrig = mainLetters.sort((a, b) => a.origIndex - b.origIndex);
  for (let i = 0; i < mainByOrig.length; i++) {
    const { letter, number, origIndex } = mainByOrig[i];
    const angle = (i / mainByOrig.length) * Math.PI * 2 - Math.PI / 2;
    points.push({
      letter, number, index: origIndex,
      ringIndex: 0,
      positionInRing: i,
      ringTotal: mainByOrig.length,
      radius: mainRadius,
      x: mainCx + Math.cos(angle) * mainRadius,
      y: cy + Math.sin(angle) * mainRadius,
      angle,
      group: 'main',
      circleCx: mainCx,
      circleCy: cy
    });
  }

  // Satellite ring points (highest letter values)
  const satCx = mainCx + satOffset;
  const satByOrig = satLetters.sort((a, b) => a.origIndex - b.origIndex);
  for (let i = 0; i < satByOrig.length; i++) {
    const { letter, number, origIndex } = satByOrig[i];
    const angle = (i / satByOrig.length) * Math.PI * 2 - Math.PI / 2;
    points.push({
      letter, number, index: origIndex,
      ringIndex: 1,
      positionInRing: i,
      ringTotal: satByOrig.length,
      radius: satRadius,
      x: satCx + Math.cos(angle) * satRadius,
      y: cy + Math.sin(angle) * satRadius,
      angle,
      group: 'satellite',
      circleCx: satCx,
      circleCy: cy
    });
  }

  return {
    points,
    rings,
    maxRadius: mainRadius,
    mainCx,
    satCx,
    satCy: cy,
    satRadius,
    mainRadius,
    hasConnector: satCount > 0
  };
};

// Generate points based on layout mode
const generatePoints = (unique, numbers, size, pointsPerRing, layoutMode, cx, cy) => {
  switch (layoutMode) {
    case LayoutMode.VENN:
      return generateVennLayout(unique, numbers, size, pointsPerRing, cx, cy);
    case LayoutMode.EXTRA_RINGS:
      return generateExtraRingsLayout(unique, numbers, size, pointsPerRing, cx, cy);
    case LayoutMode.SATELLITE:
      return generateSatelliteLayout(unique, numbers, size, pointsPerRing, cx, cy);
    default:
      return generateStandardLayout(unique, numbers, size, pointsPerRing, cx, cy);
  }
};

const generateSigil = (unique, numbers, size = 200, pointsPerRing = 6, layoutMode = LayoutMode.STANDARD) => {
  const cx = size / 2;
  const cy = size / 2;
  const n = unique.length;

  if (n < 2) return { paths: [], markers: [], intersections: [], acuteVertices: [], arcDots: [], cx, cy, rings: [], maxRadius: 0, layoutMode };

  const layout = generatePoints(unique, numbers, size, pointsPerRing, layoutMode, cx, cy);
  const { points, rings, maxRadius } = layout;
  
  const sortedByValue = [...points].sort((a, b) => a.number - b.number);
  
  // Acute vertices: angle < 30° or > 330° - only 50% get dots
  const allAcuteVertices = [];
  for (let i = 1; i < sortedByValue.length - 1; i++) {
    const prev = sortedByValue[i - 1];
    const curr = sortedByValue[i];
    const next = sortedByValue[i + 1];
    
    const vertexAngle = calculateVertexAngle(prev, curr, next);
    // Check if either interior or exterior angle is acute (< 30°)
    // Interior < 30° = sharp point, Interior > 150° = exterior < 30° (nearly straight)
    if (vertexAngle < 30 || vertexAngle > 150) {
      allAcuteVertices.push({ x: curr.x, y: curr.y, angle: vertexAngle, index: i });
    }
  }
  
  // Only 50% get dots
  const seed = unique.reduce((s, c) => s + c.charCodeAt(0), 0);
  const acuteVertices = allAcuteVertices.filter((_, idx) => seededRandom(seed + idx * 17) > 0.5);
  
  // Build path data
  const pathData = [];
  for (let i = 0; i < sortedByValue.length - 1; i++) {
    const from = sortedByValue[i];
    const to = sortedByValue[i + 1];
    const adjacent = isAdjacentOnRing(from, to, pointsPerRing);
    
    pathData.push({
      type: adjacent ? 'arc' : 'line',
      from, to,
      radius: adjacent ? from.radius : null,
      index: i
    });
  }
  
  // Find ALL intersections
  const allIntersections = [];
  
  for (let i = 0; i < pathData.length; i++) {
    for (let j = i + 1; j < pathData.length; j++) {
      const p1 = pathData[i];
      const p2 = pathData[j];
      
      let int = null;
      let crossingAngle = 45;
      
      if (p1.type === 'line' && p2.type === 'line') {
        int = lineLineIntersection(p1.from, p1.to, p2.from, p2.to);
        if (int) {
          crossingAngle = calculateCrossingAngle(p1.from, p1.to, p2.from, p2.to);
        }
      } else if (p1.type === 'line' && p2.type === 'arc') {
        const arcCx = p2.from.circleCx ?? cx;
        const arcCy = p2.from.circleCy ?? cy;
        int = lineArcIntersection(p1.from, p1.to, p2.from, p2.to, arcCx, arcCy, p2.radius);
        if (int) crossingAngle = 50;
      } else if (p1.type === 'arc' && p2.type === 'line') {
        const arcCx = p1.from.circleCx ?? cx;
        const arcCy = p1.from.circleCy ?? cy;
        int = lineArcIntersection(p2.from, p2.to, p1.from, p1.to, arcCx, arcCy, p1.radius);
        if (int) crossingAngle = 50;
      }
      
      if (int) {
        allIntersections.push({ 
          ...int, 
          pathIndices: [i, j],
          crossingAngle
        });
      }
    }
  }
  
  // Consolidate nearby intersections
  const consolidateRadius = 12;
  const intersections = [];
  const used = new Set();
  
  for (let i = 0; i < allIntersections.length; i++) {
    if (used.has(i)) continue;
    
    let sumX = allIntersections[i].x, sumY = allIntersections[i].y;
    const pathSet = new Set(allIntersections[i].pathIndices);
    let angles = [allIntersections[i].crossingAngle];
    let count = 1;
    
    for (let j = i + 1; j < allIntersections.length; j++) {
      if (used.has(j)) continue;
      const dist = Math.hypot(allIntersections[i].x - allIntersections[j].x, allIntersections[i].y - allIntersections[j].y);
      if (dist < consolidateRadius) {
        sumX += allIntersections[j].x;
        sumY += allIntersections[j].y;
        count++;
        allIntersections[j].pathIndices.forEach(p => pathSet.add(p));
        angles.push(allIntersections[j].crossingAngle);
        used.add(j);
      }
    }
    used.add(i);
    
    const avgAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
    
    // If 2+ intersections consolidated, force circle (complex junction)
    const forceCircle = count >= 2;
    // Otherwise: < 45 = circle, >= 45 = line break
    const useCircle = forceCircle || avgAngle < 45;
    
    intersections.push({ 
      x: sumX / count, 
      y: sumY / count, 
      pathIndices: [...pathSet],
      crossingAngle: avgAngle,
      useCircle,
      consolidated: count
    });
  }
  
  // Build paths with line breaks
  const paths = [];
  const breakGap = 14;
  
  for (let pathIdx = 0; pathIdx < pathData.length; pathIdx++) {
    const p = pathData[pathIdx];
    
    // Get line-break intersections (not circles) for this path
    const lineBreakIntersections = intersections.filter(int => 
      !int.useCircle && int.pathIndices.includes(pathIdx)
    );
    
    // Alternate which path breaks
    const myBreaks = lineBreakIntersections.filter(int => {
      const globalIdx = intersections.indexOf(int);
      const amIFirst = int.pathIndices[0] === pathIdx;
      return amIFirst ? (globalIdx % 2 === 0) : (globalIdx % 2 === 1);
    });
    
    if (p.type === 'line') {
      const from = p.from;
      const to = p.to;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      
      if (len === 0) continue;
      
      const ux = dx / len, uy = dy / len;
      
      if (myBreaks.length === 0) {
        paths.push({ type: 'line', d: `M ${from.x} ${from.y} L ${to.x} ${to.y}` });
      } else {
        const breaksWithDist = myBreaks.map(b => ({
          ...b,
          dist: Math.hypot(b.x - from.x, b.y - from.y)
        })).sort((a, b) => a.dist - b.dist);
        
        let currentX = from.x, currentY = from.y;
        
        for (const brk of breaksWithDist) {
          const gapStartX = brk.x - ux * (breakGap / 2);
          const gapStartY = brk.y - uy * (breakGap / 2);
          
          const segLen = Math.hypot(gapStartX - currentX, gapStartY - currentY);
          if (segLen > 3) {
            paths.push({ type: 'line', d: `M ${currentX} ${currentY} L ${gapStartX} ${gapStartY}` });
          }
          
          currentX = brk.x + ux * (breakGap / 2);
          currentY = brk.y + uy * (breakGap / 2);
        }
        
        const finalLen = Math.hypot(to.x - currentX, to.y - currentY);
        if (finalLen > 3) {
          paths.push({ type: 'line', d: `M ${currentX} ${currentY} L ${to.x} ${to.y}` });
        }
      }
    } else {
      const arcCx = p.from.circleCx ?? cx;
      const arcCy = p.from.circleCy ?? cy;
      paths.push({ type: 'arc', d: arcPathD(p.from, p.to, arcCx, arcCy, p.radius), arcData: p });
    }
  }

  // Arc dots - compare to CIRCUMFERENCE
  const arcDots = [];

  for (let i = 0; i < pathData.length; i++) {
    const p = pathData[i];
    if (p.type !== 'arc') continue;

    const arcCx = p.from.circleCx ?? cx;
    const arcCy = p.from.circleCy ?? cy;
    const arcLength = getArcLength(p.from, p.to, arcCx, arcCy, p.radius);
    const circumference = 2 * Math.PI * p.radius;
    
    // Compare arc length to circumference fractions
    let numDots = 0;
    if (arcLength >= circumference / 2) numDots = 3;
    else if (arcLength >= circumference / 3) numDots = 2;
    else if (arcLength >= circumference / 4) numDots = 1;
    
    // Max 3 dots
    numDots = Math.min(numDots, 3);
    
    if (numDots > 0) {
      const arcSeed = p.from.number * 100 + p.to.number + i * 7;
      const dotsForThisArc = [];
      
      for (let d = 0; d < numDots; d++) {
        // Spread dots evenly with some randomness
        const baseT = (d + 0.5) / numDots;
        const jitter = (seededRandom(arcSeed + d * 73) - 0.5) * 0.15;
        const t = Math.max(0.1, Math.min(0.9, baseT + jitter));
        
        const pt = getArcPoint(p.from, p.to, arcCx, arcCy, p.radius, t);
        
        // Check for overlap with existing dots
        const overlaps = dotsForThisArc.some(existing => 
          Math.hypot(existing.x - pt.x, existing.y - pt.y) < 8
        );
        
        if (!overlaps) {
          dotsForThisArc.push(pt);
        }
      }
      
      arcDots.push(...dotsForThisArc);
    }
  }
  
  // Bar terminus - try many lengths to find clear space
  const lastPoint = sortedByValue[sortedByValue.length - 1];
  const secondLastPoint = sortedByValue[sortedByValue.length - 2];
  const incomingAngle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
  const perpAngle = incomingAngle + Math.PI / 2;
  const lastPathIndex = pathData.length - 1;
  
  // Try lengths from 3 to 20, pick the one with most clearance
  let bestLen = 8;
  let bestClearance = 0;
  
  for (let testLen = 3; testLen <= 20; testLen++) {
    const clearance = getBarCollisionDistance(lastPoint, perpAngle, testLen, pathData, cx, cy, lastPathIndex);
    if (clearance > testLen + 2) {
      // No collision and good clearance
      if (testLen >= 6 && testLen <= 10) {
        // Prefer medium lengths
        bestLen = testLen;
        bestClearance = clearance;
        break;
      } else if (clearance > bestClearance) {
        bestLen = testLen;
        bestClearance = clearance;
      }
    }
  }
  
  const markers = [
    { type: 'start', ...sortedByValue[0] },
    { type: 'end', ...sortedByValue[sortedByValue.length - 1], incomingAngle, barLen: bestLen }
  ];
  
  // ALL intersections get markers - circles for useCircle, breaks are already in paths
  const circleIntersections = intersections.filter(int => int.useCircle);

  return {
    paths, markers, intersections: circleIntersections, allIntersections: intersections,
    acuteVertices, arcDots, cx, cy, rings, maxRadius, layoutMode, layout, points, size
  };
};

// Generate sigil with alternatives when hot zones detected (or always if forceAll is true)
const generateSigilWithAlternatives = (unique, numbers, size = 200, pointsPerRing = 6, forceAll = false) => {
  // Generate standard layout first
  const standard = generateSigil(unique, numbers, size, pointsPerRing, LayoutMode.STANDARD);

  // Analyze heat map using all intersections (not just circle ones)
  const heat = analyzeHeatMap(standard.allIntersections, size);

  if (!heat.isHot && !forceAll) {
    return {
      layouts: { standard },
      isHot: false,
      heatAnalysis: heat,
      recommendedLayout: 'standard'
    };
  }

  // Generate all 4 layouts
  const venn = generateSigil(unique, numbers, size, pointsPerRing, LayoutMode.VENN);
  const extraRings = generateSigil(unique, numbers, size, pointsPerRing, LayoutMode.EXTRA_RINGS);
  const satellite = generateSigil(unique, numbers, size, pointsPerRing, LayoutMode.SATELLITE);

  // Calculate scores for each layout (lower is better)
  const layouts = { standard, venn, extra_rings: extraRings, satellite };
  const scores = {};

  for (const [name, sigil] of Object.entries(layouts)) {
    const heatResult = analyzeHeatMap(sigil.allIntersections, size);
    scores[name] = heatResult.globalScore;
  }

  // Find recommended layout (lowest score)
  const recommendedLayout = Object.entries(scores)
    .sort((a, b) => a[1] - b[1])[0][0];

  return {
    layouts,
    scores,
    isHot: heat.isHot,
    heatAnalysis: heat,
    recommendedLayout
  };
};

const SigilSVG = ({ sigil, size, showGuides = false, showHeatMap = false, heatAnalysis = null, label = null, score = null, generatedSize = null }) => {
  const color = "#3f3f46";
  // Use viewBox to scale content if generated at different size
  const viewBoxSize = generatedSize || size;

  // Support different layout ring guides
  const renderGuides = () => {
    const guides = [];
    const layout = sigil.layout;

    if (sigil.layoutMode === LayoutMode.VENN && layout) {
      // Venn: two overlapping circles
      guides.push(
        <circle key="venn-left" cx={layout.leftCx} cy={layout.cy} r={sigil.maxRadius}
          fill="none" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="2,4" />
      );
      guides.push(
        <circle key="venn-right" cx={layout.rightCx} cy={layout.cy} r={sigil.maxRadius}
          fill="none" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="2,4" />
      );
    } else if (sigil.layoutMode === LayoutMode.SATELLITE && layout) {
      // Satellite: main ring + satellite ring with connector
      guides.push(
        <circle key="sat-main" cx={layout.mainCx} cy={layout.satCy} r={layout.mainRadius}
          fill="none" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="2,4" />
      );
      if (layout.hasConnector) {
        guides.push(
          <circle key="sat-satellite" cx={layout.satCx} cy={layout.satCy} r={layout.satRadius}
            fill="none" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="2,4" />
        );
        // Connector line
        guides.push(
          <line key="sat-connector"
            x1={layout.mainCx + layout.mainRadius} y1={layout.satCy}
            x2={layout.satCx - layout.satRadius} y2={layout.satCy}
            stroke="#e4e4e7" strokeWidth="1" strokeDasharray="2,4" />
        );
      }
    } else {
      // Standard/Extra rings: concentric circles
      sigil.rings.forEach((r, i) => {
        guides.push(
          <circle key={`ring-${i}`} cx={sigil.cx} cy={sigil.cy} r={r}
            fill="none" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="2,4" />
        );
      });
    }
    return guides;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} style={{background: '#fafaf9'}}>
      {/* Heat map overlay */}
      {showHeatMap && heatAnalysis && (
        <g>
          {/* Cell density overlay */}
          {heatAnalysis.cells.filter(c => c.count > 0).map((cell, i) => (
            <rect key={`heat-cell-${i}`}
              x={cell.x} y={cell.y}
              width={heatAnalysis.cellSize} height={heatAnalysis.cellSize}
              fill="red"
              opacity={Math.min(0.4, cell.count * 0.15)}
            />
          ))}
          {/* Hot zone circles */}
          {heatAnalysis.zones.map((zone, i) => (
            <circle key={`heat-zone-${i}`}
              cx={zone.centerX} cy={zone.centerY} r={zone.radius}
              fill="none" stroke="red" strokeWidth="2" strokeDasharray="4,4"
              opacity={0.7}
            />
          ))}
        </g>
      )}

      {showGuides && renderGuides()}

      <circle cx={sigil.cx} cy={sigil.cy} r={2} fill={color} opacity={0.15} />

      {sigil.paths.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      ))}

      {/* Circle intersections */}
      {sigil.intersections.map((int, i) => (
        <circle key={`int-${i}`} cx={int.x} cy={int.y} r={4} fill="#fafaf9" stroke={color} strokeWidth="1.5" />
      ))}

      {/* Acute vertices (< 30°) */}
      {sigil.acuteVertices.map((v, i) => (
        <circle key={`acute-${i}`} cx={v.x} cy={v.y} r={3} fill={color} />
      ))}

      {/* Arc decorative dots */}
      {sigil.arcDots.map((d, i) => (
        <circle key={`arcdot-${i}`} cx={d.x} cy={d.y} r={2} fill={color} />
      ))}

      {/* Start marker */}
      {sigil.markers.filter(m => m.type === 'start').map((m, i) => (
        <g key={`start-${i}`}>
          <circle cx={m.x} cy={m.y} r={6} fill="#fafaf9" stroke={color} strokeWidth="2" />
          <circle cx={m.x} cy={m.y} r={2} fill={color} />
        </g>
      ))}

      {/* End marker */}
      {sigil.markers.filter(m => m.type === 'end').map((m, i) => {
        const perpAngle = m.incomingAngle + Math.PI / 2;
        return (
          <line
            key={`end-${i}`}
            x1={m.x + Math.cos(perpAngle) * m.barLen}
            y1={m.y + Math.sin(perpAngle) * m.barLen}
            x2={m.x - Math.cos(perpAngle) * m.barLen}
            y2={m.y - Math.sin(perpAngle) * m.barLen}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}

      {/* Satellite connector line (actual path, not guide) */}
      {sigil.layoutMode === LayoutMode.SATELLITE && sigil.layout?.hasConnector && (
        <line
          x1={sigil.layout.mainCx + sigil.layout.mainRadius}
          y1={sigil.layout.satCy}
          x2={sigil.layout.satCx - sigil.layout.satRadius}
          y2={sigil.layout.satCy}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
};

// 2x2 comparison grid for alternative layouts
const LayoutComparisonGrid = ({ result, size, showGuides, showHeatMap }) => {
  const layoutNames = {
    standard: 'Standard',
    venn: 'Venn',
    extra_rings: 'Extra Rings',
    satellite: 'Satellite'
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(result.layouts).map(([name, sigil]) => (
        <div key={name} className="flex flex-col items-center p-2 bg-stone-50 rounded">
          <SigilSVG
            sigil={sigil}
            size={size}
            generatedSize={sigil.size}
            showGuides={showGuides}
            showHeatMap={showHeatMap}
            heatAnalysis={analyzeHeatMap(sigil.allIntersections, sigil.size)}
          />
          <p className={`text-xs mt-1 ${name === result.recommendedLayout ? 'text-green-600 font-medium' : 'text-zinc-500'}`}>
            {layoutNames[name]} {result.scores && `(${result.scores[name]})`}
            {name === result.recommendedLayout && ' *'}
          </p>
        </div>
      ))}
    </div>
  );
};

const SigilCompare = ({ text, size = 180, exampleNum, showHeatMap = false }) => {
  const processed = processText(text);
  if (processed.numbers.length < 2) return null;

  const result5 = generateSigilWithAlternatives(processed.unique, processed.numbers, size, 5);
  const result7 = generateSigilWithAlternatives(processed.unique, processed.numbers, size, 7);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <p className="text-xs text-zinc-600 mb-1 font-medium">Example #{exampleNum}</p>
      <p className="text-xs text-zinc-500 mb-1 text-center italic">"{text}"</p>
      <p className="text-xs text-zinc-400 font-mono mb-3 text-center">
        {processed.unique.length} pts
        {(result5.isHot || result7.isHot) && <span className="text-red-500 ml-2">Hot zones detected</span>}
      </p>

      <div className="flex gap-4 justify-center flex-wrap">
        <div className="flex flex-col items-center">
          {result5.isHot ? (
            <>
              <p className="text-xs text-zinc-500 mb-1">5/ring alternatives:</p>
              <LayoutComparisonGrid result={result5} size={size * 0.55} showGuides={true} showHeatMap={showHeatMap} />
            </>
          ) : (
            <>
              <SigilSVG sigil={result5.layouts.standard} size={size} generatedSize={result5.layouts.standard.size} showGuides={true} showHeatMap={showHeatMap} heatAnalysis={result5.heatAnalysis} />
              <p className="text-xs text-zinc-500 mt-2">#{exampleNum}a: 5/ring</p>
            </>
          )}
        </div>
        <div className="flex flex-col items-center">
          {result7.isHot ? (
            <>
              <p className="text-xs text-zinc-500 mb-1">7/ring alternatives:</p>
              <LayoutComparisonGrid result={result7} size={size * 0.55} showGuides={true} showHeatMap={showHeatMap} />
            </>
          ) : (
            <>
              <SigilSVG sigil={result7.layouts.standard} size={size} generatedSize={result7.layouts.standard.size} showGuides={true} showHeatMap={showHeatMap} heatAnalysis={result7.heatAnalysis} />
              <p className="text-xs text-zinc-500 mt-2">#{exampleNum}b: 7/ring</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [customText, setCustomText] = useState('');
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [pointsPerRing, setPointsPerRing] = useState(5);

  const examples = [
    "i have the stable resources needed to thrive",
    "protection and strength in all things",
    "let go of what no longer serves my growth",
    "manifest abundance and prosperity today",
    "clarity and focus",
    "creative flow",
  ];

  const processed = customText.length > 2 ? processText(customText) : null;
  const customResult = processed
    ? generateSigilWithAlternatives(processed.unique, processed.numbers, 200, pointsPerRing, true)
    : null;

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-light text-zinc-700 mb-1">Sigils v11 - Heat Map Edition</h1>
        <p className="text-xs text-zinc-500 mb-4">
          Hot zones trigger alternative layouts: Venn, Extra Rings, Satellite
        </p>

        <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Try your own phrase..."
              className="flex-1 p-2 border border-zinc-200 rounded text-sm focus:outline-none focus:border-zinc-400"
            />
            <input
              type="number"
              value={pointsPerRing}
              onChange={(e) => setPointsPerRing(Math.max(3, Math.min(12, parseInt(e.target.value) || 5)))}
              min="3"
              max="12"
              className="w-16 p-2 border border-zinc-200 rounded text-sm"
              title="Points per ring"
            />
          </div>

          <div className="flex gap-4 mb-3">
            <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showHeatMap}
                onChange={(e) => setShowHeatMap(e.target.checked)}
                className="w-4 h-4"
              />
              Show heat map
            </label>
          </div>

          {customResult && (
            <div>
              <p className="text-xs text-zinc-600 mb-1 font-medium">Custom</p>
              <p className="text-xs text-zinc-400 font-mono mb-1 text-center">
                {processed.unique.length} pts | Heat score: {customResult.heatAnalysis.globalScore}
                {customResult.isHot && <span className="text-red-500 ml-1">(HOT)</span>}
              </p>

              <LayoutComparisonGrid
                result={customResult}
                size={150}
                showGuides={true}
                showHeatMap={showHeatMap}
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {examples.map((text, i) => (
            <SigilCompare key={i} text={text} size={170} exampleNum={i + 1} showHeatMap={showHeatMap} />
          ))}
        </div>
      </div>
    </div>
  );
}
