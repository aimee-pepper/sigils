# Sigil Generator Documentation

---

## Table of Contents
1. [Core Rules](#core-rules)
2. [Standard Layout](#standard-layout)
3. [Venn Layout](#venn-layout)
4. [Satellite Layout](#satellite-layout)
5. [Chained Layout](#chained-layout)

---

## Core Rules

These rules apply to ALL sigil styles.

### Text Processing

1. Split phrase into words
2. Remove vowels from each word (a, e, i, o, u)
3. Deduplicate characters (preserve order of first appearance)
4. Map to numbers: a=1, b=2, ..., z=26

Example: "HELLO WORLD" → "HLL WRLD" → "HLWRD" → H=8, L=12, W=23, R=18, D=4

### Connection Rules

1. Sort points by their letter's alphabetical value (lowest to highest)
2. Connect points in sorted order to form the path
3. Path type depends on point positions:
   - **Arc**: If consecutive points are adjacent on the SAME ring/circle
   - **Straight Line**: If points are on different rings OR not adjacent on same ring
4. **Group constraint**: Arcs only occur within the same group
   - For multi-circle layouts (Venn, Satellite, Chained), points on different circles ALWAYS connect with straight lines

### Intersection Markers

When two path segments cross, they need a marker:

1. Calculate crossing angle: 0° = parallel, 90° = perpendicular
2. **Hollow circle marker**: crossing angle < 45° (lines are closer to parallel)
3. **Line break (gap)**: crossing angle ≥ 45° (lines are closer to perpendicular)
4. **Consolidated intersections**: If 2+ intersections overlap → force hollow circle marker
5. Every intersection MUST have a marker (either circle or line break)

### Vertex Decorations (Acute Angle Dots)

At vertices where the path changes direction:

1. Calculate interior angle at the vertex
2. Eligible for dot if: interior angle < 30° OR exterior angle < 30° (interior > 150°)
3. This catches both sharp points AND nearly-straight-through vertices
4. Only 50% of eligible vertices receive dots (seeded random selection)
5. Dot is solid, placed at the vertex point

### Arc Decorative Dots

For arc segments, decorative dots are added based on arc length:

1. Compare arc length to the ring's full circumference (2πr)
2. Arc ≥ 1/4 circumference → 1 dot
3. Arc ≥ 1/3 circumference → 2 dots
4. Arc ≥ 1/2 circumference → 3 dots
5. Maximum 3 dots per arc
6. Dots spaced evenly along arc with slight random jitter
7. No overlapping dots (minimum 2× dot diameter apart)

### Start Marker

- Style: Hollow circle with center dot
- Placement: At the point with the LOWEST letter value (first in sorted order)
- The start marker indicates where to begin tracing the sigil

### End Marker (Bar Terminus)

- Style: Perpendicular bar
- Placement: At the point with the HIGHEST letter value (last in sorted order)
- Bar orientation: Perpendicular to the incoming line/arc direction
- Bar length: Adjustable (3-20px), prefer 6-10px
- Collision avoidance: Bar length adjusts to avoid hitting other lines
- For arcs: Calculate tangent direction at endpoint, bar is perpendicular to tangent

### Visual Parameters

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background | #fafaf9 | #1a1a1a |
| Line color | #3f3f46 | #ffffff |
| Stroke width | 2px uniform | 2px uniform |
| Center dot | 2px radius, 15% opacity | 2px radius, 15% opacity |
| Hollow circle markers | 4px radius, 1.5px stroke | 4px radius, 1.5px stroke |
| Solid dots (acute vertices) | 3px radius | 3px radius |
| Arc decorative dots | 2px radius | 2px radius |
| Start marker | 6px outer circle, 2px inner dot | 6px outer circle, 2px inner dot |
| End bar | 3px stroke width | 3px stroke width |

### Heat Map Detection

Used to identify crowded areas and suggest alternative layouts:

- Grid: 6×6 (~33px cells for 200px canvas)
- Cell threshold: 2+ intersections = warm cell
- Zone threshold: Global score ≥ 4 triggers alternatives
- Each layout gets a heat score (lower = better)
- Recommended layout (marked with *) has lowest score

---

## Standard Layout

The Standard layout uses concentric rings centered on the canvas.

### Point Placement

1. Calculate rings needed: `ceil(point_count / points_per_ring)`
2. Ring spacing: Gap between rings = half the innermost circle's radius
3. Points distributed evenly around each ring
4. Fill outer ring first, then move inward

### Connection Behavior

Since all points share the same center:
- Adjacent points on the same ring → Arc following ring curvature
- Points on different rings → Straight line
- Non-adjacent points on same ring → Straight line cutting across

### When to Use

- Phrases with fewer unique consonants (≤8)
- When you want a symmetric, centered design
- Traditional sigil aesthetics

### Visual Characteristics

- Circular, mandala-like appearance
- Radial symmetry tendency
- Central focus point

---

## Venn Layout

The Venn layout uses two (or three) overlapping circles to distribute points.

### Structure

**Two-Circle Venn:**
- Two circles with ~60% overlap
- Left circle: First half of points
- Right circle: Second half of points

**Three-Circle Venn:**
- Three circles arranged in triangular pattern
- Points distributed across all three circles

### Connection Rules

- Points on SAME circle AND adjacent → Arc
- Points on SAME circle but NOT adjacent → Straight line
- Points on DIFFERENT circles → Always straight line (crosses the overlap zone)

### When to Use

- Reducing intersection density
- Phrases with 6-12 unique consonants
- When Standard layout has too many crossings
- Creating more horizontal spread

### Visual Characteristics

- Wider, more horizontal appearance
- Intersections spread across overlap zone
- Figure-8 or trefoil patterns common

---

## Satellite Layout

The Satellite layout uses a main ring with a smaller connected satellite ring.

### Structure

- **Main ring**: Centered, contains ~70% of points
- **Satellite ring**: Smaller, offset to the side, contains ~30% of points

### Point Distribution

1. Sort points by letter value
2. Highest letter values go to satellite ring
3. Remaining points stay on main ring

### Connection Rules

- Points on SAME ring AND adjacent → Arc
- Points on SAME ring but NOT adjacent → Straight line
- Points crossing between main and satellite → Always straight line

### When to Use

- Separating high-value letters from low-value
- Reducing central congestion
- Creating asymmetric, dynamic compositions

### Visual Characteristics

- Main focus with secondary element
- Asymmetric balance
- Clear visual hierarchy

---

## Chained Layout

Chained sigils are formed by connecting multiple rings (glyphs) together.

### Core Principles

#### 1. Rings MUST Overlap
- Rings are designed to overlap and connect - this is the entire point
- The center points and circular boundaries overlapping is EXPECTED and REQUIRED
- Do NOT prevent ring placement based on ring/center overlap

#### 2. Only LINE Intersections Matter
- The ONLY thing we care about avoiding is **line intersections between different glyphs**
- A line from Ring 2 should not cross/intersect lines from Ring 1
- Lines WITHIN the same ring can intersect (that's normal sigil behavior)
- The goal is to find a rotation and position where the NEW ring's lines don't cross EXISTING rings' lines

#### 3. Connection Points
- Each new ring's START vertex (lowest letter value) lands on a line segment of the previous ring
- This creates a visual connection between rings
- The connection point should be on a LINE segment, not at a vertex

### Positioning Algorithm

For Ring N (where N > 1):
1. Find all valid attachment points along Ring N-1's line segments
2. For each attachment point, try multiple rotations of Ring N
3. For each rotation, count how many times Ring N's lines would intersect previous rings' lines
4. Select the position/rotation with ZERO line intersections
5. If no zero-intersection position exists, select the one with FEWEST intersections

### Attachment Point Selection

- Sample points along line segments (not at vertices)
- For lines: sample at 10%, 20%, ..., 90% along the line
- For arcs: sample at similar intervals along the arc
- Prefer points away from vertices

### Rotation Sampling

- Try rotations every 5 degrees (72 positions per full rotation)
- This gives enough granularity to find non-intersecting orientations

### Terminus Markers for Chained

- Ring 1: Standard start marker + bar end
- Ring 2: Circle end (no start marker - it's connected)
- Ring 3: Bar end
- Pattern alternates: bar, circle, bar, circle...

### What Does NOT Matter

- Ring circles overlapping (REQUIRED for connection)
- Ring centers being close together (FINE)
- New ring being "inside" an old ring's circular boundary (FINE)
- Rings touching or sharing space (EXPECTED)

### Common Mistakes to Avoid

1. **DO NOT** check if ring circles overlap - they should!
2. **DO NOT** check if ring centers are too close - they can be!
3. **DO NOT** require minimum distance between rings
4. **DO** check if the LINES/PATHS of different rings intersect
5. **DO** try many rotations to find non-intersecting orientations
